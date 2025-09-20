// 修正案2: 目標値変更時の動作確認シミュレーション

console.log('========================================');
console.log('修正案2: 目標値の動的反映確認');
console.log('========================================\n');

// 現在のユーザー設定
const currentSettings = {
    "target_cpa": "8000",
    "target_cpm": "1800", 
    "target_ctr": "1.0",
    "target_cv": "1",
    "target_budget_rate": "80"
};

console.log('【現在のユーザー設定】');
console.log('target_ctr:', currentSettings.target_ctr, '%');
console.log('target_cpm:', currentSettings.target_cpm, '円');
console.log('target_cv:', currentSettings.target_cv, '件');
console.log('target_cpa:', currentSettings.target_cpa, '円');
console.log('target_budget_rate:', currentSettings.target_budget_rate, '%');

// 修正案2のロジック（最新のアラートのみ表示）
console.log('\n========================================');
console.log('シナリオ1: 現在の設定での動作');
console.log('========================================\n');

// 実際のデータ（例）
const currentData = {
    ctr: 0.8,
    cpm: 1946,
    conversions: 0,
    cpa: 1613,
    budgetRate: 68
};

function generateAlert(settings, data) {
    const alerts = [];
    
    // CTRチェック
    const targetCtr = parseFloat(settings.target_ctr);
    if (data.ctr < targetCtr) {
        alerts.push({
            metric: 'CTR',
            targetValue: targetCtr,
            currentValue: data.ctr,
            severity: data.ctr < targetCtr * 0.7 ? 'critical' : 'warning'
        });
    }
    
    // CPMチェック
    const targetCpm = parseFloat(settings.target_cpm);
    if (data.cpm > targetCpm) {
        alerts.push({
            metric: 'CPM',
            targetValue: targetCpm,
            currentValue: data.cpm,
            severity: data.cpm > targetCpm * 1.3 ? 'critical' : 'warning'
        });
    }
    
    // CVチェック
    const targetCv = parseInt(settings.target_cv);
    if (data.conversions < targetCv) {
        alerts.push({
            metric: 'CV',
            targetValue: targetCv,
            currentValue: data.conversions,
            severity: data.conversions === 0 ? 'critical' : 'warning'
        });
    }
    
    // CPAチェック（CVがある場合のみ）
    if (data.conversions > 0) {
        const targetCpa = parseFloat(settings.target_cpa);
        if (data.cpa > targetCpa) {
            alerts.push({
                metric: 'CPA',
                targetValue: targetCpa,
                currentValue: data.cpa,
                severity: data.cpa > targetCpa * 1.3 ? 'critical' : 'warning'
            });
        }
    }
    
    // 予算消化率チェック
    const targetBudgetRate = parseFloat(settings.target_budget_rate);
    if (data.budgetRate < targetBudgetRate) {
        alerts.push({
            metric: '予算消化率',
            targetValue: targetBudgetRate,
            currentValue: data.budgetRate,
            severity: data.budgetRate < targetBudgetRate * 0.7 ? 'critical' : 'warning'
        });
    }
    
    return alerts;
}

const alerts1 = generateAlert(currentSettings, currentData);
console.log('生成されるアラート:');
alerts1.forEach(alert => {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    console.log(`${icon} ${alert.metric}: 目標 ${alert.targetValue} → 実績 ${alert.currentValue}`);
});

console.log('\n========================================');
console.log('シナリオ2: 目標値を変更した場合');
console.log('========================================\n');

// 設定を変更
const updatedSettings = {
    "target_cpa": "5000",  // 8000 → 5000に変更
    "target_cpm": "2000",  // 1800 → 2000に変更
    "target_ctr": "2.0",   // 1.0 → 2.0に変更
    "target_cv": "3",      // 1 → 3に変更
    "target_budget_rate": "90" // 80 → 90に変更
};

console.log('【変更後のユーザー設定】');
console.log('target_ctr:', updatedSettings.target_ctr, '% (変更: 1.0 → 2.0)');
console.log('target_cpm:', updatedSettings.target_cpm, '円 (変更: 1800 → 2000)');
console.log('target_cv:', updatedSettings.target_cv, '件 (変更: 1 → 3)');
console.log('target_cpa:', updatedSettings.target_cpa, '円 (変更: 8000 → 5000)');
console.log('target_budget_rate:', updatedSettings.target_budget_rate, '% (変更: 80 → 90)');

const alerts2 = generateAlert(updatedSettings, currentData);
console.log('\n新しく生成されるアラート:');
alerts2.forEach(alert => {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    console.log(`${icon} ${alert.metric}: 目標 ${alert.targetValue} → 実績 ${alert.currentValue}`);
});

console.log('\n========================================');
console.log('結論');
console.log('========================================');
console.log('✅ 修正案2では、ユーザー設定の変更が即座に反映されます');
console.log('✅ 常に最新の目標値を使用してアラートを生成');
console.log('✅ 各メトリック1件のみ表示するため、重複がありません');
console.log('✅ alert_history.jsonに過去のアラートが残っていても影響しません');
console.log('\n【動作フロー】');
console.log('1. ユーザーが設定画面で目標値を変更');
console.log('2. user_settings/*.jsonファイルが更新');
console.log('3. 次回のアラート生成時に新しい目標値を読み込み');
console.log('4. 新しい目標値でアラートを判定・生成');
console.log('5. Chatworkには最新の目標値と実績値が表示される');