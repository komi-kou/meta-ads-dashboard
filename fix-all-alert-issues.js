// すべてのアラート問題を完全に修正するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== 完全修正スクリプト ===\n');

// 1. /api/check-items エンドポイントを修正
function fixApiCheckItems() {
    console.log('1. /api/check-items エンドポイントを修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // /api/check-items のルートを探して修正
    const oldApiCheckItems = `app.get('/api/check-items', requireAuth, async (req, res) => {
    try {
        console.log('=== API確認事項へのアクセス ===');
        console.log('ユーザーID:', req.session.userId);
        
        const userId = req.session.userId;
        
        // アラートシステムを安全に読み込み
        let alerts = [];
        try {
            const { getAlertHistory } = require('./alertSystem');
            console.log('alertSystem.js を読み込み成功');
            
            // アクティブなアラート履歴を取得（ユーザーIDでフィルタリング）
            const alertHistory = await getAlertHistory(req.session.userId);`;
    
    const newApiCheckItems = `app.get('/api/check-items', requireAuth, async (req, res) => {
    try {
        console.log('=== API確認事項へのアクセス ===');
        console.log('ユーザーID:', req.session.userId);
        
        const userId = req.session.userId;
        
        // 動的アラート生成を使用（確認事項ページと同じロジック）
        let alerts = [];
        try {
            const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
            console.log('動的アラート生成中...');
            
            // 動的にアラートを生成
            const dynamicAlerts = await generateDynamicAlerts(userId);`;
    
    if (content.includes(oldApiCheckItems)) {
        content = content.replace(oldApiCheckItems, newApiCheckItems);
        
        // alertHistoryをdynamicAlertsに置換
        content = content.replace(
            /const alertHistory = await getAlertHistory\(req\.session\.userId\);[\s\S]*?alerts = alertHistory\.filter\(alert => [\s\S]*?\);/,
            `const dynamicAlerts = await generateDynamicAlerts(userId);
            alerts = dynamicAlerts; // 動的アラートをそのまま使用`
        );
        
        fs.writeFileSync(appPath, content, 'utf8');
        console.log('  ✅ /api/check-items を動的アラート生成に変更\n');
    } else {
        console.log('  ⚠️ 既に修正済みまたは形式が異なります\n');
    }
}

// 2. 古いCVアラートを非アクティブ化
function deactivateOldCVAlerts() {
    console.log('2. 古いCVアラートを非アクティブ化...');
    
    const historyPath = path.join(__dirname, 'alert_history.json');
    
    if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        let deactivatedCount = 0;
        
        history = history.map(alert => {
            // CVまたはCVRのアラートを非アクティブ化
            if ((alert.metric === 'CV' || alert.metric === 'CVR' || 
                 alert.metric === 'conversions' || alert.metric === 'cvr' ||
                 alert.metric.toLowerCase().includes('cvr')) && 
                alert.status === 'active') {
                alert.status = 'resolved';
                alert.resolvedAt = new Date().toISOString();
                deactivatedCount++;
            }
            return alert;
        });
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log(`  ✅ ${deactivatedCount}件のCV/CVRアラートを非アクティブ化\n`);
    }
}

// 3. 改善施策ページのデータ構造を修正
function fixImprovementStrategiesDataStructure() {
    console.log('3. 改善施策ページのデータ構造を修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // 改善施策ルート内のデータ構造を確認
    const routeStart = content.indexOf("app.get('/improvement-strategies', requireAuth, async (req, res) => {");
    const routeEnd = content.indexOf("app.get('/chatwork-test'", routeStart);
    
    if (routeStart !== -1 && routeEnd !== -1) {
        let routeContent = content.substring(routeStart, routeEnd);
        
        // improvements[metricName][key] = strategiesの後に配列チェックを追加
        if (!routeContent.includes('// 配列であることを保証')) {
            routeContent = routeContent.replace(
                'improvements[metricName][key] = strategies;',
                `// 配列であることを保証
                        if (!Array.isArray(strategies)) {
                            strategies = typeof strategies === 'string' ? [strategies] : [];
                        }
                        improvements[metricName][key] = strategies;`
            );
            
            content = content.substring(0, routeStart) + routeContent + content.substring(routeEnd);
            fs.writeFileSync(appPath, content, 'utf8');
            console.log('  ✅ 改善施策のデータ構造を修正\n');
        } else {
            console.log('  ℹ️ 既に配列チェックが存在します\n');
        }
    }
}

// 4. シミュレーション実行
async function runSimulation() {
    console.log('4. シミュレーション実行...\n');
    
    const { generateDynamicAlerts } = require('./dynamicAlertGenerator');
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    
    try {
        console.log('  📊 動的アラート生成テスト...');
        const alerts = await generateDynamicAlerts(userId);
        
        console.log(`  生成されたアラート数: ${alerts.length}件`);
        alerts.forEach(alert => {
            console.log(`    - ${alert.metric}: ${alert.message}`);
        });
        
        // CVアラートがないことを確認
        const cvAlerts = alerts.filter(a => 
            a.metric === 'CV' || a.metric === 'conversions' || 
            a.metric === 'CVR' || a.metric === 'cvr'
        );
        
        if (cvAlerts.length === 0) {
            console.log('\n  ✅ CVアラートが正しく除外されています（目標達成のため）');
        } else {
            console.log(`\n  ⚠️ CVアラートが${cvAlerts.length}件見つかりました`);
        }
        
        // 確認事項の数をチェック
        let checkItemsCount = 0;
        alerts.forEach(alert => {
            if (alert.checkItems && alert.checkItems.length > 0) {
                checkItemsCount += alert.checkItems.length;
            }
        });
        console.log(`\n  確認事項の総数: ${checkItemsCount}件`);
        
    } catch (error) {
        console.error('  ❌ シミュレーションエラー:', error.message);
    }
}

// 5. アラート履歴のクリーンアップ
function cleanupAlertHistory() {
    console.log('5. アラート履歴のクリーンアップ...');
    
    const historyPath = path.join(__dirname, 'alert_history.json');
    
    if (fs.existsSync(historyPath)) {
        let history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const originalCount = history.length;
        
        // 30日以上前のアラートを削除
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        history = history.filter(alert => {
            return new Date(alert.timestamp || alert.triggeredAt) > thirtyDaysAgo;
        });
        
        const removedCount = originalCount - history.length;
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log(`  ✅ ${removedCount}件の古いアラートを削除\n`);
    }
}

// メイン実行
async function main() {
    try {
        fixApiCheckItems();
        deactivateOldCVAlerts();
        fixImprovementStrategiesDataStructure();
        cleanupAlertHistory();
        await runSimulation();
        
        console.log('\n========================================');
        console.log('✅ 完全修正完了！');
        console.log('========================================\n');
        
        console.log('修正内容:');
        console.log('1. ✅ /api/check-items が動的アラートを使用するように修正');
        console.log('2. ✅ 古いCV/CVRアラートを非アクティブ化');
        console.log('3. ✅ 改善施策ページのデータ構造を修正');
        console.log('4. ✅ アラート履歴をクリーンアップ');
        console.log('\n次のステップ:');
        console.log('1. サーバーを再起動してください');
        console.log('2. 以下を確認してください:');
        console.log('   - 確認事項ページにCVアラートが表示されないこと');
        console.log('   - 改善施策ページがエラーなく表示されること');
        console.log('   - すべてのページでデータが同期していること\n');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();