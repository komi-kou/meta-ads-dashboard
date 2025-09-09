// test-alert-real.js - 実際のアラートシステムを動作テスト
const { checkUserAlerts } = require('./alertSystem');

async function testRealAlertSystem() {
    console.log('=== 実際のアラートシステムテスト ===\n');
    
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    
    try {
        console.log('アラートチェック実行中...');
        const alerts = await checkUserAlerts(userId);
        
        console.log(`\n検出されたアラート: ${alerts.length}件`);
        
        if (alerts.length > 0) {
            alerts.forEach((alert, index) => {
                console.log(`\n--- アラート ${index + 1} ---`);
                console.log(`メトリクス: ${alert.metric}`);
                console.log(`メッセージ: ${alert.message}`);
                console.log(`重要度: ${alert.severity}`);
                console.log(`確認事項: ${alert.checkItems ? alert.checkItems.length : 0}件`);
                console.log(`改善施策カテゴリ: ${alert.improvements ? Object.keys(alert.improvements).length : 0}件`);
            });
        }
        
        // アラート履歴を確認
        const { getAlertHistory } = require('./alertSystem');
        const history = await getAlertHistory();
        console.log(`\n📝 アラート履歴: ${history.length}件保存済み`);
        
        if (history.length > 0) {
            console.log('\n最新のアラート履歴:');
            const latestAlerts = history.slice(0, 3);
            latestAlerts.forEach(entry => {
                console.log(`- ${entry.metric}: ${entry.message}`);
                console.log(`  時刻: ${new Date(entry.timestamp).toLocaleString('ja-JP')}`);
            });
        }
        
    } catch (error) {
        console.error('テストエラー:', error);
    }
}

// テスト実行
testRealAlertSystem();