// 実際のChatworkテスト送信
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
const UserManager = require('./userManager');

async function testRealSend() {
    console.log('========================================');
    console.log('Chatwork実送信テスト');
    console.log('========================================\n');
    
    const userManager = new UserManager();
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    const userSettings = userManager.getUserSettings(userId);
    
    if (!userSettings) {
        console.error('❌ ユーザー設定が見つかりません');
        return;
    }
    
    console.log('ユーザー設定確認:');
    console.log(`  ユーザーID: ${userId}`);
    console.log(`  Chatwork Room ID: ${userSettings.chatwork_room_id}`);
    console.log(`  Chatwork有効: ${userSettings.enable_chatwork}`);
    console.log(`  アラート有効: ${userSettings.enable_alerts}`);
    
    if (!userSettings.chatwork_api_token || !userSettings.chatwork_room_id) {
        console.error('❌ Chatwork設定が不完全です');
        return;
    }
    
    const sender = new MultiUserChatworkSender();
    
    try {
        console.log('\n--- テスト送信開始 ---\n');
        
        // ユーザー設定を準備
        const testSettings = {
            user_id: userId,
            meta_access_token: userSettings.meta_access_token,
            meta_account_id: userSettings.meta_account_id,
            chatwork_api_token: userSettings.chatwork_api_token,
            chatwork_room_id: userSettings.chatwork_room_id,
            enable_chatwork: userSettings.enable_chatwork,
            enable_alerts: userSettings.enable_alerts,
            alert_notifications_enabled: true  // テスト送信を強制有効化
        };
        
        // アラート通知を送信
        await sender.sendUserAlertNotification(testSettings);
        
        console.log('\n✅ テスト送信完了！');
        console.log('\nChatworkを確認してください:');
        console.log('  1. 重複がないか');
        console.log('  2. 各メトリック最新1件のみか');
        console.log('  3. 数値フォーマットが適切か');
        console.log('  4. URLが本番環境を指しているか');
        
    } catch (error) {
        console.error('❌ 送信エラー:', error.message);
        console.error(error.stack);
    }
}

// 確認プロンプト
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('⚠️  注意: このテストは実際にChatworkにメッセージを送信します。');
console.log('Room ID: 408053863 に送信されます。\n');

rl.question('続行しますか？ (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        rl.close();
        testRealSend();
    } else {
        console.log('テストをキャンセルしました。');
        rl.close();
    }
});