// test-all-notifications.js - 本番環境で全通知を送信
const { checkAllAlerts } = require('./alertSystem');
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

async function testAllNotifications() {
    console.log('=== 本番環境での全通知送信テスト開始 ===\n');
    console.log('時刻:', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    console.log('対象ユーザー: komiya11122@gmail.com\n');
    
    const multiUserSender = new MultiUserChatworkSender();
    let results = {
        dailyReport: false,
        updateNotification: false,
        alertNotification: false
    };
    
    try {
        // 1. 日次レポート送信
        console.log('【1. 日次レポート送信】');
        console.log('----------------------------');
        try {
            await multiUserSender.sendDailyReportToAllUsers();
            results.dailyReport = true;
            console.log('✅ 日次レポート送信完了\n');
        } catch (error) {
            console.error('❌ 日次レポート送信失敗:', error.message);
        }
        
        // 少し待機（レート制限対策）
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 2. 定期更新通知送信
        console.log('【2. 定期更新通知送信】');
        console.log('----------------------------');
        try {
            await multiUserSender.sendUpdateNotificationToAllUsers();
            results.updateNotification = true;
            console.log('✅ 定期更新通知送信完了\n');
        } catch (error) {
            console.error('❌ 定期更新通知送信失敗:', error.message);
        }
        
        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. アラート通知送信（checkAllAlertsを使用）
        console.log('【3. アラート通知送信】');
        console.log('----------------------------');
        try {
            const alerts = await checkAllAlerts();
            results.alertNotification = true;
            console.log('✅ アラート通知送信完了\n');
        } catch (error) {
            console.error('❌ アラート通知送信失敗:', error.message);
        }
        
    } catch (error) {
        console.error('予期しないエラー:', error);
    }
    
    // 結果サマリー
    console.log('=== 送信結果サマリー ===');
    console.log('日次レポート:', results.dailyReport ? '✅ 成功' : '❌ 失敗');
    console.log('定期更新通知:', results.updateNotification ? '✅ 成功' : '❌ 失敗');
    console.log('アラート通知:', results.alertNotification ? '✅ 成功' : '❌ 失敗');
    
    const successCount = Object.values(results).filter(r => r).length;
    console.log(`\n総合結果: ${successCount}/3 の通知が正常に送信されました`);
    
    if (successCount === 3) {
        console.log('\n🎉 全ての通知が正常に送信されました！');
        console.log('Chatworkルーム 408053863 に以下が送信されています:');
        console.log('  1. 日次レポート（昨日のデータ）');
        console.log('  2. 定期更新通知');
        console.log('  3. アラート通知（CPM超過、CV未達成、予算消化率低下）');
    }
    
    console.log('\n=== 本番環境での全通知送信テスト完了 ===');
}

// 実行
testAllNotifications();