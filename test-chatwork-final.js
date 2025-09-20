// 最終動作確認テスト
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

console.log('========================================');
console.log('Chatworkテスト最終動作確認');
console.log('========================================\n');

async function testAllFeatures() {
    const sender = new MultiUserChatworkSender();
    
    // テスト用設定（実際のトークンが必要な場合は環境変数から取得）
    const testSettings = {
        user_id: 'test_user',
        daily_report_enabled: true,
        update_notifications_enabled: true,
        alert_notifications_enabled: true,
        meta_access_token: 'dummy_meta_token',
        meta_account_id: 'dummy_meta_account',
        chatwork_token: process.env.CHATWORK_TOKEN || 'dummy_test_token',
        chatwork_room_id: process.env.CHATWORK_ROOM_ID || 'dummy_test_room'
    };
    
    console.log('テスト設定:');
    console.log('  chatwork_token:', testSettings.chatwork_token ? testSettings.chatwork_token.substring(0, 10) + '...' : 'なし');
    console.log('  chatwork_room_id:', testSettings.chatwork_room_id);
    console.log('');
    
    // ===== 1. 日次レポートテスト =====
    console.log('【1. 日次レポートテスト】');
    console.log('----------------------------------------');
    
    try {
        // テスト専用メソッドを直接呼び出し
        console.log('📝 sendTestDailyReport()を直接呼び出し...');
        const result = await sender.sendTestDailyReport(testSettings);
        
        if (result && result.success) {
            console.log('✅ 日次レポートテスト成功');
            console.log('   期待される結果:');
            console.log('   - CTR: 0.8%');
            console.log('   - CPM: 1,946円');
            console.log('   - フリークエンシー: 1.3');
        } else {
            console.log('❌ 日次レポートテスト失敗:', result?.error);
        }
    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
    
    console.log('');
    
    // ===== 2. sendUserDailyReportのテストモード =====
    console.log('【2. sendUserDailyReport(isTestMode=true)】');
    console.log('----------------------------------------');
    
    try {
        console.log('📝 テストモードで実行...');
        await sender.sendUserDailyReport(testSettings, true);
        console.log('✅ テストモード実行完了');
    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
    
    console.log('');
    
    // ===== 3. アラート通知テスト =====
    console.log('【3. アラート通知テスト】');
    console.log('----------------------------------------');
    
    try {
        console.log('🚨 アラート通知テスト送信...');
        await sender.sendUserAlertNotification(testSettings, true);
        console.log('✅ アラート通知テスト完了');
    } catch (error) {
        console.error('❌ エラー:', error.message);
    }
    
    console.log('');
    
    // ===== 4. デバッグ情報 =====
    console.log('【4. デバッグ情報】');
    console.log('----------------------------------------');
    
    // require.cacheの確認
    const cacheKeys = Object.keys(require.cache).filter(k => k.includes('multiUserChatworkSender'));
    console.log('require.cache内のmultiUserChatworkSender:');
    cacheKeys.forEach(key => {
        const stat = require('fs').statSync(key);
        console.log('  ', key.split('/').pop(), '- 更新時刻:', stat.mtime);
    });
    
    console.log('');
    console.log('========================================');
    console.log('テスト完了');
    console.log('========================================');
    console.log('');
    console.log('📌 確認ポイント:');
    console.log('1. CTR、CPM、フリークエンシーが適切な桁数で表示されているか');
    console.log('2. テスト専用メソッドが呼ばれているか（Meta APIは呼ばれないはず）');
    console.log('3. アラートの重複が排除されているか');
    console.log('4. Chatworkトークンが正しく設定されているか');
}

// 実行
testAllFeatures().catch(error => {
    console.error('テスト実行エラー:', error);
    process.exit(1);
});