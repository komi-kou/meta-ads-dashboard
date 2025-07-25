console.log("scheduler.jsが実行されました");
const cron = require('node-cron');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { fetchMetaAdDailyStats, fetchMetaTokenExpiry } = require('./metaApi');
const { sendChatworkMessage } = require('./chatworkApi');
const { checkAllAlerts } = require('./alertSystem');
const tokenManager = require('./utils/tokenManager');
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

const DATA_FILE = path.join(__dirname, 'data.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// マルチユーザーチャットワーク送信インスタンス
const multiUserSender = new MultiUserChatworkSender();

// ログファイルのパス
const LOG_FILE = path.join(__dirname, 'scheduler.log');

// ログ出力関数
function writeLog(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(message);
  
  try {
    fs.appendFileSync(LOG_FILE, logMessage);
  } catch (e) {
    console.error('ログファイル書き込みエラー:', e);
  }
}

// 環境変数から設定情報を取得する関数
function getEnvironmentSettings() {
  return {
    // Meta API設定
    meta_token: process.env.META_ACCESS_TOKEN,
    meta_account_id: process.env.META_ACCOUNT_ID,
    meta_app_id: process.env.META_APP_ID,
    // Chatwork設定
    chatwork_token: process.env.CHATWORK_TOKEN,
    chatwork_room_id: process.env.CHATWORK_ROOM_ID,
    // 通知設定
    notifications: {
      daily_report: { enabled: process.env.DAILY_REPORT_ENABLED === 'true' || false },
      update_notifications: { enabled: process.env.UPDATE_NOTIFICATIONS_ENABLED === 'true' || false },
      alert_notifications: { enabled: process.env.ALERT_NOTIFICATIONS_ENABLED === 'true' || false }
    }
  };
}

// 設定情報を取得する関数
function getSettings() {
  // 本番環境では環境変数から設定を取得
  if (process.env.NODE_ENV === 'production') {
    return getEnvironmentSettings();
  }
  
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE));
      
      // 新しいネスト形式の設定を古いフラット形式に変換
      const convertedSettings = {
        // Meta API設定
        meta_token: settings.meta?.accessToken,
        meta_account_id: settings.meta?.accountId,
        meta_app_id: settings.meta?.appId,
        
        // チャットワーク設定
        chatwork_token: settings.chatwork?.apiToken,
        chatwork_room_id: settings.chatwork?.roomId,
        
        // その他の設定（既存の形式を保持）
        daily_budget: settings.daily_budget,
        service_goal: settings.goal?.type,
        target_cpa: settings.target_cpa,
        target_cpm: settings.target_cpm,
        target_ctr: settings.target_ctr,
        target_budget_rate: settings.target_budget_rate,
        target_cv: settings.target_cv
      };
      
      writeLog(`設定読み込み完了: Meta=${!!convertedSettings.meta_token}, Chatwork=${!!convertedSettings.chatwork_token}`);
      return convertedSettings;
    } catch (e) {
      writeLog(`設定ファイル読み込みエラー: ${e.message}`);
    }
  } else {
    writeLog('設定ファイルが見つかりません');
  }
  return {};
}

// 広告データを取得する関数
function getAdData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE));
      const filteredData = data.filter(item => item.date || item.date_start || item.spend !== undefined);
      writeLog(`広告データ読み込み: ${filteredData.length}件`);
      return filteredData;
    } catch (e) {
      writeLog(`広告データ読み込みエラー: ${e.message}`);
    }
  }
  
  // ファイルが存在しない場合は空配列を返す
  writeLog('広告データファイルが見つかりません - 空配列を返します');
  return [];
}

// 広告データを保存する関数
function saveAdData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    writeLog(`広告データ保存完了: ${data.length}件`);
  } catch (e) {
    // 本番環境では書き込み権限がない場合があるためエラーログのみ
    writeLog(`広告データ保存エラー（権限不足の可能性）: ${e.message}`);
  }
}

// バッチ本体処理を関数化
async function runBatch(isMorningReport = false) {
  writeLog('=== 日次バッチ開始 ===');
  
  // 設定を取得
  const settings = getSettings();
  const latestDailyBudget = settings.daily_budget ? Number(settings.daily_budget) : undefined;
  writeLog(`使用する日予算: ${latestDailyBudget}`);
  
  if (!settings.meta_token || !settings.meta_account_id) {
    writeLog('API連携情報が未設定のためスキップ');
    return;
  }

  // トークン期限チェックは新しい管理システムで処理

  // Meta広告APIから昨日のデータ取得
  try {
    writeLog('Meta広告APIからデータ取得開始');
  const statsArr = await fetchMetaAdDailyStats({
    accessToken: settings.meta_token,
    accountId: settings.meta_account_id,
    appId: settings.meta_app_id,
      datePreset: 'yesterday',
      dailyBudget: latestDailyBudget
  });
    
  if (!statsArr || !Array.isArray(statsArr) || statsArr.length === 0) {
      writeLog('Meta広告データ取得失敗。data.jsonへの保存をスキップします。');
    return;
  }
    
    writeLog(`Meta広告データ取得成功: ${statsArr.length}件`);
    
  // 取得データをdata.jsonに追記
    let adData = getAdData();
    adData.push(statsArr[0]);
    saveAdData(adData);

    // --- 主な数値のChatwork自動通知 ---
    if (settings.chatwork_token && settings.chatwork_room_id) {
      const d = statsArr[0];
      
      // 数値フォーマット関数
      const formatNumber = (num) => {
        if (num === undefined || num === null) return '0';
        return Number(num).toLocaleString();
      };
      
      const formatPercentage = (num, decimals = 2) => {
        if (num === undefined || num === null) return '0.00';
        return Number(num).toFixed(decimals);
      };
      
      // 朝9時のメイン通知（詳細版）
      let msg;
      if (isMorningReport) {
        // 朝9時は前日の詳細データ
        msg = `広告データを更新しました。\nご確認ください。\n\n▼確認URL\nhttp://localhost:3000/\n\n日付: ${d.date || d.date_start || ''}\n消化金額: ${formatNumber(d.spend)}円\nCV: ${d.cv}\nCPA: ${formatNumber(d.cpa)}円\nCTR: ${formatPercentage(d.ctr, 2)}%\nCPM: ${formatNumber(d.cpm ? d.cpm / 10 : 0)}円\n予算消化率: ${formatPercentage(d.budgetRate, 0)}%`;
      } else {
        // その他の時間帯は簡素化版
        msg = `広告データを更新しました。\nご確認ください。\n\n▼ご確認URL\nhttp://localhost:3000/`;
      }
      
      writeLog(`Chatwork通知送信開始 (${isMorningReport ? '朝9時詳細版' : '簡素化版'})`);
      await sendChatworkMessage({
        date: d.date || d.date_start || '',
        message: msg,
        token: settings.chatwork_token,
        room_id: settings.chatwork_room_id
      });
      writeLog('Chatwork通知送信完了');
    } else {
      writeLog('Chatwork設定が未設定のため通知をスキップ');
    }

    // アラート判定
    adData = getAdData(); // 最新データを再取得
    const n = adData.length;
    const last3 = n >= 3 ? adData.slice(n - 3, n) : [];
    const last2 = n >= 2 ? adData.slice(n - 2, n) : [];
  const getArr = (key) => last3.map(d => Number(d[key] || 0));
  const getArr2 = (key) => last2.map(d => Number(d[key] || 0));
  const goal = settings.service_goal || '';
  const target = {
    cpa: Number(settings.target_cpa) || 0,
    cpm: Number(settings.target_cpm) || 0,
    ctr: Number(settings.target_ctr) || 0,
    budget: Number(settings.target_budget_rate) || 0,
    cv: Number(settings.target_cv) || 0
  };
  const alerts = [];
    
    writeLog(`アラート判定開始: サービス目標=${goal}`);
    writeLog(`目標値設定: CPA=${target.cpa}, CPM=${target.cpm}, CTR=${target.ctr}, 予算消化率=${target.budget}, CV=${target.cv}`);
    writeLog(`最新3日間データ: ${last3.length}件, 最新2日間データ: ${last2.length}件`);
    
  if (goal.startsWith('toc')) {
      writeLog('=== toCアラート判定開始 ===');
      
      // 予算消化率チェック
      const budgetRates = getArr('budgetRate');
      writeLog(`予算消化率チェック: ${budgetRates.join(', ')} (全て80%以下: ${budgetRates.every(v => v <= 80)})`);
      if (budgetRates.every(v => v <= 80) && last3.length === 3) {
        alerts.push('予算消化率が80％以下の日が3日間続いています');
        writeLog('✅ 予算消化率アラート発生');
      }
      
      // CTRチェック
      const ctrs = getArr('ctr');
      writeLog(`CTRチェック: ${ctrs.join(', ')} (全て2.5%以下: ${ctrs.every(v => v <= 2.5)})`);
      if (ctrs.every(v => v <= 2.5) && last3.length === 3) {
        alerts.push('CTRが2.5%以下の日が3日間続いています');
        writeLog('✅ CTRアラート発生');
      }
      
      // CVチェック
      const cvs = getArr2('cv');
      writeLog(`CVチェック: ${cvs.join(', ')} (全て0: ${cvs.every(v => v === 0)})`);
      if (cvs.every(v => v === 0) && last2.length === 2) {
        alerts.push('CV（コンバージョン）が2日連続で0です');
        writeLog('✅ CVアラート発生');
      }
      
      // CPMチェック
      if (target.cpm) {
        const cpms = getArr('cpm');
        const cpmThreshold = target.cpm + 300;
        writeLog(`CPMチェック: ${cpms.join(', ')} (目標+300円=${cpmThreshold}, 全て閾値以上: ${cpms.every(v => v >= cpmThreshold)})`);
        if (cpms.every(v => v >= cpmThreshold) && last3.length === 3) {
          alerts.push('CPMが目標値より300円以上高い日が3日間続いています');
          writeLog('✅ CPMアラート発生');
        }
      }
      
      // CPAチェック
    let cpaLimit = 2000;
    if (goal === 'toc_line') cpaLimit = 1000;
    if (goal === 'toc_buy' && target.cpa) cpaLimit = target.cpa + 500;
      const cpas = getArr('cpa');
      writeLog(`CPAチェック: ${cpas.join(', ')} (閾値=${cpaLimit}, 全て閾値以上: ${cpas.every(v => v >= cpaLimit)})`);
      if (cpas.every(v => v >= cpaLimit) && last3.length === 3) {
        alerts.push(`CPAが${cpaLimit.toLocaleString()}円以上の日が3日間続いています`);
        writeLog('✅ CPAアラート発生');
      }
      
  } else if (goal.startsWith('tob')) {
      writeLog('=== toBアラート判定開始 ===');
      
      // 予算消化率チェック
      const budgetRates = getArr('budgetRate');
      writeLog(`予算消化率チェック: ${budgetRates.join(', ')} (全て80%以下: ${budgetRates.every(v => v <= 80)})`);
      if (budgetRates.every(v => v <= 80) && last3.length === 3) {
        alerts.push('予算消化率が80％以下の日が3日間続いています');
        writeLog('✅ 予算消化率アラート発生');
      }
      
      // CTRチェック
    let ctrLimit = 2.5;
    if (goal === 'tob_mail') ctrLimit = 1.5;
      const ctrs = getArr('ctr');
      writeLog(`CTRチェック: ${ctrs.join(', ')} (閾値=${ctrLimit}%, 全て閾値以下: ${ctrs.every(v => v <= ctrLimit)})`);
      if (ctrs.every(v => v <= ctrLimit) && last3.length === 3) {
        alerts.push(`CTRが${ctrLimit}%以下の日が3日間続いています`);
        writeLog('✅ CTRアラート発生');
      }
      
      // CVチェック
    let cvDays = 2;
    if (goal === 'tob_mail') cvDays = 3;
    if (last3.length >= cvDays) {
        const arr2 = adData.slice(n - cvDays, n).map(d => Number(d.cv || 0));
        writeLog(`CVチェック: ${arr2.join(', ')} (${cvDays}日間, 全て0: ${arr2.every(v => v === 0)})`);
        if (arr2.every(v => v === 0)) {
          alerts.push(`CV（コンバージョン）が${cvDays}日連続で0です`);
          writeLog('✅ CVアラート発生');
        }
      }
      
      // CPMチェック
      if (target.cpm) {
        const cpms = getArr('cpm');
        const cpmThreshold = target.cpm + 300;
        writeLog(`CPMチェック: ${cpms.join(', ')} (目標+300円=${cpmThreshold}, 全て閾値以上: ${cpms.every(v => v >= cpmThreshold)})`);
        if (cpms.every(v => v >= cpmThreshold) && last3.length === 3) {
          alerts.push('CPMが目標値より300円以上高い日が3日間続いています');
          writeLog('✅ CPMアラート発生');
        }
      }
      
      // CPAチェック
    let cpaLimit = 15000;
    if (goal === 'tob_line') cpaLimit = 10000;
    if (goal === 'tob_buy' && target.cpa) cpaLimit = target.cpa + 500;
      const cpas = getArr('cpa');
      writeLog(`CPAチェック: ${cpas.join(', ')} (閾値=${cpaLimit}, 全て閾値以上: ${cpas.every(v => v >= cpaLimit)})`);
      if (cpas.every(v => v >= cpaLimit) && last3.length === 3) {
        alerts.push(`CPAが${cpaLimit.toLocaleString()}円以上の日が3日間続いています`);
        writeLog('✅ CPAアラート発生');
      }
    }
    
    writeLog(`アラート判定結果: ${alerts.length}件のアラート`);
    
    // アラート定義と確認事項・改善施策マップ
    const alertCheckMap = {
      '予算消化率が80％以下の日が3日間続いています': [
        {
          check: '配信されているか確認（広告がアクティブになっているか）',
          improvements: [
            '管理画面の上の運用しているキャンペーンが緑でアクティブになっているか、キャンペーンを確認する',
            '決済ができておらず配信エラーになっていないか、請求と支払いを確認する',
            'クリエイティブが審査落ちしていて配信エラーになっていないか、広告を確認する'
          ]
        },
        {
          check: '配信するクリエイティブが枯れている（CV数が0もしくは目標CPA未達＆予算も消化されていない）',
          improvements: [
            '過去7日間ベースでCV数が0もしくは目標CPAに達していないクリエイティブを差し替える'
          ]
        },
        {
          check: '配信するユーザー層が悪いのか（ユーザー層が悪いと表示されないケース）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）',
            'キャンペーンを複製して配信するユーザー層を変える（設定は変えずに）'
          ]
        }
      ],
      'CTRが2.5%以下の日が3日間続いています': [
        {
          check: '配信しているクリエイティブが刺さっていないor枯れている（ありきたり/飽きられている）',
          improvements: [
            '過去7日間ベースで予算が寄っておらずCVも取れていないクリエイティブを差し替える',
            '過去7日間ベースで予算は寄っているけど目標CPAに達しておらずクリック率も目標以下のクリエイティブは差し替える'
          ]
        },
        {
          check: 'フリークエンシーが2.5%以上ある（同じユーザーばかりに配信されている）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）',
            'キャンペーンを複製して配信するユーザー層を変える（設定は変えずに）'
          ]
        },
        {
          check: '配信するユーザー層が見込み顧客ではない（サービスに合ったユーザー層に配信されていない）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する'
          ]
        }
      ],
      'CTRが1.5%以下の日が3日間続いています': [
        {
          check: '配信しているクリエイティブが刺さっていないor枯れている（ありきたり/飽きられている）',
          improvements: [
            '過去7日間ベースで予算が寄っておらずCVも取れていないクリエイティブを差し替える',
            '過去7日間ベースで予算は寄っているけど目標CPAに達しておらずクリック率も目標以下のクリエイティブは差し替える'
          ]
        },
        {
          check: 'フリークエンシーが2.5%以上ある（同じユーザーばかりに配信されている）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）',
            'キャンペーンを複製して配信するユーザー層を変える（設定は変えずに）'
          ]
        },
        {
          check: '配信するユーザー層が見込み顧客ではない（サービスに合ったユーザー層に配信されていない）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する'
          ]
        }
      ],
      'CPMが目標値より300円以上高い日が3日間続いています': [
        {
          check: '最適なCPM値で配信できていない（クリエイティブ/ユーザー層が原因でCPM乖離）',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            'キャンペーンを複製する'
          ]
        }
      ],
      'CV（コンバージョン）が2日連続で0です': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている（入口で魅力的に見せられていない/飽きられている）',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ],
      'CV（コンバージョン）が3日連続で0です': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている（入口で魅力的に見せられていない/飽きられている）',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ],
      'CPAが2,000円以上の日が3日間続いています': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: '学習データが適切ではない（ピクセル学習データが誤っている）',
          improvements: [
            'ピクセルを作成し直してデータを再度学習し直す'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ],
      'CPAが1,000円以上の日が3日間続いています': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: '学習データが適切ではない（ピクセル学習データが誤っている）',
          improvements: [
            'ピクセルを作成し直してデータを再度学習し直す'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ],
      'CPAが15,000円以上の日が3日間続いています': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: '学習データが適切ではない（ピクセル学習データが誤っている）',
          improvements: [
            'ピクセルを作成し直してデータを再度学習し直す'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ],
      'CPAが10,000円以上の日が3日間続いています': [
        {
          check: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
          improvements: [
            '過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える',
            '過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える',
            '訴求軸が違うクリエイティブを配信する',
            '動画広告を配信する'
          ]
        },
        {
          check: '配信するユーザー層がズレている（購入見込みの低いユーザーに配信）',
          improvements: [
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する（獲得できないユーザー層には配信しない）',
            '類似オーディエンスを活用して、見込み層の高いユーザーに配信する',
            'キャンペーンを複製して配信するユーザー層を変える',
            '広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する（獲得できないユーザー層には配信しない）'
          ]
        },
        {
          check: '学習データが適切ではない（ピクセル学習データが誤っている）',
          improvements: [
            'ピクセルを作成し直してデータを再度学習し直す'
          ]
        },
        {
          check: 'LPで離脱されている（LP内容が刺さっていない）',
          improvements: [
            'ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）',
            'CTAの文言・デザイン・アクションを変更する',
            'FVを改善する'
          ]
        }
      ]
    };
    
    // --- ここで最新データにalertsを保存 ---
    // alertsWithChecks: [{alert, checks: [..]}]
    const alertsWithChecks = alerts.map(alert => ({
      alert,
      checks: alertCheckMap[alert] || []
    }));
    if (adData.length > 0) {
      adData[adData.length - 1].alerts = alertsWithChecks;
      saveAdData(adData);
    }
    
  // アラートがあればChatwork通知
  if (alerts.length === 0) {
      writeLog("アラートがないためChatwork通知をスキップします。");
} else if (settings.chatwork_token && settings.chatwork_room_id) {
  const lastDate = statsArr[0].date || statsArr[0].date_start || '';
  const dateStr = new Date().toLocaleDateString('ja-JP');
      
      // 技術用語を日本語に変換する関数
      function translateAlertTerms(alertText) {
        return alertText
          .replace(/budget_rate/g, '予算消化率')
          .replace(/ctr/g, 'CTR')
          .replace(/conversions/g, 'CV')
          .replace(/cpa_rate/g, 'CPA')
          .replace(/cpm_increase/g, 'CPM上昇')
          .replace(/日予算/g, '日予算')
          .replace(/CPM/g, 'CPM');
      }
      
      // 修正後のアラートメッセージ
      let alertMessage = `Meta広告 アラート通知 (${dateStr})
以下のアラートが発生しています：

`;
      
      alerts.forEach((alert, index) => {
        const translatedAlert = translateAlertTerms(alert);
        alertMessage += `${index + 1}. **${alert}**：${translatedAlert}\n`;
      });

      alertMessage += `
確認事項：http://localhost:3000/improvement-tasks
改善施策：http://localhost:3000/improvement-strategies

📊 ダッシュボードで詳細を確認してください。
http://localhost:3000/dashboard`;
      
      writeLog(`アラート通知送信開始: ${alerts.length}件のアラート`);
      writeLog(`アラート内容: ${alerts.join(', ')}`);
      
  await sendChatworkMessage({
    date: lastDate,
        message: alertMessage,
    token: settings.chatwork_token,
    room_id: settings.chatwork_room_id
  });
      writeLog('アラート通知送信完了');
    } else {
      writeLog('Chatwork設定が未設定のためアラート通知をスキップ');
    }
    
  } catch (error) {
    writeLog(`バッチ処理エラー: ${error.message}`);
    console.error('バッチ処理エラー詳細:', error);
  }
  
  writeLog('=== 日次バッチ完了 ===');
}

// テストメッセージ送信関数
async function sendTestMessage(isMorningReport = false) {
  writeLog('=== テストメッセージ送信開始 ===');
  const settings = getSettings();
  
  if (!settings.chatwork_token || !settings.chatwork_room_id) {
    writeLog('Chatwork設定が未設定のためテストメッセージ送信をスキップ');
    return;
  }

  try {
    let testMessage;
    if (isMorningReport) {
      testMessage = `【テスト】広告データを更新しました。\nご確認ください。\n\n▼確認URL\nhttp://localhost:3000/\n\n日付: YYYY-MM-DD\n消化金額: 12,345円\nCV: 10\nCPA: 1,234円\nCTR: 2.34%\nCPM: 1,234円\n予算消化率: 80%`;
    } else {
      testMessage = `【テスト】広告データを更新しました。\nご確認ください。\n\n▼ご確認URL\nhttp://localhost:3000/`;
    }
    await sendChatworkMessage({
      date: new Date().toISOString().slice(0, 10),
      message: testMessage,
      token: settings.chatwork_token,
      room_id: settings.chatwork_room_id
    });
    
    writeLog('テストメッセージ送信完了');
  } catch (error) {
    writeLog(`テストメッセージ送信エラー: ${error.message}`);
    console.error('テストメッセージ送信エラー詳細:', error);
  }
}

// 設定ファイルからMeta API情報を取得
function getMetaApiConfigFromSetup() {
    try {
        // 複数の設定ファイルから取得を試行
        const configFiles = [
            'config/meta-config.json',
            'settings.json',
            'data.json'
        ];
        
        for (const file of configFiles) {
            try {
                const configPath = path.join(process.cwd(), file);
                const configData = require(configPath);
                
                // 設定ファイルの構造に応じて認証情報を取得
                let accessToken, accountId, appId;
                
                if (configData.meta_access_token && configData.meta_account_id) {
                    // config/meta-config.json形式
                    accessToken = configData.meta_access_token;
                    accountId = configData.meta_account_id;
                    appId = configData.meta_app_id;
                } else if (configData.settings && configData.settings.meta) {
                    // settings.json形式
                    accessToken = configData.settings.meta.access_token;
                    accountId = configData.settings.meta.account_id;
                    appId = configData.settings.meta.app_id;
                } else if (configData.meta && configData.meta.access_token) {
                    // data.json形式
                    accessToken = configData.meta.access_token;
                    accountId = configData.meta.account_id;
                    appId = configData.meta.app_id;
                }
                
                if (accessToken && accountId) {
                    return {
                        accessToken,
                        accountId,
                        appId,
                        tokenCreatedAt: configData.tokenCreatedAt || new Date().toISOString()
                    };
                }
            } catch (error) {
                console.log(`設定ファイル ${file} の読み込みに失敗:`, error.message);
                continue;
            }
        }
        
        return null;
    } catch (error) {
        console.error('設定取得エラー:', error);
        return null;
    }
}

// チャットワーク設定を取得
function getChatworkConfig() {
    try {
        const configFiles = [
            'config/meta-config.json',
            'settings.json',
            'data.json'
        ];
        
        for (const file of configFiles) {
            try {
                const configPath = path.join(process.cwd(), file);
                const configData = require(configPath);
                
                let chatworkApiToken, chatworkRoomId;
                
                if (configData.chatwork_api_token && configData.chatwork_room_id) {
                    chatworkApiToken = configData.chatwork_api_token;
                    chatworkRoomId = configData.chatwork_room_id;
                } else if (configData.settings && configData.settings.chatwork) {
                    chatworkApiToken = configData.settings.chatwork.api_token;
                    chatworkRoomId = configData.settings.chatwork.room_id;
                } else if (configData.chatwork && configData.chatwork.api_token) {
                    chatworkApiToken = configData.chatwork.api_token;
                    chatworkRoomId = configData.chatwork.room_id;
                }
                
                if (chatworkApiToken && chatworkRoomId) {
                    return {
                        apiToken: chatworkApiToken,
                        roomId: chatworkRoomId
                    };
                }
            } catch (error) {
                continue;
            }
        }
        
        return null;
    } catch (error) {
        console.error('チャットワーク設定取得エラー:', error);
        return null;
    }
}

// Meta APIからデータを取得
async function fetchMetaDataForDate(dateString) {
    try {
        const config = getMetaApiConfigFromSetup();
        
        if (!config || !config.accessToken || !config.accountId) {
            throw new Error('Meta API設定が見つかりません');
        }
        
        const baseUrl = 'https://graph.facebook.com/v18.0';
        const endpoint = `${baseUrl}/${config.accountId}/insights`;
        const params = {
            access_token: config.accessToken,
            fields: 'spend,impressions,clicks,ctr,cpm,frequency,reach,actions,cost_per_action_type',
            time_range: JSON.stringify({ since: dateString, until: dateString }),
            level: 'account'
        };
        
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${endpoint}?${queryString}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Meta API Error: ${data.error.message}`);
        }
        
        return data.data[0] || null;
    } catch (error) {
        console.error('Meta APIデータ取得エラー:', error);
        return null;
    }
}

// メッセージ生成関数
function generateMessageByType(type, data = {}) {
    switch (type) {
        case 'daily_report':
            return generateDailyReportMessage(data);
        case 'update_notification':
            return generateUpdateNotificationMessage(data);
        case 'alert_notification':
            return generateAlertNotificationMessage(data);
        case 'token_expiry_warning':
            return generateTokenExpiryWarning();
        case 'setup_completion':
            return generateSetupCompletionMessage();
        default:
            return '通知メッセージ';
    }
}

// 日次レポートメッセージ生成
function generateDailyReportMessage(data) {
    const today = new Date().toLocaleDateString('ja-JP');
    
    return `[info][title]📊 Meta広告 日次レポート - ${today}[/title]
💰 消化金額: ${data.spend?.toLocaleString() || 0}円
📈 予算消化率: ${data.budgetRate || 0}%
👆 CTR: ${data.ctr || 0}%
💵 CPM: ${data.cpm?.toLocaleString() || 0}円
🎯 CV数: ${data.conversions || 0}件
💰 CPA: ${data.cpa?.toLocaleString() || 0}円
🔄 フリークエンシー: ${data.frequency || 0}

${data.budgetRate > 100 ? '⚠️ 予算オーバーしています' : '✅ 予算内で運用中'}
[/info]`;
}

// 定期更新通知メッセージ生成
function generateUpdateNotificationMessage(data) {
    return `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

▼確認はこちら
http://localhost:3000/dashboard`;
}

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    switch (metric) {
        case 'budget_rate':
            return '予算消化率';
        case 'daily_budget':
            return '日予算';
        case 'ctr':
            return 'CTR';
        case 'conversions':
            return 'CV';
        case 'cpm':
            return 'CPM';
        case 'cpa':
            return 'CPA';
        default:
            return metric;
    }
}

// アラート通知メッセージ生成
function generateAlertNotificationMessage(data) {
    const today = new Date().toLocaleDateString('ja-JP');
    
    // 技術用語を日本語に変換する関数
    function translateAlertTerms(alertText) {
        return alertText
            .replace(/budget_rate/g, '予算消化率')
            .replace(/ctr/g, 'CTR')
            .replace(/conversions/g, 'CV')
            .replace(/cpa_rate/g, 'CPA')
            .replace(/cpm_increase/g, 'CPM上昇')
            .replace(/日予算/g, '日予算')
            .replace(/CPM/g, 'CPM');
    }
    
    let message = `Meta広告 アラート通知 (${today})
以下のアラートが発生しています：

`;

    if (data.alerts && data.alerts.length > 0) {
        data.alerts.forEach((alert, index) => {
            const translatedMessage = translateAlertTerms(alert.message || alert);
            const category = alert.metric ? getMetricDisplayName(alert.metric) : alert;
            message += `${index + 1}. **${category}**：${translatedMessage}\n`;
        });
    }

    message += `
確認事項：http://localhost:3000/improvement-tasks
改善施策：http://localhost:3000/improvement-strategies

📊 ダッシュボードで詳細を確認してください。
http://localhost:3000/dashboard`;

    return message;
}

// トークン期限警告メッセージ生成
function generateTokenExpiryWarning() {
    return `Meta APIのアクセストークンが2ヶ月経過し更新が必要です。

更新手順
①アクセストークン発行：https://developers.facebook.com/tools/explorer/ 
②長期トークン発行：https://developers.facebook.com/tools/debug/accesstoken/
③設定画面で更新： https://meta-ads-dashboard.onrender.com/setup

トークンが期限切れになると、自動送信機能が停止します。`;
}

// 設定完了メッセージ生成
function generateSetupCompletionMessage() {
    return `[info][title]✅ Meta広告レポートツール設定完了[/title]
Meta広告レポートツールの設定が完了しました。

設定内容:
- Meta広告API: 連携済み
- チャットワーク通知: 有効
- 自動レポート: 設定済み

今後、定期レポートとアラート通知を自動送信いたします。
[/info]`;
}

// スケジュール通知送信
async function sendScheduledChatworkNotification(type, data = {}) {
    try {
        const chatworkConfig = getChatworkConfig();
        
        if (!chatworkConfig || !chatworkConfig.apiToken || !chatworkConfig.roomId) {
            console.log('チャットワーク設定が見つかりません');
            return;
        }
        
        const message = generateMessageByType(type, data);
        
        const response = await fetch('http://localhost:3000/api/send-chatwork-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                apiToken: chatworkConfig.apiToken,
                roomId: chatworkConfig.roomId,
                message: message,
                messageType: type
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ スケジュール通知送信成功');
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        console.error('❌ スケジュール通知送信失敗:', error);
    }
}

// データ取得・保存のみのスケジュール（マルチユーザー対応）
// 朝9時のデータ取得とレポート送信
cron.schedule('0 9 * * *', async () => {
  writeLog('朝9時のデータ取得とレポート送信開始');
  await runBatch(true); // データ取得
  
  // アラートチェック実行
  try {
    writeLog('アラートチェック開始');
    const alerts = await checkAllAlerts();
    writeLog(`アラートチェック完了: ${alerts.length}件のアラート`);
  } catch (error) {
    writeLog('アラートチェックエラー: ' + error.message);
  }
  
  // マルチユーザー日次レポート送信
  try {
    await multiUserSender.sendDailyReportToAllUsers();
  } catch (error) {
    writeLog('マルチユーザー日次レポート送信エラー: ' + error.message);
  }
}, {
  timezone: "Asia/Tokyo"
});

// その他の時間帯のデータ取得と更新通知（12時、15時、17時、19時）
cron.schedule('0 12,15,17,19 * * *', async () => {
  writeLog('定期データ取得と更新通知開始');
  await runBatch(false); // データ取得
  
  // アラートチェック実行
  try {
    writeLog('アラートチェック開始');
    const alerts = await checkAllAlerts();
    writeLog(`アラートチェック完了: ${alerts.length}件のアラート`);
  } catch (error) {
    writeLog('アラートチェックエラー: ' + error.message);
  }
  
  // マルチユーザー更新通知送信
  try {
    await multiUserSender.sendUpdateNotificationToAllUsers();
  } catch (error) {
    writeLog('マルチユーザー更新通知送信エラー: ' + error.message);
  }
}, {
  timezone: "Asia/Tokyo"
});



// スケジューラー開始
console.log('🕐 データ取得スケジューラーを開始しました');
console.log('📊 データ取得: 9時、12時、15時、17時、19時');
console.log('💬 チャットワーク送信: chatworkAutoSender.js で管理');

// node scheduler.js で即時実行できるように
if (require.main === module) {
  writeLog('手動実行開始');
  runBatch().then(async () => {
    // 手動実行時にもアラートチェックを実行
    try {
      writeLog('手動アラートチェック開始');
      const alerts = await checkAllAlerts();
      writeLog(`手動アラートチェック完了: ${alerts.length}件のアラート`);
    } catch (error) {
      writeLog('手動アラートチェックエラー: ' + error.message);
    }
  });
}

module.exports = { sendTestMessage, runBatch };
