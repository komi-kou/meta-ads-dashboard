// test-alert-notification.js - アラート通知のテスト送信
const { checkUserAlerts } = require('./alertSystem');
const { sendAlertsDirectly } = require('./alertSystemExtensions');

async function testAlertNotification() {
    console.log('=== アラート通知テスト開始 ===\n');
    
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291'; // komiya11122@gmail.com
    
    try {
        console.log('1. アラートチェック実行中...');
        const alerts = await checkUserAlerts(userId);
        
        if (!alerts || alerts.length === 0) {
            console.log('✅ 現在アラートはありません（正常）');
            
            // テスト用のサンプルアラートを作成
            console.log('\n2. テスト用アラート作成中...');
            const testAlerts = [{
                id: `test_${Date.now()}`,
                metric: 'ctr',
                targetValue: 1.0,
                currentValue: 0.8,
                message: 'CTRが目標値1.0%を下回っています（現在: 0.8%）',
                severity: 'warning',
                triggeredAt: new Date().toISOString()
            }];
            
            console.log('3. テスト送信実行中...');
            const userSettings = {
                user_id: userId,
                chatwork_token: '10e7538af625f74890e0f0bc4747c976',
                chatwork_room_id: '408053863',
                alert_notifications_enabled: true
            };
            
            await sendAlertsDirectly(testAlerts, userSettings);
            console.log('✅ テストアラート送信完了！');
            
        } else {
            console.log(`\n📊 検出されたアラート: ${alerts.length}件`);
            alerts.forEach((alert, index) => {
                console.log(`\nアラート${index + 1}:`);
                console.log(`  指標: ${alert.metric}`);
                console.log(`  目標値: ${alert.targetValue}`);
                console.log(`  現在値: ${alert.currentValue}`);
                console.log(`  重要度: ${alert.severity}`);
            });
            
            console.log('\n2. 実際のアラート送信中...');
            const userSettings = {
                user_id: userId,
                chatwork_token: '10e7538af625f74890e0f0bc4747c976',
                chatwork_room_id: '408053863',
                alert_notifications_enabled: true
            };
            
            await sendAlertsDirectly(alerts, userSettings);
            console.log('✅ 実際のアラート送信完了！');
        }
        
    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
    
    console.log('\n=== アラート通知テスト完了 ===');
}

// 実行
testAlertNotification();