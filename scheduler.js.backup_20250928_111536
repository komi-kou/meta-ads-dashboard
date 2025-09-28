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

// Phase 1.3: 排他制御用のロックファイル
const LOCK_FILE = path.join(__dirname, 'scheduler.lock');

// ロックを取得
function acquireLock(taskName) {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const lockData = JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'));
      const lockAge = Date.now() - lockData.timestamp;
      // 5分以上経過したロックは無効とみなす
      if (lockAge < 5 * 60 * 1000) {
        console.log(`🔒 既に実行中のため${taskName}をスキップ: ${lockData.task}`);
        return false;
      }
    }
    fs.writeFileSync(LOCK_FILE, JSON.stringify({
      task: taskName,
      timestamp: Date.now(),
      pid: process.pid
    }));
    return true;
  } catch (error) {
    console.error('ロック取得エラー:', error);
    return false;
  }
}

// ロックを解放
function releaseLock() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      fs.unlinkSync(LOCK_FILE);
    }
  } catch (error) {
    console.error('ロック解放エラー:', error);
  }
}

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

// 設定情報を取得する関数（マルチユーザー対応版）
function getSettings(userId = null) {
  // 優先順位1: ユーザー個別設定
  if (userId) {
    try {
      const UserManager = require('./userManager');
      const userManager = new UserManager();
      const userSettings = userManager.getUserSettings(userId);
      
      if (userSettings) {
        // ユーザー設定を共通フォーマットに変換
        const convertedSettings = {
          // Meta API設定
          meta_token: userSettings.meta_access_token,
          meta_account_id: userSettings.meta_account_id,
          meta_app_id: userSettings.meta_app_id || '',
          
          // チャットワーク設定
          chatwork_token: userSettings.chatwork_api_token,
          chatwork_room_id: userSettings.chatwork_room_id,
          
          // その他の設定
          daily_budget: userSettings.target_daily_budget,
          service_goal: userSettings.service_goal,
          target_cpa: userSettings.target_cpa,
          target_cpm: userSettings.target_cpm,
          target_ctr: userSettings.target_ctr,
          target_budget_rate: userSettings.target_budget_rate,
          target_cv: userSettings.target_cv,
          
          // スケジューラー設定
          enable_scheduler: userSettings.enable_scheduler,
          enable_chatwork: userSettings.enable_chatwork,
          enable_alerts: userSettings.enable_alerts
        };
        
        writeLog(`ユーザー設定読み込み完了 (userId: ${userId}): Meta=${!!convertedSettings.meta_token}, Chatwork=${!!convertedSettings.chatwork_token}`);
        return convertedSettings;
      }
    } catch (e) {
      writeLog(`ユーザー設定読み込みエラー: ${e.message}`);
    }
  }
  
  // 優先順位2: 本番環境では環境変数から設定を取得
  if (process.env.NODE_ENV === 'production') {
    return getEnvironmentSettings();
  }
  
  // 優先順位3: 共通設定ファイル（後方互換性）
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
      
      writeLog(`共通設定読み込み完了: Meta=${!!convertedSettings.meta_token}, Chatwork=${!!convertedSettings.chatwork_token}`);
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

// バッチ本体処理を関数化（ユーザーIDを受け取るように修正）
// 第3引数 sendNotification を追加（デフォルトはtrue for 後方互換性）
async function runBatch(isMorningReport = false, userId = null, sendNotification = true) {
  writeLog(`=== 日次バッチ開始 ${userId ? `(userId: ${userId})` : '(共通設定)'} ===`);
  
  // 設定を取得（ユーザーIDを渡す）
  const settings = getSettings(userId);
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

    // --- 主な数値のChatwork自動通知（sendNotificationフラグで制御） ---
    if (sendNotification && settings.chatwork_token && settings.chatwork_room_id) {
      const d = statsArr[0];
      
      // URL動的生成を使用
      const { getDashboardUrl } = require('./utils/urlHelper');
      const dashboardUrl = getDashboardUrl(userId);
      
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
        msg = `広告データを更新しました。\nご確認ください。\n\n▼確認URL\n${dashboardUrl}\n\n日付: ${d.date || d.date_start || ''}\n消化金額: ${formatNumber(d.spend)}円\nCV: ${d.cv || 0}\nCPA: ${d.cpa && d.cpa > 0 ? formatNumber(d.cpa) + '円' : '計算不可'}\nCTR: ${formatPercentage(d.ctr, 2)}%\nCPM: ${formatNumber(d.cpm ? d.cpm / 10 : 0)}円\n予算消化率: ${formatPercentage(d.budgetRate, 0)}%`;
      } else {
        // その他の時間帯は簡素化版
        msg = `広告データを更新しました。\nご確認ください。\n\n▼ご確認URL\n${dashboardUrl}`;
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
      if (!sendNotification) {
        writeLog('通知フラグがfalseのため通知をスキップ');
      } else {
        writeLog('Chatwork設定が未設定のため通知をスキップ');
      }
    }

    // アラート判定は alertSystem.checkAllAlerts() に統一
    // 重複判定を防ぐため、ここでのアラート判定を削除
    writeLog('アラート判定は checkAllAlerts() で統一処理します');
    
    // 以下の大量のアラート判定コードは削除済み
    // アラートの判定と保存はalertSystem.jsに統一
    
  } catch (error) {
    writeLog(`バッチ処理エラー: ${error.message}`);
    console.error('バッチ処理エラー詳細:', error);
  }
  
  writeLog('=== 日次バッチ完了 ===');
}

// 全ユーザーに対してバッチを実行する関数
// 第2引数 sendNotification を追加（デフォルトはtrue for 後方互換性）
async function runBatchForAllUsers(isMorningReport = false, sendNotification = true) {
  writeLog('=== 全ユーザーバッチ処理開始 ===');
  
  try {
    const UserManager = require('./userManager');
    const userManager = new UserManager();
    const allUsers = userManager.getAllUsers();
    
    writeLog(`アクティブユーザー数: ${allUsers.length}`);
    
    // 各ユーザーに対してバッチを実行
    for (const user of allUsers) {
      const userSettings = userManager.getUserSettings(user.id);
      
      // スケジューラーが有効なユーザーのみ処理
      if (userSettings && userSettings.enable_scheduler) {
        writeLog(`ユーザー ${user.id} (${user.email}) のバッチ処理開始`);
        // sendNotificationフラグを渡す
        await runBatch(isMorningReport, user.id, sendNotification);
      } else {
        writeLog(`ユーザー ${user.id} はスケジューラー無効のためスキップ`);
      }
    }
    
    writeLog('=== 全ユーザーバッチ処理完了 ===');
  } catch (error) {
    writeLog(`全ユーザーバッチ処理エラー: ${error.message}`);
    // エラーが発生しても共通設定で実行を試みる
    writeLog('共通設定でバッチ実行を試みます');
    await runBatch(isMorningReport, null, sendNotification);
  }
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
👆 CTR: ${data.ctr ? parseFloat(data.ctr).toFixed(2) : '0.00'}%
💵 CPM: ${data.cpm?.toLocaleString() || 0}円
🎯 CV数: ${data.conversions || 0}件
💰 CPA: ${data.cpa && data.cpa > 0 ? data.cpa.toLocaleString() + '円' : '計算不可'}
🔄 フリークエンシー: ${data.frequency ? parseFloat(data.frequency).toFixed(2) : '0.00'}

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

// ExecutionManagerをインポート
const executionManager = require('./utils/executionManager');

// データ取得・保存のみのスケジュール（マルチユーザー対応）
// 朝9時のデータ取得とレポート送信
cron.schedule('0 9 * * *', async () => {
  // Phase 1.3: 排他制御を追加
  if (!acquireLock('morning_9am_batch')) {
    return;
  }
  
  try {
    writeLog('朝9時のデータ取得とレポート送信開始');
    
    // データ取得（通知なし）
    await executionManager.executeGlobalTask('morning_data_fetch', async () => {
    await runBatchForAllUsers(true, false); // 朝レポートモード、通知なし
    
    // 統一アラートチェック実行（9時のみ）
    try {
      writeLog('統一アラートチェック開始');
      const alerts = await checkAllAlerts();
      writeLog(`統一アラートチェック完了: ${alerts.length}件のアラート`);
    } catch (error) {
      writeLog('統一アラートチェックエラー: ' + error.message);
    }
  });
  
  // マルチユーザー日次レポート送信（重複防止付き）
  await executionManager.executeGlobalTask('morning_daily_report', async () => {
    try {
      await multiUserSender.sendDailyReportToAllUsers();
    } catch (error) {
      writeLog('マルチユーザー日次レポート送信エラー: ' + error.message);
    }
  });
  
  // マルチユーザーアラート通知送信（9時）
  await executionManager.executeGlobalTask('morning_alert_notification', async () => {
    try {
      writeLog('朝9時のアラート通知送信開始');
      await multiUserSender.sendAlertNotificationToAllUsers();
      writeLog('朝9時のアラート通知送信完了');
    } catch (error) {
      writeLog('マルチユーザーアラート通知送信エラー: ' + error.message);
    }
  });
  } finally {
    releaseLock();
  }
}, {
  timezone: "Asia/Tokyo"
});

// その他の時間帯のデータ取得と更新通知（12時、15時、17時、19時）
cron.schedule('0 12,15,17,19 * * *', async () => {
  // Phase 1.3: 排他制御を追加
  const currentHour = new Date().getHours();
  if (!acquireLock(`regular_${currentHour}_batch`)) {
    return;
  }
  
  try {
    writeLog('定期データ取得と更新通知開始');
  
  // データ取得（通知なし）
  await executionManager.executeGlobalTask('regular_data_fetch', async () => {
    await runBatchForAllUsers(false, false); // 通常モード、通知なし
    
    // アラートチェック実行
    try {
      writeLog('アラートチェック開始');
      const alerts = await checkAllAlerts();
      writeLog(`アラートチェック完了: ${alerts.length}件のアラート`);
    } catch (error) {
      writeLog('アラートチェックエラー: ' + error.message);
    }
  });
  
  // マルチユーザー更新通知送信（重複防止付き）
  await executionManager.executeGlobalTask('update_notification', async () => {
    try {
      await multiUserSender.sendUpdateNotificationToAllUsers();
    } catch (error) {
      writeLog('マルチユーザー更新通知送信エラー: ' + error.message);
    }
  });
  
  // マルチユーザーアラート通知送信（12時、15時、17時、19時）
  await executionManager.executeGlobalTask('regular_alert_notification', async () => {
    try {
      const currentHour = new Date().getHours();
      writeLog(`${currentHour}時のアラート通知送信開始`);
      await multiUserSender.sendAlertNotificationToAllUsers();
      writeLog(`${currentHour}時のアラート通知送信完了`);
    } catch (error) {
      writeLog('マルチユーザーアラート通知送信エラー: ' + error.message);
    }
  });
  } finally {
    releaseLock();
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
  runBatchForAllUsers().then(async () => {
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
