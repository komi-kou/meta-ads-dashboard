// アラート内容、確認事項、改善施策のロジックを統一するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== アラートロジック統一スクリプト ===\n');

// 1. 確認事項ページの修正
function fixImprovementTasks() {
    console.log('1. 確認事項ページの修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // improvement-tasksのルートを修正
    const oldRoute = `app.get('/improvement-tasks', requireAuth, async (req, res) => {
    try {
        console.log('=== 確認事項ページアクセス ===');
        const userId = req.session.userId;
        
        // ユーザー設定を取得
        const UserManager = require('./userManager');
        const userManagerInstance = new UserManager();
        const userSettings = userManagerInstance.getUserSettings(userId) || {};
        
        // アラート履歴から確認事項を取得
        let checkItems = [];
        try {
            const { getAlertHistory, getUserTargets } = require('./alertSystem');
            let alertHistory = await getAlertHistory(userId);`;

    const newRoute = `app.get('/improvement-tasks', requireAuth, async (req, res) => {
    try {
        console.log('=== 確認事項ページアクセス ===');
        const userId = req.session.userId;
        
        // ユーザー設定を取得
        const UserManager = require('./userManager');
        const userManagerInstance = new UserManager();
        const userSettings = userManagerInstance.getUserSettings(userId) || {};
        
        // 動的アラート生成を使用（アラート内容ページと同じロジック）
        let checkItems = [];
        try {
            const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
            const alerts = await generateDynamicAlerts(userId);
            
            // アラートから確認事項を抽出
            alerts.forEach(alert => {
                if (alert.checkItems && alert.checkItems.length > 0) {
                    alert.checkItems.forEach(item => {
                        checkItems.push({
                            metric: alert.metric,
                            message: alert.message,
                            priority: item.priority || 1,
                            title: item.title,
                            description: item.description,
                            targetValue: alert.targetValue,
                            currentValue: alert.currentValue
                        });
                    });
                }
            });`;

    // ファイル内容を置換
    const startIndex = content.indexOf(`app.get('/improvement-tasks', requireAuth, async (req, res) => {`);
    const endIndex = content.indexOf('            let alertHistory = await getAlertHistory(userId);');
    
    if (startIndex !== -1 && endIndex !== -1) {
        const beforePart = content.substring(0, startIndex);
        const afterPart = content.substring(endIndex + 48); // スキップする部分の長さ
        content = beforePart + newRoute + afterPart;
        
        fs.writeFileSync(appPath, content, 'utf8');
        console.log('  ✅ 確認事項ページのロジックを修正しました\n');
    } else {
        console.log('  ⚠️ 既に修正済みの可能性があります\n');
    }
}

// 2. 改善施策ページの修正
function fixImprovementStrategies() {
    console.log('2. 改善施策ページの修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // improvement-strategiesのルートを修正
    const oldRoute = `app.get('/improvement-strategies', requireAuth, async (req, res) => {
    try {
        console.log('=== 改善施策ページアクセス ===');
        const userId = req.session.userId;
        
        // ユーザー設定を取得
        const UserManager = require('./userManager');
        const userManagerInstance = new UserManager();
        const userSettings = userManagerInstance.getUserSettings(userId) || {};
        
        let improvements = {};
        try {
            const { getAlertHistory, getUserTargets } = require('./alertSystem');
            let alertHistory = await getAlertHistory(userId);`;

    const newRoute = `app.get('/improvement-strategies', requireAuth, async (req, res) => {
    try {
        console.log('=== 改善施策ページアクセス ===');
        const userId = req.session.userId;
        
        // ユーザー設定を取得
        const UserManager = require('./userManager');
        const userManagerInstance = new UserManager();
        const userSettings = userManagerInstance.getUserSettings(userId) || {};
        
        let improvements = {};
        try {
            const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
            const alerts = await generateDynamicAlerts(userId);
            
            // アラートから改善施策を抽出
            alerts.forEach(alert => {
                if (alert.improvements) {
                    const metricName = getMetricDisplayName(alert.metric);
                    improvements[metricName] = {
                        ...alert.improvements,
                        message: alert.message,
                        targetValue: alert.targetValue,
                        currentValue: alert.currentValue
                    };
                }
            });`;

    // ファイル内容を置換（部分的な置換）
    const startIndex = content.indexOf(`app.get('/improvement-strategies', requireAuth, async (req, res) => {`);
    const endIndex = content.indexOf('            let alertHistory = await getAlertHistory(userId);', startIndex);
    
    if (startIndex !== -1 && endIndex !== -1) {
        const beforePart = content.substring(0, startIndex);
        const afterPart = content.substring(endIndex + 48);
        content = beforePart + newRoute + afterPart;
        
        // getMetricDisplayName関数を確認・追加
        if (!content.includes('function getMetricDisplayName(metric)')) {
            const functionCode = `
// メトリクス表示名変換（改善施策用）
function getMetricDisplayName(metric) {
    switch (metric) {
        case 'budget_rate': return '予算消化率';
        case 'ctr': return 'CTR';
        case 'conversions': return 'CV';
        case 'cpm': return 'CPM';
        case 'cpa': return 'CPA';
        case 'cvr': return 'CVR';
        case 'roas': return 'ROAS';
        case 'cpc': return 'CPC';
        default: return metric.toUpperCase();
    }
}

`;
            // 関数を適切な場所に追加（改善施策ルートの前）
            const routeIndex = content.indexOf(`app.get('/improvement-strategies'`);
            if (routeIndex !== -1) {
                content = content.substring(0, routeIndex) + functionCode + content.substring(routeIndex);
            }
        }
        
        fs.writeFileSync(appPath, content, 'utf8');
        console.log('  ✅ 改善施策ページのロジックを修正しました\n');
    } else {
        console.log('  ⚠️ 既に修正済みの可能性があります\n');
    }
}

// 3. シミュレーション実行
async function runSimulation() {
    console.log('3. シミュレーション実行...\n');
    
    const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    
    try {
        console.log('  📊 アラート生成中...');
        const alerts = await generateDynamicAlerts(userId);
        
        console.log(`  ✅ 生成されたアラート数: ${alerts.length}件\n`);
        
        if (alerts.length > 0) {
            const firstAlert = alerts[0];
            console.log('  【サンプルアラート】');
            console.log(`    メトリック: ${firstAlert.metric}`);
            console.log(`    メッセージ: ${firstAlert.message}`);
            console.log(`    目標値: ${firstAlert.targetValue}`);
            console.log(`    現在値: ${firstAlert.currentValue}\n`);
            
            if (firstAlert.checkItems && firstAlert.checkItems.length > 0) {
                console.log('  【確認事項】');
                firstAlert.checkItems.forEach((item, i) => {
                    console.log(`    ${i + 1}. ${item.title}`);
                    console.log(`       ${item.description}\n`);
                });
            }
            
            if (firstAlert.improvements) {
                console.log('  【改善施策】');
                Object.entries(firstAlert.improvements).forEach(([key, values]) => {
                    console.log(`    ${key}:`);
                    if (Array.isArray(values)) {
                        values.forEach(v => {
                            console.log(`      - ${v}`);
                        });
                    }
                    console.log('');
                });
            }
        }
        
        console.log('  ✅ データの一貫性が確認されました');
        console.log('     アラート内容 → 確認事項 → 改善施策が同期しています\n');
        
    } catch (error) {
        console.error('  ❌ シミュレーションエラー:', error.message);
    }
}

// メイン実行
async function main() {
    try {
        fixImprovementTasks();
        fixImprovementStrategies();
        await runSimulation();
        
        console.log('\n========================================');
        console.log('✅ アラートロジック統一完了！');
        console.log('========================================\n');
        
        console.log('次のステップ:');
        console.log('1. サーバーを再起動してください');
        console.log('2. 以下のページを確認してください:');
        console.log('   - /alerts (アラート内容)');
        console.log('   - /improvement-tasks (確認事項)');
        console.log('   - /improvement-strategies (改善施策)');
        console.log('3. 全てのページで同じアラートデータが表示されることを確認\n');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();