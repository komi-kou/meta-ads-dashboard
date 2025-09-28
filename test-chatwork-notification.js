// Chatwork通知テストスクリプト
console.log('=== Chatwork通知テスト開始 ===');
console.log('実行時刻:', new Date().toISOString());

// 必要なモジュールをインポート
const { sendChatworkMessage } = require('./chatworkApi');
const MultiUserChatworkSender = require('./multiUserChatworkSender');

// テスト実行
async function testNotifications() {
    try {
        console.log('\n1. 基本的なChatwork API接続テスト');
        console.log('----------------------------------------');
        
        // ユーザー設定の読み込み
        const fs = require('fs');
        const userSettings = JSON.parse(fs.readFileSync('./user_settings/7fe7e401-a67b-40fb-bdff-0b61b67dc116.json', 'utf8'));
        
        console.log('ユーザー設定読み込み完了:');
        console.log('- Chatwork Room ID:', userSettings.chatwork_room_id);
        console.log('- スケジューラー有効:', userSettings.enable_scheduler);
        console.log('- Chatwork有効:', userSettings.enable_chatwork);
        console.log('- 日次レポート有効:', userSettings.daily_report_enabled);
        console.log('- 更新通知有効:', userSettings.update_notifications_enabled);
        console.log('- アラート通知有効:', userSettings.alert_notifications_enabled);
        
        // 1. 基本的なメッセージ送信テスト
        console.log('\n2. 基本メッセージ送信テスト');
        console.log('----------------------------------------');
        const basicResult = await sendChatworkMessage({
            date: new Date().toISOString().split('T')[0],
            message: `[info][title]🔧 Chatwork通知テスト[/title]
テスト送信時刻: ${new Date().toLocaleString('ja-JP')}

通知システムの接続テストです。
このメッセージが届いていれば、基本的な通知機能は正常に動作しています。

確認項目:
✅ Chatwork API接続
✅ トークン認証
✅ ルームID設定[/info]`,
            token: userSettings.chatwork_api_token,
            room_id: userSettings.chatwork_room_id
        });
        
        if (basicResult.success || !basicResult.error) {
            console.log('✅ 基本メッセージ送信成功');
        } else {
            console.log('❌ 基本メッセージ送信失敗:', basicResult.error);
            return;
        }
        
        // 2. MultiUserChatworkSenderのテスト
        console.log('\n3. マルチユーザー通知システムテスト');
        console.log('----------------------------------------');
        const multiSender = new MultiUserChatworkSender();
        
        // ユーザー設定を整形
        const testUserSettings = {
            user_id: '7fe7e401-a67b-40fb-bdff-0b61b67dc116',
            ...userSettings
        };
        
        // 日次レポートのテスト送信
        console.log('\n3-1. 日次レポートテスト送信');
        await multiSender.sendTestDailyReport(testUserSettings);
        console.log('✅ 日次レポートテスト送信完了');
        
        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 更新通知のテスト送信
        console.log('\n3-2. 更新通知テスト送信');
        await multiSender.sendUserUpdateNotification(testUserSettings, true);
        console.log('✅ 更新通知テスト送信完了');
        
        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // アラート通知のテスト送信
        console.log('\n3-3. アラート通知テスト送信');
        await multiSender.sendUserAlertNotification(testUserSettings, true);
        console.log('✅ アラート通知テスト送信完了');
        
        console.log('\n=== テスト完了 ===');
        console.log('送信された通知:');
        console.log('1. 基本接続テストメッセージ');
        console.log('2. 日次レポート（テスト版）');
        console.log('3. 更新通知（テスト版）');
        console.log('4. アラート通知（テスト版）');
        console.log('\nChatworkでメッセージが受信できているか確認してください。');
        
    } catch (error) {
        console.error('\n❌ テスト実行中にエラーが発生しました:');
        console.error('エラー内容:', error.message);
        console.error('スタックトレース:', error.stack);
    }
}

// テスト実行
testNotifications().then(() => {
    console.log('\n処理終了');
    process.exit(0);
}).catch(error => {
    console.error('予期しないエラー:', error);
    process.exit(1);
});