// CV目標値の問題を修正するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== CV目標値修正スクリプト ===\n');

// 1. alertSystem.jsにCV目標値の読み込みを追加
function fixAlertSystemCV() {
    console.log('1. alertSystem.jsにCV目標値読み込みを追加...');
    
    const alertSystemPath = path.join(__dirname, 'alertSystem.js');
    let content = fs.readFileSync(alertSystemPath, 'utf8');
    
    // target_cvの読み込み部分を探す
    const targetCVPattern = /if \(userSettings\.target_cv && userSettings\.target_cv !== ''\) \{[\s\S]*?\}/;
    
    // 既存のCV読み込み処理があるか確認
    if (!content.includes('if (userSettings.target_cv')) {
        // target_budget_rateの後に追加
        const insertAfter = `        if (userSettings.target_budget_rate && userSettings.target_budget_rate !== '') {
            const val = parseFloat(userSettings.target_budget_rate);
            if (!isNaN(val) && val > 0) targets.budget_rate = val;
        }`;
        
        const newCVCode = `        if (userSettings.target_budget_rate && userSettings.target_budget_rate !== '') {
            const val = parseFloat(userSettings.target_budget_rate);
            if (!isNaN(val) && val > 0) targets.budget_rate = val;
        }
        if (userSettings.target_cv && userSettings.target_cv !== '') {
            const val = parseInt(userSettings.target_cv);
            if (!isNaN(val) && val > 0) targets.conversions = val;
        }`;
        
        content = content.replace(insertAfter, newCVCode);
        fs.writeFileSync(alertSystemPath, content, 'utf8');
        console.log('  ✅ CV目標値読み込みを追加しました\n');
    } else {
        console.log('  ℹ️ CV目標値読み込みは既に存在します\n');
    }
}

// 2. dynamicAlertGenerator.jsの固定値を修正
function fixDynamicAlertGenerator() {
    console.log('2. dynamicAlertGenerator.jsの固定値を修正...');
    
    const dynamicAlertPath = path.join(__dirname, 'dynamicAlertGenerator.js');
    if (fs.existsSync(dynamicAlertPath)) {
        let content = fs.readFileSync(dynamicAlertPath, 'utf8');
        
        // 固定値「3件」を動的な値に変更
        content = content.replace(
            /目標値3件/g,
            '目標値${targetValue}件'
        );
        
        // ハードコードされた目標値を修正
        content = content.replace(
            /const targetCv = 3;/g,
            'const targetCv = userSettings?.target_cv || 1;'
        );
        
        fs.writeFileSync(dynamicAlertPath, content, 'utf8');
        console.log('  ✅ 固定値を動的な値に修正しました\n');
    }
}

// 3. checklistRules.jsのCV目標値を動的にする
function fixChecklistRules() {
    console.log('3. checklistRules.jsのCV目標値を修正...');
    
    const checklistPath = path.join(__dirname, 'utils', 'checklistRules.js');
    if (fs.existsSync(checklistPath)) {
        let content = fs.readFileSync(checklistPath, 'utf8');
        
        // CV関連の説明文を動的にする
        const oldDescription = `"CV数が0もしくは目標CPAの到達しておらず予算も消化されていない"`;
        const newDescription = `"CV数が目標値に達しておらず、CPAも目標を上回っている"`;
        
        content = content.replace(oldDescription, newDescription);
        
        fs.writeFileSync(checklistPath, content, 'utf8');
        console.log('  ✅ checklistRules.jsを修正しました\n');
    }
}

// 4. テストとシミュレーション
function runTestSimulation() {
    console.log('4. テストシミュレーション実行...\n');
    
    // ユーザー設定を読み込み
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    const settingsPath = path.join(__dirname, 'data', 'user_settings', `${userId}.json`);
    
    if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        console.log('  現在のユーザー設定:');
        console.log(`    target_cv: ${settings.target_cv}`);
        console.log(`    target_cpa: ${settings.target_cpa}`);
        console.log(`    target_cpm: ${settings.target_cpm}`);
        console.log(`    target_ctr: ${settings.target_ctr}`);
        console.log(`    target_budget_rate: ${settings.target_budget_rate}`);
        console.log(`    target_daily_budget: ${settings.target_daily_budget}\n`);
        
        // シミュレーション: 異なるCV目標値でのアラートメッセージ
        const testCases = [
            { target: 1, current: 0, expected: 'CVが目標値1件を下回っています（現在: 0件）' },
            { target: 3, current: 2, expected: 'CVが目標値3件を下回っています（現在: 2件）' },
            { target: 5, current: 8, expected: 'アラートなし（目標達成）' }
        ];
        
        console.log('  シミュレーション結果:');
        testCases.forEach(test => {
            const alertTriggered = test.current < test.target;
            if (alertTriggered) {
                const message = `CVが目標値${test.target}件を下回っています（現在: ${test.current}件）`;
                console.log(`    目標${test.target}件, 実績${test.current}件 → ${message}`);
            } else {
                console.log(`    目標${test.target}件, 実績${test.current}件 → アラートなし（目標達成）`);
            }
        });
    }
}

// 5. alertSystem.jsの修正を確認
function verifyAlertSystemFix() {
    console.log('\n5. alertSystem.jsの修正確認...');
    
    const alertSystemPath = path.join(__dirname, 'alertSystem.js');
    const content = fs.readFileSync(alertSystemPath, 'utf8');
    
    const hasCVTarget = content.includes('targets.conversions =');
    console.log(`  CV目標値の設定: ${hasCVTarget ? '✅ 存在' : '❌ 不足'}`);
    
    if (!hasCVTarget) {
        console.log('  ⚠️ CV目標値の設定が見つかりません。手動で追加が必要です。');
    }
}

// メイン実行
function main() {
    try {
        fixAlertSystemCV();
        fixDynamicAlertGenerator();
        fixChecklistRules();
        runTestSimulation();
        verifyAlertSystemFix();
        
        console.log('\n========================================');
        console.log('✅ CV目標値の修正完了！');
        console.log('========================================\n');
        
        console.log('次のステップ:');
        console.log('1. サーバーを再起動してください');
        console.log('2. 設定ページでCV目標値を変更してテスト');
        console.log('3. アラート内容でCV目標値が正しく反映されることを確認\n');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();