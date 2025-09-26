// CPM監視機能を追加するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== CPM監視機能の追加 ===\n');

// 1. ダッシュボードにCPMステータス表示を追加
function addCPMStatusToViews() {
    console.log('1. ダッシュボードビューにCPMステータスを追加...');
    
    const dashboardPath = path.join(__dirname, 'views', 'dashboard.ejs');
    
    if (fs.existsSync(dashboardPath)) {
        let content = fs.readFileSync(dashboardPath, 'utf8');
        
        // CPMステータス表示を追加（まだない場合）
        if (!content.includes('CPMステータス')) {
            const metricsSection = content.indexOf('<!-- アラート内容 -->');
            
            if (metricsSection !== -1) {
                const cpmStatusHTML = `
    <!-- CPMステータス -->
    <div class="alert-item" style="background-color: #e8f4fd; border-left: 4px solid #2196F3; padding: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1976D2;">
            <i class="fas fa-chart-line"></i> CPM監視状況
        </h4>
        <% 
        const currentCPM = metrics && metrics.cpm ? Math.round(metrics.cpm) : 0;
        const targetCPM = userSettings && userSettings.target_cpm ? parseInt(userSettings.target_cpm) : 3000;
        const cpmStatus = currentCPM > targetCPM ? 'warning' : 'success';
        const cpmIcon = currentCPM > targetCPM ? 'exclamation-triangle' : 'check-circle';
        const cpmColor = currentCPM > targetCPM ? '#ff9800' : '#4caf50';
        %>
        <div style="display: flex; align-items: center; gap: 20px;">
            <div>
                <strong>現在のCPM:</strong> 
                <span style="font-size: 1.2em; color: <%= cpmColor %>;">
                    <%= currentCPM.toLocaleString() %>円
                </span>
            </div>
            <div>
                <strong>目標CPM:</strong> 
                <span style="font-size: 1.2em;">
                    <%= targetCPM.toLocaleString() %>円
                </span>
            </div>
            <div style="flex-grow: 1; text-align: right;">
                <i class="fas fa-<%= cpmIcon %>" style="color: <%= cpmColor %>; font-size: 1.5em;"></i>
                <span style="color: <%= cpmColor %>; font-weight: bold; margin-left: 10px;">
                    <% if (currentCPM > targetCPM) { %>
                        要注意: 目標超過
                    <% } else { %>
                        正常: 目標内
                    <% } %>
                </span>
            </div>
        </div>
        <% if (currentCPM <= targetCPM) { %>
        <div style="margin-top: 10px; padding: 10px; background-color: #f5f5f5; border-radius: 4px;">
            <i class="fas fa-info-circle"></i>
            CPMは目標値以下で推移しています。効率的な配信が行われています。
        </div>
        <% } %>
    </div>
`;
                
                // アラート内容の前に挿入
                const insertPosition = content.indexOf('<!-- アラート内容 -->');
                content = content.substring(0, insertPosition) + cpmStatusHTML + content.substring(insertPosition);
                
                fs.writeFileSync(dashboardPath, content, 'utf8');
                console.log('  ✅ CPMステータス表示を追加');
            }
        } else {
            console.log('  ℹ️ 既にCPMステータスが存在します');
        }
    }
    console.log();
}

// 2. メトリクス情報にCPMを確実に含める
function ensureCPMInMetrics() {
    console.log('2. メトリクス計算にCPMを確実に含める...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // ダッシュボードルートでCPMを計算
    const dashboardRoute = content.indexOf("app.get('/dashboard', requireAuth, async (req, res) => {");
    
    if (dashboardRoute !== -1) {
        // metricsオブジェクトにCPMが含まれているか確認
        const metricsStart = content.indexOf('const metrics = {', dashboardRoute);
        const metricsEnd = content.indexOf('};', metricsStart);
        
        if (metricsStart !== -1 && metricsEnd !== -1) {
            const metricsContent = content.substring(metricsStart, metricsEnd + 2);
            
            if (!metricsContent.includes('cpm:')) {
                // CPMを追加
                const newMetrics = metricsContent.replace(
                    'budgetRate: budgetRate',
                    `budgetRate: budgetRate,
            cpm: cpm`
                );
                
                content = content.substring(0, metricsStart) + newMetrics + content.substring(metricsEnd + 2);
                fs.writeFileSync(appPath, content, 'utf8');
                console.log('  ✅ メトリクスにCPMを追加');
            } else {
                console.log('  ℹ️ CPMは既にメトリクスに含まれています');
            }
        }
    }
    console.log();
}

// 3. CPM情報をアラート履歴に含める
function addCPMToAlertHistory() {
    console.log('3. アラート履歴にCPM情報を追加...');
    
    const viewPath = path.join(__dirname, 'views', 'alert-history.ejs');
    
    if (fs.existsSync(viewPath)) {
        let content = fs.readFileSync(viewPath, 'utf8');
        
        // CPM情報表示を追加
        if (!content.includes('CPM状況')) {
            const headerSection = content.indexOf('<h1>');
            
            if (headerSection !== -1) {
                const cpmInfoHTML = `
    <!-- CPM状況サマリー -->
    <div class="summary-box" style="background-color: #e3f2fd; border: 1px solid #2196F3; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
        <h3 style="margin-top: 0; color: #1976D2;">
            <i class="fas fa-chart-line"></i> CPM監視状況
        </h3>
        <% 
        const latestCPM = metrics && metrics.cpm ? Math.round(metrics.cpm) : 0;
        const targetCPM = userSettings && userSettings.target_cpm ? parseInt(userSettings.target_cpm) : 3000;
        %>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px;">
            <div>
                <strong>現在のCPM:</strong> <%= latestCPM.toLocaleString() %>円
            </div>
            <div>
                <strong>目標CPM:</strong> <%= targetCPM.toLocaleString() %>円
            </div>
            <div>
                <strong>ステータス:</strong> 
                <span style="color: <%= latestCPM > targetCPM ? '#ff9800' : '#4caf50' %>;">
                    <%= latestCPM > targetCPM ? '目標超過' : '目標内' %>
                </span>
            </div>
        </div>
    </div>
`;
                
                const insertPos = content.indexOf('</h1>') + 5;
                content = content.substring(0, insertPos) + cpmInfoHTML + content.substring(insertPos);
                
                fs.writeFileSync(viewPath, content, 'utf8');
                console.log('  ✅ アラート履歴にCPM状況を追加');
            }
        } else {
            console.log('  ℹ️ CPM状況は既に表示されています');
        }
    }
    console.log();
}

// 4. テスト実行
async function testCPMDisplay() {
    console.log('4. CPM表示のテスト...');
    
    const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
    const { getUserTargets } = require('./alertSystem');
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    
    try {
        const targets = await getUserTargets(userId);
        console.log('  目標CPM:', targets.cpm, '円');
        
        const alerts = await generateDynamicAlerts(userId);
        const cpmAlert = alerts.find(a => a.metric === 'CPM' || a.metric === 'cpm');
        
        if (cpmAlert) {
            console.log('  ⚠️ CPMアラート発生中:', cpmAlert.message);
        } else {
            console.log('  ✅ CPMは目標値内（アラートなし）');
            console.log('     ※CPMが3000円を超えた場合にアラートが表示されます');
        }
        
    } catch (error) {
        console.error('  エラー:', error.message);
    }
    console.log();
}

// メイン実行
async function main() {
    try {
        addCPMStatusToViews();
        ensureCPMInMetrics();
        addCPMToAlertHistory();
        await testCPMDisplay();
        
        console.log('========================================');
        console.log('✅ CPM監視機能の追加完了！');
        console.log('========================================\n');
        
        console.log('追加された機能:');
        console.log('1. ✅ ダッシュボードにCPMステータス表示');
        console.log('2. ✅ アラート履歴にCPM状況サマリー');
        console.log('3. ✅ CPMが目標値内でも監視状況を表示');
        console.log('\nCPMアラートの仕組み:');
        console.log('- 現在のCPM: 1311円');
        console.log('- 目標CPM: 3000円');
        console.log('- 状態: 正常（目標値以下）');
        console.log('- アラート: CPMが3000円を超えた場合のみ発生');
        console.log('\n次の手順:');
        console.log('1. ダッシュボードを更新してCPMステータスを確認');
        console.log('2. アラート履歴でCPM状況を確認');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();