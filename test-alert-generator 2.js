// test-alert-generator.js - テスト用アラート生成スクリプト
const fs = require('fs');
const path = require('path');
const UserManager = require('./userManager');

// ユーザー設定から目標値を取得
const getUserTargetValues = (userId) => {
    try {
        const userManager = new UserManager();
        const userSettings = userManager.getUserSettings(userId);
        
        if (!userSettings) {
            console.log(`⚠️ ユーザー ${userId} の設定が見つかりません`);
            return null;
        }
        
        const targets = {};
        
        // 各目標値を取得（設定されている値のみ）
        if (userSettings.target_cpa && userSettings.target_cpa !== '') {
            targets.cpa = parseFloat(userSettings.target_cpa);
        }
        if (userSettings.target_cpm && userSettings.target_cpm !== '') {
            targets.cpm = parseFloat(userSettings.target_cpm);
        }
        if (userSettings.target_ctr && userSettings.target_ctr !== '') {
            targets.ctr = parseFloat(userSettings.target_ctr);
        }
        if (userSettings.target_cv && userSettings.target_cv !== '') {
            targets.cv = parseInt(userSettings.target_cv);
        }
        
        console.log(`📊 ユーザー ${userId} の目標値:`, targets);
        return targets;
        
    } catch (error) {
        console.error('目標値取得エラー:', error);
        return null;
    }
};

// 今日の日付でテストアラートを生成
const generateTestAlerts = () => {
    const now = new Date();
    const alerts = [];
    
    // テスト用ユーザーID（実際のユーザーIDを使用）
    const testUserId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    const targets = getUserTargetValues(testUserId);
    
    if (!targets) {
        console.log('⚠️ ユーザー設定が見つからないため、デフォルト値を使用します');
        // デフォルト値でアラートを生成
        targets.ctr = 1.0;
        targets.cpm = 1500;
    }
    
    // CTRアラート（設定されている場合）
    if (targets.ctr) {
        alerts.push({
            id: `ctr_test_${Date.now()}`,
            userId: testUserId,
            metric: "CTR",
            message: `CTRが目標値${targets.ctr}%を下回っています（現在: 0.6%）`,
            targetValue: targets.ctr,
            currentValue: 0.6,
            severity: 0.6 < targets.ctr * 0.7 ? "critical" : "warning",
            timestamp: now.toISOString(),
            status: "active",
            checkItems: [
                {
                    priority: 1,
                    title: "配信しているクリエイティブが刺さっていないor枯れている",
                    description: "ありきたりのクリエイティブでユーザーに見られていない\n7日間ベースでずっと配信していて、飽きられている"
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
                ],
                "フリークエンシーが2.5%以上ある": [
                    "広告セット内の年齢・性別・エリア・興味関心・カスタムオーディエンス・配信媒体を広げて配信する",
                    "キャンペーンを複製して配信するユーザー層を変える"
                ]
            }
        });
    }
    
    // CPMアラート（設定されている場合）
    if (targets.cpm) {
        const currentCpm = 1800; // テスト用の現在値
        alerts.push({
            id: `cpm_test_${Date.now() + 1}`,
            userId: testUserId,
            metric: "CPM",
            message: `CPMが目標値${targets.cpm.toLocaleString()}円を上回っています（現在: ${currentCpm.toLocaleString()}円）`,
            targetValue: targets.cpm,
            currentValue: currentCpm,
            severity: currentCpm > targets.cpm * 1.3 ? "critical" : "warning",
            timestamp: now.toISOString(),
            status: "active",
            checkItems: [
                {
                    priority: 1,
                    title: "最適なCPM値で配信できていない",
                    description: "クリエイティブが刺さっていないため入力したCPMから乖離している\n配信するユーザー層が悪いため入力したCPMから乖離している"
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
    
    // CPAアラート（設定されている場合）
    if (targets.cpa) {
        const currentCpa = 8500; // テスト用の現在値
        alerts.push({
            id: `cpa_test_${Date.now() + 2}`,
            userId: testUserId,
            metric: "CPA",
            message: `CPAが目標値${targets.cpa.toLocaleString()}円を上回っています（現在: ${currentCpa.toLocaleString()}円）`,
            targetValue: targets.cpa,
            currentValue: currentCpa,
            severity: currentCpa > targets.cpa * 1.3 ? "critical" : "warning",
            timestamp: now.toISOString(),
            status: "active",
            checkItems: [
                {
                    priority: 1,
                    title: "CVRが低下している",
                    description: "広告からLPまでの導線でユーザーが離脱している"
                }
            ],
            improvements: {
                "CVRが低下している": [
                    "LPの改善（ファーストビュー、CTA、フォーム最適化）",
                    "広告とLPの一貫性を確認",
                    "ターゲティングの精度向上"
                ]
            }
        });
    }
    
    console.log(`✅ ${alerts.length}件のテストアラートを生成しました`);
    return alerts;
};

// アラート履歴に追加
const addTestAlerts = () => {
    try {
        const alertHistoryPath = path.join(__dirname, 'alert_history.json');
        let history = [];
        
        // 既存の履歴を読み込み
        if (fs.existsSync(alertHistoryPath)) {
            history = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
            console.log(`📂 既存のアラート履歴: ${history.length}件`);
            
            // 古いアクティブアラートをresolvedに
            history.forEach(alert => {
                if (alert.status === 'active') {
                    alert.status = 'resolved';
                    alert.resolvedAt = new Date().toISOString();
                }
            });
        }
        
        // テストアラートを生成
        const testAlerts = generateTestAlerts();
        console.log(`🔧 テストアラート生成: ${testAlerts.length}件`);
        
        // 追加
        history.push(...testAlerts);
        
        // 保存
        fs.writeFileSync(alertHistoryPath, JSON.stringify(history, null, 2));
        console.log(`✅ アラート履歴を更新しました（総数: ${history.length}件）`);
        
        // 生成したアラートを表示
        testAlerts.forEach(alert => {
            console.log(`  - ${alert.metric}: ${alert.message}`);
        });
        
        return testAlerts;
        
    } catch (error) {
        console.error('❌ エラー:', error);
        return [];
    }
};

// 実行
console.log('=== テストアラート生成開始 ===');
const alerts = addTestAlerts();
console.log('=== 完了 ===');
console.log('\n✅ アラートが生成されました。以下を確認してください：');
console.log('  - http://localhost:3000/alerts （アラート履歴）');
console.log('  - http://localhost:3000/improvement-tasks （確認事項）');
console.log('  - http://localhost:3000/improvement-strategies （改善施策）');