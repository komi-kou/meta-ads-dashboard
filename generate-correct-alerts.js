// generate-correct-alerts.js - 正しい目標値でアラートを生成
const fs = require('fs');
const path = require('path');

// ユーザー設定ファイルから実際の目標値を読み込む
const userSettingsPath = path.join(__dirname, 'data', 'user_settings', 'b4475ace-303e-4fd1-8740-221154c9b291.json');
let userSettings = {};
try {
    userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
} catch (error) {
    console.error('ユーザー設定ファイル読み込みエラー:', error);
}

// 実際の目標値（ユーザー設定から取得、実際の値を使用）
const userTargets = {
    target_budget_rate: userSettings.target_budget_rate || 80,
    target_daily_budget: userSettings.target_daily_budget || 2800,
    target_ctr: userSettings.target_ctr || 1.0,
    target_cpm: userSettings.target_cpm || 1500,
    target_cpa: userSettings.target_cpa || 7000,
    target_cv: userSettings.target_cv || 1
};

// 実際の仮想データ（目標から外れた値）
const currentData = {
    budget_rate: 51.5,    // 実際の予算消化率（1443÷2800）
    daily_budget: 2800,   // 実際の日予算
    ctr: 0.6,            // 目標1.0%を下回る
    cpm: 1526,           // 目標1500円を上回る
    cpa: null,           // CV=0の場合、CPAは計算不可
    cv: 0                // 目標1件を下回る
};

// アラート生成
const alerts = [];
const timestamp = new Date().toISOString();

// CTRアラート（目標を下回る）
if (currentData.ctr < userTargets.target_ctr) {
    alerts.push({
        id: `ctr_${Date.now()}`,
        userId: "b4475ace-303e-4fd1-8740-221154c9b291",
        metric: "CTR",
        message: `CTRが目標値${userTargets.target_ctr}%を下回っています（現在: ${currentData.ctr}%）`,
        targetValue: userTargets.target_ctr,
        currentValue: currentData.ctr,
        severity: "warning",
        timestamp: timestamp,
        status: "active",
        checkItems: [
            {
                priority: 1,
                title: "配信しているクリエイティブが刺さっていないor枯れている",
                description: "ありきたりのクリエイティブでユーザーに見られていない"
            },
            {
                priority: 2,
                title: "フリークエンシーが2.5%以上ある",
                description: "同じユーザーばかりに配信されていて、見飽きられている"
            }
        ],
        improvements: {
            "配信しているクリエイティブが刺さっていないor枯れている": [
                "過去7日間ベースで予算が寄っておらずCVも取れていないクリエイティブを差し替える",
                "過去7日間ベースで予算は寄っているけど目標CPAに達しておらずクリック率も目標以下のクリエイティブは差し替える"
            ]
        }
    });
}

// CPMアラート（目標を上回る）
if (currentData.cpm > userTargets.target_cpm) {
    alerts.push({
        id: `cpm_${Date.now() + 1}`,
        userId: "b4475ace-303e-4fd1-8740-221154c9b291",
        metric: "CPM",
        message: `CPMが目標値${userTargets.target_cpm}円を上回っています（現在: ${currentData.cpm}円）`,
        targetValue: userTargets.target_cpm,
        currentValue: currentData.cpm,
        severity: "warning",
        timestamp: timestamp,
        status: "active",
        checkItems: [
            {
                priority: 1,
                title: "最適なCPM値で配信できていない",
                description: "クリエイティブが刺さっていないため入力したCPMから乖離している"
            }
        ],
        improvements: {
            "最適なCPM値で配信できていない": [
                "過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える",
                "広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する",
                "キャンペーンを複製する"
            ]
        }
    });
}

// CPAアラート（CV>0の場合のみ計算可能）
// CV=0の場合、CPAは計算できないため、CVアラートで対応
if (currentData.cv > 0 && currentData.cpa && currentData.cpa > userTargets.target_cpa) {
    alerts.push({
        id: `cpa_${Date.now() + 2}`,
        userId: "b4475ace-303e-4fd1-8740-221154c9b291",
        metric: "CPA",
        message: `CPAが目標値${userTargets.target_cpa}円を上回っています（現在: ${currentData.cpa}円）`,
        targetValue: userTargets.target_cpa,
        currentValue: currentData.cpa,
        severity: "critical",
        timestamp: timestamp,
        status: "active",
        checkItems: [
            {
                priority: 1,
                title: "クリエイティブが刺さっていないorクリエイティブが枯れている",
                description: "入口のクリエイティブで魅力的に魅せれていないor飽きられてしまっている"
            },
            {
                priority: 2,
                title: "配信するユーザー層がズレている",
                description: "購入見込みの低いユーザーに配信されている"
            }
        ],
        improvements: {
            "クリエイティブが刺さっていないorクリエイティブが枯れている": [
                "過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える",
                "訴求軸が違うクリエイティブを配信する",
                "動画広告を配信する"
            ],
            "配信するユーザー層がズレている": [
                "広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を狭めて配信する",
                "類似オーディエンスを活用して、見込み層の高いユーザーに配信する"
            ]
        }
    });
}

// CVアラート（目標を下回る）
if (currentData.cv < userTargets.target_cv) {
    alerts.push({
        id: `cv_${Date.now() + 3}`,
        userId: "b4475ace-303e-4fd1-8740-221154c9b291",
        metric: "CV",
        message: `CV数が目標値${userTargets.target_cv}件を下回っています（現在: ${currentData.cv}件）`,
        targetValue: userTargets.target_cv,
        currentValue: currentData.cv,
        severity: "critical",
        timestamp: timestamp,
        status: "active",
        checkItems: [
            {
                priority: 1,
                title: "クリエイティブが刺さっていないorクリエイティブが枯れている",
                description: "入口のクリエイティブで魅力的に魅せれていないor飽きられてしまっている"
            },
            {
                priority: 2,
                title: "LPで離脱されている",
                description: "LPの内容がユーザーに刺さっていない"
            }
        ],
        improvements: {
            "クリエイティブが刺さっていないorクリエイティブが枯れている": [
                "過去7日間ベースでCV数が獲得できていない、CPAが高騰しているクリエイティブを差し替える",
                "過去7日間ベースでCVがついておらず配信が寄っていない（予算消化ができていない）クリエイティブを差し替える"
            ],
            "LPで離脱されている": [
                "ヒートマップを導入して離脱箇所が多いところを改善する（clarityがおすすめ）",
                "CTAの文言・デザイン・アクションを変更する",
                "FVを改善する"
            ]
        }
    });
}

// 予算消化率アラート（目標を下回る）
if (currentData.budget_rate < userTargets.target_budget_rate) {
    alerts.push({
        id: `budget_rate_${Date.now() + 4}`,
        userId: "b4475ace-303e-4fd1-8740-221154c9b291",
        metric: "予算消化率",
        message: `予算消化率が目標値${userTargets.target_budget_rate}%を下回っています（現在: ${currentData.budget_rate}%）`,
        targetValue: userTargets.target_budget_rate,
        currentValue: currentData.budget_rate,
        severity: "warning",
        timestamp: timestamp,
        status: "active",
        checkItems: [
            {
                priority: 1,
                title: "配信されているか確認",
                description: "広告がアクティブになっているか"
            },
            {
                priority: 2,
                title: "配信するクリエイティブが枯れている",
                description: "CV数が0もしくは目標CPAの到達しておらず予算も消化されていない"
            }
        ],
        improvements: {
            "配信されているか確認": [
                "管理画面の上の運用しているキャンペーンが緑でアクティブになっているか、キャンペーンを確認する",
                "決済ができておらず配信エラーになっていないか、請求と支払いを確認する"
            ],
            "配信するクリエイティブが枯れている": [
                "過去7日間ベースでCV数が0もしくは目標CPAに達していないクリエイティブを差し替える"
            ]
        }
    });
}

// アラート履歴ファイルに保存
const historyPath = path.join(__dirname, 'alert_history.json');
fs.writeFileSync(historyPath, JSON.stringify(alerts, null, 2));

console.log('✅ 正しい目標値でアラートを生成しました');
console.log('生成されたアラート:');
alerts.forEach(alert => {
    console.log(`- ${alert.metric}: 目標${alert.targetValue} → 現在${alert.currentValue}`);
});