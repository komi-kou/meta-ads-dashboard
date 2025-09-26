// ダッシュボード問題修正テスト
const fs = require('fs');
const path = require('path');

// テスト用ユーザーID（横濱不動産）
const testUserId = 'b4475ace-303e-4fd1-8740-221154c9b291';

// ユーザー設定読み込み
function getUserSettings(userId) {
    try {
        const settingsPath = path.join(__dirname, 'data', 'user_settings', `${userId}.json`);
        if (fs.existsSync(settingsPath)) {
            return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
    } catch (error) {
        console.error('ユーザー設定読み込みエラー:', error);
    }
    return null;
}

// 予算消化率計算テスト
function testBudgetRateCalculation() {
    console.log('\n=== 予算消化率計算テスト ===\n');
    
    const userSettings = getUserSettings(testUserId);
    console.log('ユーザー設定:', userSettings);
    
    if (!userSettings) {
        console.error('❌ ユーザー設定が見つかりません');
        return;
    }
    
    const dailyBudget = parseFloat(userSettings.target_daily_budget || 0);
    console.log('日予算設定値:', dailyBudget, '円');
    
    // テストケース
    const testCases = [
        { spend: 1000, expected: (1000/2800*100).toFixed(2) },
        { spend: 2800, expected: (2800/2800*100).toFixed(2) },
        { spend: 3000, expected: Math.min(3000/2800*100, 100).toFixed(2) }
    ];
    
    console.log('\nテストケース実行:');
    testCases.forEach(test => {
        const budgetRate = dailyBudget > 0 ? 
            Math.min((test.spend / dailyBudget) * 100, 100).toFixed(2) : 
            '0.00';
        
        console.log(`消費額: ${test.spend}円`);
        console.log(`  期待値: ${test.expected}%`);
        console.log(`  計算値: ${budgetRate}%`);
        console.log(`  結果: ${budgetRate === test.expected ? '✅ OK' : '❌ NG'}`);
    });
}

// アラート重複チェック
function testAlertDuplication() {
    console.log('\n=== アラート重複チェックテスト ===\n');
    
    // サンプルアラート
    const alerts = [
        { metric: 'cpa', message: 'CPAが目標値を上回っています' },
        { metric: 'ctr', message: 'CTRが目標値を下回っています' },
        { metric: 'cpa', message: 'CPAが目標値を上回っています' }, // 重複
        { metric: 'cpm', message: 'CPMが目標値を上回っています' },
        { metric: 'ctr', message: 'CTRが目標値を下回っています' }  // 重複
    ];
    
    console.log('元のアラート数:', alerts.length);
    
    // 重複除去
    const uniqueAlerts = [];
    const seenMetrics = new Set();
    
    for (const alert of alerts) {
        if (!seenMetrics.has(alert.metric)) {
            seenMetrics.add(alert.metric);
            uniqueAlerts.push(alert);
        } else {
            console.log(`  重複スキップ: ${alert.metric}`);
        }
    }
    
    console.log('重複除去後のアラート数:', uniqueAlerts.length);
    console.log('ユニークなメトリック:', Array.from(seenMetrics));
}

// 目標値更新テスト
function testTargetValueUpdate() {
    console.log('\n=== 目標値更新テスト ===\n');
    
    const userSettings = getUserSettings(testUserId);
    
    if (!userSettings) {
        console.error('❌ ユーザー設定が見つかりません');
        return;
    }
    
    // 現在の目標値
    const currentTargets = {
        cpa: parseFloat(userSettings.target_cpa || 0),
        cpm: parseFloat(userSettings.target_cpm || 0),
        ctr: parseFloat(userSettings.target_ctr || 0),
        budget_rate: parseFloat(userSettings.target_budget_rate || 0)
    };
    
    console.log('現在の目標値:');
    Object.entries(currentTargets).forEach(([metric, value]) => {
        console.log(`  ${metric}: ${value}`);
    });
    
    // アラートメッセージ更新シミュレーション
    const alerts = [
        { 
            metric: 'cpa', 
            targetValue: 5000,
            message: 'CPAが目標値5000円を上回っています'
        },
        { 
            metric: 'ctr', 
            targetValue: 1.5,
            message: 'CTRが目標値1.5%を下回っています'
        }
    ];
    
    console.log('\nアラートメッセージ更新:');
    alerts.forEach(alert => {
        const newTarget = currentTargets[alert.metric];
        if (newTarget && newTarget !== alert.targetValue) {
            let unit = '';
            if (alert.metric === 'cpa' || alert.metric === 'cpm') {
                unit = '円';
            } else if (alert.metric === 'ctr' || alert.metric === 'budget_rate') {
                unit = '%';
            }
            
            const oldMessage = alert.message;
            const newMessage = oldMessage.replace(
                /目標値[\d,\.]+[円%]/g,
                `目標値${newTarget}${unit}`
            );
            
            console.log(`  ${alert.metric}:`);
            console.log(`    旧: ${oldMessage}`);
            console.log(`    新: ${newMessage}`);
        }
    });
}

// グローバル重複除去テスト
function testGlobalDeduplication() {
    console.log('\n=== グローバル重複除去テスト ===\n');
    
    // GlobalDeduplicationManagerの簡易実装
    class SimpleDeduplication {
        constructor() {
            this.sentAlerts = new Map();
        }
        
        isAlreadySent(metric) {
            const now = new Date();
            const hour = now.getHours();
            const dateKey = now.toISOString().split('T')[0];
            const uniqueKey = `${dateKey}_${hour}_${metric}`;
            
            if (this.sentAlerts.has(uniqueKey)) {
                const sentTime = this.sentAlerts.get(uniqueKey);
                const timeDiff = now - sentTime;
                
                if (timeDiff < 3600000) { // 1時間以内
                    return true;
                }
            }
            return false;
        }
        
        markAsSent(metric) {
            const now = new Date();
            const hour = now.getHours();
            const dateKey = now.toISOString().split('T')[0];
            const uniqueKey = `${dateKey}_${hour}_${metric}`;
            this.sentAlerts.set(uniqueKey, now);
        }
    }
    
    const dedup = new SimpleDeduplication();
    
    // テストシナリオ
    const metrics = ['cpa', 'ctr', 'cpm'];
    
    console.log('初回送信チェック:');
    metrics.forEach(metric => {
        const isDuplicate = dedup.isAlreadySent(metric);
        console.log(`  ${metric}: ${isDuplicate ? '重複' : '新規'}`);
        if (!isDuplicate) {
            dedup.markAsSent(metric);
        }
    });
    
    console.log('\n2回目送信チェック（同一時間内）:');
    metrics.forEach(metric => {
        const isDuplicate = dedup.isAlreadySent(metric);
        console.log(`  ${metric}: ${isDuplicate ? '重複' : '新規'}`);
    });
}

// メイン実行
function main() {
    console.log('========================================');
    console.log('ダッシュボード問題診断テスト');
    console.log('========================================');
    
    testBudgetRateCalculation();
    testAlertDuplication();
    testTargetValueUpdate();
    testGlobalDeduplication();
    
    console.log('\n========================================');
    console.log('テスト完了');
    console.log('========================================');
}

main();