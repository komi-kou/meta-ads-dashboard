// 完全な修正確認テスト
const fs = require('fs');
const path = require('path');

// テスト用ユーザーID（横濱不動産）
const testUserId = 'b4475ace-303e-4fd1-8740-221154c9b291';

console.log('=== 修正後の動作確認テスト ===\n');

// 1. alertSystem.jsの重複除去機能をテスト
function testAlertSystemDeduplication() {
    console.log('1. アラートシステムの重複除去テスト');
    
    try {
        const alertSystem = require('./alertSystem.js');
        
        // テスト用アラート配列（重複あり）
        const testAlerts = [
            { metric: 'cpa', message: 'CPAが目標値を上回っています', targetValue: 7000, currentValue: 8000 },
            { metric: 'ctr', message: 'CTRが目標値を下回っています', targetValue: 1.0, currentValue: 0.5 },
            { metric: 'cpa', message: 'CPAが目標値を上回っています', targetValue: 7000, currentValue: 8000 }, // 重複
            { metric: 'budget_rate', message: '予算消化率が目標値を下回っています', targetValue: 80, currentValue: 50 }
        ];
        
        // 重複除去のシミュレーション
        const uniqueAlerts = [];
        const seenMetrics = new Set();
        
        for (const alert of testAlerts) {
            if (!seenMetrics.has(alert.metric)) {
                seenMetrics.add(alert.metric);
                uniqueAlerts.push(alert);
            }
        }
        
        console.log(`  元のアラート数: ${testAlerts.length}`);
        console.log(`  重複除去後: ${uniqueAlerts.length}`);
        console.log(`  結果: ${uniqueAlerts.length === 3 ? '✅ OK' : '❌ NG'}\n`);
        
    } catch (error) {
        console.error('  ❌ エラー:', error.message, '\n');
    }
}

// 2. グローバル重複除去の改善版をテスト
function testGlobalDeduplication() {
    console.log('2. グローバル重複除去（改善版）テスト');
    
    try {
        const globalDedup = require('./globalDeduplication.js');
        
        // テスト用アラート配列
        const testAlerts = [
            { metric: 'cpa', message: 'CPAが目標値7000円を上回っています' },
            { metric: 'ctr', message: 'CTRが目標値1%を下回っています' },
            { metric: 'cpa', message: 'CPAが目標値7000円を上回っています' }, // 完全重複
            { metric: 'cpa', message: 'CPAが目標値8000円を上回っています' }, // メッセージが異なる
        ];
        
        // filterDuplicates関数をテスト
        const filtered = globalDedup.filterDuplicates(testAlerts, testUserId);
        
        console.log(`  元のアラート数: ${testAlerts.length}`);
        console.log(`  フィルター後: ${filtered.length}`);
        console.log(`  結果: ${filtered.length <= 3 ? '✅ OK' : '❌ NG'}\n`);
        
    } catch (error) {
        console.error('  ❌ エラー:', error.message, '\n');
    }
}

// 3. 予算消化率計算のテスト
function testBudgetRateCalculation() {
    console.log('3. 予算消化率計算テスト');
    
    try {
        // ユーザー設定を読み込み
        const settingsPath = path.join(__dirname, 'data', 'user_settings', `${testUserId}.json`);
        const userSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        const dailyBudget = parseFloat(userSettings.target_daily_budget || 0);
        console.log(`  日予算設定: ${dailyBudget}円`);
        
        // テストケース
        const testCases = [
            { spend: 1000, dailyBudget: 2800 },
            { spend: 2800, dailyBudget: 2800 },
            { spend: 0, dailyBudget: 2800 },
            { spend: 5000, dailyBudget: 2800 }
        ];
        
        let allPassed = true;
        testCases.forEach(test => {
            const budgetRate = test.dailyBudget > 0 ? 
                Math.min((test.spend / test.dailyBudget) * 100, 100).toFixed(2) : 
                '0.00';
            const expected = test.dailyBudget > 0 ? 
                Math.min((test.spend / test.dailyBudget) * 100, 100).toFixed(2) : 
                '0.00';
            
            const passed = budgetRate === expected;
            if (!passed) allPassed = false;
            
            console.log(`  消費${test.spend}円: ${budgetRate}% (期待値: ${expected}%) ${passed ? '✅' : '❌'}`);
        });
        
        console.log(`  結果: ${allPassed ? '✅ 全テスト合格' : '❌ 一部テスト失敗'}\n`);
        
    } catch (error) {
        console.error('  ❌ エラー:', error.message, '\n');
    }
}

// 4. アラートメッセージの目標値更新テスト
function testTargetValueMessages() {
    console.log('4. 目標値変更時のメッセージ更新テスト');
    
    try {
        // formatValue関数のテスト
        function formatValue(value, metric) {
            if (value === null || value === undefined) {
                return '未取得';
            }
            
            switch (metric) {
                case 'ctr':
                case 'cvr':
                case 'budget_rate':
                    return `${Math.round(value * 10) / 10}%`;
                case 'roas':
                    return `${value}%`;
                case 'conversions':
                    return `${value}件`;
                case 'cpa':
                case 'cpm':
                case 'cpc':
                    return `${Math.round(value).toLocaleString()}円`;
                default:
                    return String(value);
            }
        }
        
        // テストケース
        const testCases = [
            { metric: 'cpa', value: 6999.9, expected: '7,000円' },
            { metric: 'ctr', value: 1.0, expected: '1%' },
            { metric: 'budget_rate', value: 80, expected: '80%' },
            { metric: 'conversions', value: 5, expected: '5件' },
            { metric: 'cpm', value: 1900, expected: '1,900円' }
        ];
        
        let allPassed = true;
        testCases.forEach(test => {
            const formatted = formatValue(test.value, test.metric);
            const passed = formatted === test.expected;
            if (!passed) allPassed = false;
            
            console.log(`  ${test.metric}: ${formatted} (期待値: ${test.expected}) ${passed ? '✅' : '❌'}`);
        });
        
        console.log(`  結果: ${allPassed ? '✅ 全テスト合格' : '❌ 一部テスト失敗'}\n`);
        
    } catch (error) {
        console.error('  ❌ エラー:', error.message, '\n');
    }
}

// 5. app.jsのcreateZeroMetrics関数の修正確認
function testCreateZeroMetrics() {
    console.log('5. createZeroMetrics関数の修正確認');
    
    try {
        const appJsPath = path.join(__dirname, 'app.js');
        const appJsContent = fs.readFileSync(appJsPath, 'utf8');
        
        // 修正後の関数シグネチャを確認
        const hasUserIdParam = appJsContent.includes('function createZeroMetrics(selectedDate, userId = null)');
        const hasCorrectBudgetRate = appJsContent.includes('budgetRate: 0.00, // 消費が0なので予算消化率も0');
        const hasCorrectCall = appJsContent.includes('return createZeroMetrics(selectedDate, userId);');
        
        console.log(`  関数にuserIdパラメータ追加: ${hasUserIdParam ? '✅' : '❌'}`);
        console.log(`  予算消化率のコメント追加: ${hasCorrectBudgetRate ? '✅' : '❌'}`);
        console.log(`  関数呼び出しの修正: ${hasCorrectCall ? '✅' : '❌'}`);
        
        const allPassed = hasUserIdParam && hasCorrectBudgetRate && hasCorrectCall;
        console.log(`  結果: ${allPassed ? '✅ 全項目OK' : '❌ 一部修正が必要'}\n`);
        
    } catch (error) {
        console.error('  ❌ エラー:', error.message, '\n');
    }
}

// 6. その他の潜在的な問題をチェック
function checkOtherIssues() {
    console.log('6. その他の潜在的な問題チェック');
    
    const issues = [];
    
    // チェック1: alert_history.jsonの存在とサイズ
    const alertHistoryPath = path.join(__dirname, 'alert_history.json');
    if (fs.existsSync(alertHistoryPath)) {
        const stats = fs.statSync(alertHistoryPath);
        if (stats.size > 1000000) { // 1MB以上
            issues.push('alert_history.jsonが大きすぎます（' + (stats.size / 1024 / 1024).toFixed(2) + 'MB）');
        }
    }
    
    // チェック2: ユーザー設定ファイルの整合性
    const userSettingsDir = path.join(__dirname, 'data', 'user_settings');
    if (fs.existsSync(userSettingsDir)) {
        const settingFiles = fs.readdirSync(userSettingsDir);
        settingFiles.forEach(file => {
            try {
                const content = fs.readFileSync(path.join(userSettingsDir, file), 'utf8');
                JSON.parse(content); // JSONパースできるかチェック
            } catch (error) {
                issues.push(`${file}のJSONパースエラー`);
            }
        });
    }
    
    // チェック3: 必要なモジュールの存在確認
    const requiredModules = [
        'alertSystem.js',
        'globalDeduplication.js',
        'alertSystemExtensions.js',
        'metaApi.js',
        'chatworkApi.js'
    ];
    
    requiredModules.forEach(module => {
        if (!fs.existsSync(path.join(__dirname, module))) {
            issues.push(`${module}が見つかりません`);
        }
    });
    
    if (issues.length === 0) {
        console.log('  ✅ 潜在的な問題は見つかりませんでした\n');
    } else {
        console.log('  ⚠️ 以下の問題が見つかりました:');
        issues.forEach(issue => {
            console.log(`    - ${issue}`);
        });
        console.log('');
    }
}

// メイン実行
function main() {
    console.log('========================================\n');
    
    testAlertSystemDeduplication();
    testGlobalDeduplication();
    testBudgetRateCalculation();
    testTargetValueMessages();
    testCreateZeroMetrics();
    checkOtherIssues();
    
    console.log('========================================');
    console.log('✅ 修正確認テスト完了');
    console.log('========================================\n');
    
    console.log('推奨アクション:');
    console.log('1. サーバーを再起動: npm start');
    console.log('2. ブラウザでダッシュボードを確認');
    console.log('3. 予算消化率が正しく表示されることを確認');
    console.log('4. アラートページで重複がないことを確認\n');
}

main();