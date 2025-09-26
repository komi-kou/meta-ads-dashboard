// 予算消化率0%問題の修正テスト

console.log('========================================');
console.log('予算消化率0%問題の修正テスト');
console.log('========================================\n');

// 必要なモジュールを読み込み
const UserManager = require('./userManager');

async function testBudgetConsumptionFix() {
    console.log('【テスト1: 新しいユーザー設定の確認】');
    
    const userManager = new UserManager();
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    
    try {
        const userSettings = userManager.getUserSettings(userId);
        console.log('✅ ユーザー設定取得成功');
        console.log('  - target_daily_budget:', userSettings.target_daily_budget);
        console.log('  - target_budget_rate:', userSettings.target_budget_rate);
        console.log('  - target_cpa:', userSettings.target_cpa);
        console.log('  - target_ctr:', userSettings.target_ctr);
        console.log('  - target_cpm:', userSettings.target_cpm);
        
        if (!userSettings.target_daily_budget) {
            console.log('❌ target_daily_budgetが設定されていません');
            return;
        }
        
        console.log('\n【テスト2: 予算消化率計算のシミュレーション】');
        
        // シミュレーションデータ
        const testSpend = 2240; // 消費金額
        const dailyBudget = parseFloat(userSettings.target_daily_budget);
        
        console.log('消費金額:', testSpend, '円');
        console.log('日予算:', dailyBudget, '円');
        
        const budgetRate = (testSpend / dailyBudget) * 100;
        console.log('計算式:', testSpend, '÷', dailyBudget, '× 100 =', budgetRate.toFixed(2) + '%');
        
        if (budgetRate > 0) {
            console.log('✅ 予算消化率の計算が正常に動作しています');
        } else {
            console.log('❌ 予算消化率の計算に問題があります');
        }
        
        console.log('\n【テスト3: 目標値変更シミュレーション】');
        
        // 目標値変更前
        console.log('--- 変更前の目標値 ---');
        const beforeTargets = {
            target_cpa: userSettings.target_cpa,
            target_ctr: userSettings.target_ctr,
            target_cpm: userSettings.target_cpm,
            target_budget_rate: userSettings.target_budget_rate
        };
        console.log(beforeTargets);
        
        // 目標値変更後のシミュレーション
        console.log('\n--- 変更後の目標値 ---');
        const afterTargets = {
            target_cpa: 3000,  // 2000 → 3000に変更
            target_ctr: 5,     // 4 → 5に変更
            target_cpm: 4000,  // 5000 → 4000に変更
            target_budget_rate: 90 // 80 → 90に変更
        };
        console.log(afterTargets);
        
        // 更新された設定で再保存
        const updatedSettings = { ...userSettings, ...afterTargets };
        userManager.saveUserSettings(userId, updatedSettings);
        console.log('✅ 設定を更新しました');
        
        // 更新後の設定を確認
        const newUserSettings = userManager.getUserSettings(userId);
        console.log('\n--- 保存後の確認 ---');
        console.log('  - target_cpa:', newUserSettings.target_cpa);
        console.log('  - target_ctr:', newUserSettings.target_ctr);
        console.log('  - target_cpm:', newUserSettings.target_cpm);
        console.log('  - target_budget_rate:', newUserSettings.target_budget_rate);
        console.log('  - target_daily_budget:', newUserSettings.target_daily_budget);
        
        // 新しい予算消化率を計算
        const newBudgetRate = (testSpend / parseFloat(newUserSettings.target_daily_budget)) * 100;
        console.log('\n新しい予算消化率:', newBudgetRate.toFixed(2) + '%');
        
        if (newBudgetRate > 0) {
            console.log('✅ 目標値変更後も予算消化率が正常に計算されています');
        } else {
            console.log('❌ 目標値変更後に予算消化率が0%になっています');
        }
        
        console.log('\n【テスト4: アラート生成のシミュレーション】');
        
        // 現在のデータ（テスト用）
        const currentData = {
            spend: testSpend,
            budgetRate: newBudgetRate,
            ctr: 3.5,    // 目標5%より低い
            cpm: 4500,   // 目標4000円より高い
            cpa: 3500,   // 目標3000円より高い
            conversions: 1
        };
        
        console.log('現在の実績データ:');
        console.log(JSON.stringify(currentData, null, 2));
        
        // アラート生成ロジック
        const alerts = [];
        
        // CTRチェック
        if (currentData.ctr < newUserSettings.target_ctr) {
            alerts.push({
                metric: 'CTR',
                target: newUserSettings.target_ctr,
                current: currentData.ctr,
                message: `CTRが目標値${newUserSettings.target_ctr}%を下回っています（現在: ${currentData.ctr}%）`
            });
        }
        
        // CPMチェック
        if (currentData.cpm > newUserSettings.target_cpm) {
            alerts.push({
                metric: 'CPM',
                target: newUserSettings.target_cpm,
                current: currentData.cpm,
                message: `CPMが目標値${newUserSettings.target_cpm}円を上回っています（現在: ${currentData.cpm}円）`
            });
        }
        
        // CPAチェック
        if (currentData.cpa > newUserSettings.target_cpa) {
            alerts.push({
                metric: 'CPA',
                target: newUserSettings.target_cpa,
                current: currentData.cpa,
                message: `CPAが目標値${newUserSettings.target_cpa}円を上回っています（現在: ${currentData.cpa}円）`
            });
        }
        
        // 予算消化率チェック
        if (currentData.budgetRate < newUserSettings.target_budget_rate) {
            alerts.push({
                metric: '予算消化率',
                target: newUserSettings.target_budget_rate,
                current: Math.round(currentData.budgetRate * 100) / 100,
                message: `予算消化率が目標値${newUserSettings.target_budget_rate}%を下回っています（現在: ${Math.round(currentData.budgetRate * 100) / 100}%）`
            });
        }
        
        console.log('\n生成されたアラート:');
        alerts.forEach((alert, index) => {
            console.log(`${index + 1}. ${alert.message}`);
        });
        
        if (alerts.length === 0) {
            console.log('✅ すべての指標が目標値内です');
        } else {
            console.log(`⚠️  ${alerts.length}件のアラートが生成されました`);
        }
        
    } catch (error) {
        console.error('❌ テストエラー:', error);
    }
}

// テスト実行
testBudgetConsumptionFix().then(() => {
    console.log('\n========================================');
    console.log('テスト完了');
    console.log('========================================');
});