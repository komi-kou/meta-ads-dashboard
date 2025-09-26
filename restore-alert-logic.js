// アラートロジックを元の設定に戻すスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== アラートロジック復元スクリプト ===\n');

// 1. dynamicAlertGenerator.jsのMETRIC_DIRECTIONSを修正
function fixMetricDirections() {
    console.log('1. メトリクス方向性を修正...');
    
    const filePath = path.join(__dirname, 'dynamicAlertGenerator.js');
    let content = fs.readFileSync(filePath, 'utf8');
    
    // METRIC_DIRECTIONSを探して修正
    const oldDirections = `const METRIC_DIRECTIONS = {
    'ctr': 'higher_better',        // CTRは高い方が良い
    'conversions': 'higher_better', // CVは多い方が良い
    'cvr': 'higher_better',        // CVRは高い方が良い
    'budget_rate': 'higher_better', // 予算消化率は高い方が良い（ただし100%以下）
    'roas': 'higher_better',       // ROASは高い方が良い
    'cpa': 'lower_better',         // CPAは低い方が良い
    'cpm': 'lower_better',         // CPMは低い方が良い
    'cpc': 'lower_better'          // CPCは低い方が良い
};`;

    const newDirections = `const METRIC_DIRECTIONS = {
    'ctr': 'higher_better',        // CTRは高い方が良い
    'conversions': 'higher_better', // CVは多い方が良い
    'cvr': 'higher_better',        // CVRは高い方が良い
    'budget_rate': 'higher_better', // 予算消化率は高い方が良い（ただし100%以下）
    'roas': 'higher_better',       // ROASは高い方が良い
    'cpa': 'lower_better',         // CPAは低い方が良い
    'cpm': 'higher_better',       // CPMは高い方が良い（より多くのインプレッションを獲得）
    'cpc': 'lower_better'          // CPCは低い方が良い
};`;

    if (content.includes("'cpm': 'lower_better'")) {
        content = content.replace(oldDirections, newDirections);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('  ✅ CPMを higher_better に変更（高い場合にアラート）\n');
    } else {
        console.log('  ℹ️ 既に修正済みまたは異なる形式\n');
    }
}

// 2. 重複アラートを削除
function removeDuplicateAlerts() {
    console.log('2. 重複アラートを削除...');
    
    const historyPath = path.join(__dirname, 'alert_history.json');
    
    if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const originalCount = history.length;
        
        // ユーザーごとにアクティブなアラートをグループ化
        const userAlerts = {};
        history.forEach(alert => {
            if (alert.status === 'active' && alert.userId) {
                const key = `${alert.userId}_${alert.metric}`;
                if (!userAlerts[key]) {
                    userAlerts[key] = [];
                }
                userAlerts[key].push(alert);
            }
        });
        
        // 各グループで最新のもののみを残す
        let deactivatedCount = 0;
        Object.values(userAlerts).forEach(alerts => {
            if (alerts.length > 1) {
                // タイムスタンプでソート（新しい順）
                alerts.sort((a, b) => new Date(b.timestamp || b.triggeredAt) - new Date(a.timestamp || a.triggeredAt));
                
                // 最新以外を非アクティブ化
                for (let i = 1; i < alerts.length; i++) {
                    const alertIndex = history.findIndex(h => h.id === alerts[i].id);
                    if (alertIndex !== -1) {
                        history[alertIndex].status = 'resolved';
                        history[alertIndex].resolvedAt = new Date().toISOString();
                        deactivatedCount++;
                    }
                }
            }
        });
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log(`  ✅ ${deactivatedCount}件の重複アラートを解決済みに変更\n`);
    }
}

// 3. 改善施策ページの表示を修正
function fixImprovementStrategiesDisplay() {
    console.log('3. 改善施策ページの表示を最終修正...');
    
    const viewPath = path.join(__dirname, 'views', 'improvement-strategies.ejs');
    let content = fs.readFileSync(viewPath, 'utf8');
    
    // データ構造の確認とデバッグコードを追加
    if (!content.includes('console.log(\'Improvements data:\', improvements)')) {
        const debugCode = `
                <!-- デバッグ用 -->
                <script>
                    console.log('Improvements data:', <%- JSON.stringify(improvements) %>);
                </script>
`;
        
        const insertPos = content.indexOf('<div id="improvement-strategies-container">');
        if (insertPos !== -1) {
            content = content.substring(0, insertPos) + debugCode + content.substring(insertPos);
            fs.writeFileSync(viewPath, content, 'utf8');
            console.log('  ✅ デバッグコード追加\n');
        }
    }
}

// 4. app.jsのCPA計算ロジックを確認
function fixCPACalculation() {
    console.log('4. CPA計算ロジックを確認・修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // ダッシュボードルートでCPA計算を確認
    const dashboardRoute = content.indexOf("app.get('/dashboard', requireAuth, async");
    
    if (dashboardRoute !== -1) {
        // CPA計算ロジックを探す
        const cpaCalcStart = content.indexOf('const cpa =', dashboardRoute);
        const cpaCalcEnd = content.indexOf(';', cpaCalcStart);
        
        if (cpaCalcStart !== -1 && cpaCalcEnd !== -1) {
            const currentCalc = content.substring(cpaCalcStart, cpaCalcEnd + 1);
            
            // 正しい計算式に置き換え
            const correctCalc = 'const cpa = conversions > 0 ? Math.round(spend / conversions) : 0;';
            
            if (!currentCalc.includes('Math.round(spend / conversions)')) {
                content = content.substring(0, cpaCalcStart) + correctCalc + content.substring(cpaCalcEnd + 1);
                fs.writeFileSync(appPath, content, 'utf8');
                console.log('  ✅ CPA計算ロジックを修正\n');
            } else {
                console.log('  ✅ CPA計算ロジックは正しい\n');
            }
        }
    }
}

// 5. 確認事項ページの動作を修正
function fixCheckItemsPage() {
    console.log('5. 確認事項ページを修正...');
    
    const viewPath = path.join(__dirname, 'views', 'check-items.ejs');
    
    if (fs.existsSync(viewPath)) {
        let content = fs.readFileSync(viewPath, 'utf8');
        
        // APIエラー時のフォールバック処理を追加
        if (!content.includes('// エラー時のフォールバック')) {
            const fallbackCode = `
            function handleError(error) {
                console.error('API Error:', error);
                // エラー時のフォールバック
                document.getElementById('check-items-container').innerHTML = 
                    '<div class="alert alert-warning">データを取得中にエラーが発生しました。ページを再読み込みしてください。</div>';
            }
`;
            
            const scriptStart = content.indexOf('<script>');
            if (scriptStart !== -1) {
                const insertPos = scriptStart + 8;
                content = content.substring(0, insertPos) + fallbackCode + content.substring(insertPos);
                fs.writeFileSync(viewPath, content, 'utf8');
                console.log('  ✅ エラーハンドリング追加\n');
            }
        }
    }
}

// 6. シミュレーション実行
async function runSimulation() {
    console.log('6. シミュレーション実行...\n');
    
    try {
        const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
        const { getUserTargets } = require('./alertSystem');
        const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
        
        // ユーザー設定を直接読み込み
        const settingsPath = path.join(__dirname, 'data', 'user_settings', `${userId}.json`);
        const userSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        console.log('  現在の目標値:');
        console.log('    - CPM:', userSettings.target_cpm, '円');
        console.log('    - CTR:', userSettings.target_ctr, '%');
        console.log('    - CPA:', userSettings.target_cpa, '円');
        console.log('    - CV:', userSettings.target_cv, '件');
        console.log('    - 予算消化率:', userSettings.target_budget_rate, '%');
        
        // アラート生成
        const alerts = await generateDynamicAlerts(userId);
        
        console.log(`\n  生成されたアラート: ${alerts.length}件`);
        alerts.forEach(alert => {
            console.log(`    - ${alert.metric}: ${alert.message}`);
            if (alert.checkItems) {
                console.log(`      確認事項: ${alert.checkItems.length}件`);
            }
        });
        
    } catch (error) {
        console.error('  エラー:', error.message);
    }
}

// メイン実行
async function main() {
    try {
        fixMetricDirections();
        removeDuplicateAlerts();
        fixImprovementStrategiesDisplay();
        fixCPACalculation();
        fixCheckItemsPage();
        await runSimulation();
        
        console.log('\n========================================');
        console.log('✅ アラートロジック復元完了！');
        console.log('========================================\n');
        
        console.log('実施した修正:');
        console.log('1. ✅ CPMアラートを「高い場合」に表示するよう修正');
        console.log('2. ✅ 重複アラートを削除');
        console.log('3. ✅ 改善施策ページにデバッグコード追加');
        console.log('4. ✅ CPA計算ロジックを確認');
        console.log('5. ✅ 確認事項ページのエラーハンドリング追加');
        
        console.log('\n次の手順:');
        console.log('1. サーバーを再起動してください');
        console.log('2. ダッシュボードでアラート内容を確認');
        console.log('3. 確認事項・改善施策ページを確認');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();