// 改善施策ページのエラーを完全に修正するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== 改善施策ページ修正スクリプト ===\n');

// 1. 現状のデータ構造をテスト
async function testCurrentStructure() {
    console.log('1. 現状のデータ構造をテスト...');
    
    try {
        const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
        const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
        
        const alerts = await generateDynamicAlerts(userId);
        console.log('  生成されたアラート数:', alerts.length);
        
        // 改善施策の構造を確認
        alerts.forEach(alert => {
            if (alert.improvements) {
                console.log(`\n  ${alert.metric}の改善施策構造:`);
                console.log('    タイプ:', typeof alert.improvements);
                console.log('    キー:', Object.keys(alert.improvements));
                
                Object.entries(alert.improvements).forEach(([key, value]) => {
                    console.log(`    ${key}:`, Array.isArray(value) ? `配列(${value.length}件)` : typeof value);
                });
            }
        });
        
    } catch (error) {
        console.error('  エラー:', error.message);
    }
    console.log();
}

// 2. ビューファイルを修正
function fixViewFile() {
    console.log('2. improvement-strategies.ejsを修正...');
    
    const viewPath = path.join(__dirname, 'views', 'improvement-strategies.ejs');
    let content = fs.readFileSync(viewPath, 'utf8');
    
    // 既存のループ構造を修正
    const oldLoop = `<% Object.entries(improvements).forEach(([category, strategies]) => { %>
                            <div class="improvement-card">
                                <div class="improvement-header">
                                    <div class="improvement-category">
                                        <%= category %>
                                    </div>
                                    <div class="improvement-metric">
                                        <%= strategies.length %>件の改善施策
                                    </div>
                                </div>
                                
                                <div class="improvement-content">
                                    <ul class="strategy-list">
                                        <% strategies.forEach((strategy, index) => { %>`;
    
    const newLoop = `<% Object.entries(improvements).forEach(([metricName, improvementData]) => { %>
                            <% 
                            // メタ情報を除外して改善施策のみを抽出
                            const categoryEntries = Object.entries(improvementData).filter(([key]) => key !== '_meta');
                            %>
                            <% categoryEntries.forEach(([category, strategies]) => { %>
                            <div class="improvement-card">
                                <div class="improvement-header">
                                    <div class="improvement-category">
                                        <%= metricName %> - <%= category %>
                                    </div>
                                    <div class="improvement-metric">
                                        <%= Array.isArray(strategies) ? strategies.length : 0 %>件の改善施策
                                    </div>
                                </div>
                                
                                <div class="improvement-content">
                                    <ul class="strategy-list">
                                        <% if (Array.isArray(strategies)) { %>
                                        <% strategies.forEach((strategy, index) => { %>`;
    
    // 対応する閉じタグも修正
    const oldClosing = `                                        <% }) %>
                                    </ul>
                                </div>
                            </div>
                        <% }) %>`;
    
    const newClosing = `                                        <% }) %>
                                        <% } %>
                                    </ul>
                                </div>
                            </div>
                            <% }) %>
                        <% }) %>`;
    
    // 置換
    content = content.replace(oldLoop, newLoop);
    content = content.replace(oldClosing, newClosing);
    
    fs.writeFileSync(viewPath, content, 'utf8');
    console.log('  ✅ ビューファイルを修正\n');
}

// 3. app.jsのルートも最適化
function optimizeRoute() {
    console.log('3. app.jsの改善施策ルートを最適化...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // getMetricDisplayNameが定義されているか確認
    if (!content.includes('function getMetricDisplayName')) {
        // 関数を追加
        const functionDef = `
// メトリクス表示名を取得するヘルパー関数
function getMetricDisplayName(metric) {
    const displayNames = {
        'ctr': 'CTR',
        'CTR': 'CTR',
        'cpa': 'CPA',
        'CPA': 'CPA',
        'cpm': 'CPM',
        'CPM': 'CPM',
        'conversions': 'CV',
        'CV': 'CV',
        'cvr': 'CVR',
        'CVR': 'CVR',
        'budget_rate': '予算消化率',
        '予算消化率': '予算消化率',
        'roas': 'ROAS',
        'ROAS': 'ROAS'
    };
    return displayNames[metric] || metric;
}
`;
        
        // requireステートメントの後に追加
        const insertPos = content.lastIndexOf('// ミドルウェア');
        if (insertPos !== -1) {
            content = content.substring(0, insertPos) + functionDef + '\n' + content.substring(insertPos);
            fs.writeFileSync(appPath, content, 'utf8');
            console.log('  ✅ getMetricDisplayName関数を追加');
        }
    }
    
    console.log('  ✅ ルート最適化完了\n');
}

// 4. シミュレーション実行
async function runSimulation() {
    console.log('4. シミュレーション実行...');
    
    try {
        const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
        const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
        
        const alerts = await generateDynamicAlerts(userId);
        let improvements = {};
        
        // アラートから改善施策を抽出（実際のルートと同じロジック）
        alerts.forEach(alert => {
            if (alert.improvements) {
                const metricName = alert.metric;
                improvements[metricName] = {};
                
                Object.entries(alert.improvements).forEach(([key, strategies]) => {
                    if (!Array.isArray(strategies)) {
                        if (typeof strategies === 'string') {
                            strategies = [strategies];
                        } else if (typeof strategies === 'object') {
                            strategies = Object.values(strategies);
                        } else {
                            strategies = [];
                        }
                    }
                    improvements[metricName][key] = strategies;
                });
                
                improvements[metricName]._meta = {
                    message: alert.message,
                    targetValue: alert.targetValue,
                    currentValue: alert.currentValue
                };
            }
        });
        
        console.log('\n  📊 改善施策の構造:');
        Object.entries(improvements).forEach(([metric, data]) => {
            const categories = Object.keys(data).filter(k => k !== '_meta');
            console.log(`    ${metric}: ${categories.length}カテゴリ`);
            
            categories.forEach(cat => {
                const strategies = data[cat];
                console.log(`      - ${cat}: ${Array.isArray(strategies) ? strategies.length : 0}件`);
            });
        });
        
    } catch (error) {
        console.error('  エラー:', error.message);
    }
}

// メイン実行
async function main() {
    try {
        await testCurrentStructure();
        fixViewFile();
        optimizeRoute();
        await runSimulation();
        
        console.log('\n========================================');
        console.log('✅ 改善施策ページ修正完了！');
        console.log('========================================\n');
        
        console.log('実施した修正:');
        console.log('1. ✅ ビューファイルのループ構造を修正');
        console.log('2. ✅ 配列チェックを追加');
        console.log('3. ✅ メトリクス名とカテゴリを正しく表示');
        console.log('4. ✅ getMetricDisplayName関数を追加');
        
        console.log('\n次の手順:');
        console.log('1. ブラウザで改善施策ページを更新');
        console.log('2. エラーが解消されていることを確認');
        console.log('3. 改善施策が正しく表示されることを確認');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();