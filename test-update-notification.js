// test-update-notification.js - 定期更新通知のテスト送信
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

async function testUpdateNotification() {
    console.log('=== 定期更新通知テスト開始 ===\n');
    
    const multiUserSender = new MultiUserChatworkSender();
    
    const userSettings = {
        user_id: 'b4475ace-303e-4fd1-8740-221154c9b291',
        chatwork_token: '10e7538af625f74890e0f0bc4747c976',
        chatwork_room_id: '408053863',
        update_notifications_enabled: true
    };
    
    try {
        console.log('ユーザー情報:');
        console.log('  ID: b4475ace-303e-4fd1-8740-221154c9b291');
        console.log('  メール: komiya11122@gmail.com');
        console.log('  ルームID: 408053863\n');
        
        console.log('定期更新通知送信中...');
        
        await multiUserSender.sendUserUpdateNotification(userSettings, false);
        
        console.log('\n✅ 定期更新通知送信成功！');
        console.log('チャットワークルーム408053863を確認してください。');
        
    } catch (error) {
        console.error('\n❌ エラー:', error.message);
        console.error(error.stack);
    }
    
    console.log('\n=== 定期更新通知テスト完了 ===');
}

// 実行
testUpdateNotification();