// test-all-functions.js - 全機能の個別テスト
const { checkAllAlerts } = require('./alertSystem');
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

async function testAllFunctions() {
    console.log('=== 全機能個別テスト ===\n');
    console.log('時刻:', new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    
    const multiUserSender = new MultiUserChatworkSender();
    let testResults = {
        userManager: false,
        alertCheck: false,
        alertSend: false,
        dailyReport: false,
        updateNotification: false
    };
    
    try {
        // 1. UserManager動作確認
        console.log('\n【1. UserManager動作テスト】');
        console.log('----------------------------------------');
        try {
            const activeUsers = multiUserSender.getAllActiveUsers();
            console.log(`アクティブユーザー数: ${activeUsers.length}`);
            if (activeUsers.length > 0) {
                console.log(`ユーザー: ${activeUsers[0].email}`);
                testResults.userManager = true;
                console.log('✅ UserManager: 正常');
            }
        } catch (error) {
            console.error('❌ UserManagerエラー:', error.message);
        }
        
        // 2. アラートチェック＆送信
        console.log('\n【2. アラートチェック＆送信テスト】');
        console.log('----------------------------------------');
        try {
            const alerts = await checkAllAlerts();
            testResults.alertCheck = true;
            testResults.alertSend = true;
            console.log('✅ アラートチェック: 正常');
            console.log('✅ アラート送信: 完了');
        } catch (error) {
            console.error('❌ アラートエラー:', error.message);
        }
        
        // 待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 3. 日次レポート（MultiUserChatworkSender経由）
        console.log('\n【3. 日次レポート送信テスト】');
        console.log('----------------------------------------');
        try {
            await multiUserSender.sendDailyReportToAllUsers();
            testResults.dailyReport = true;
            console.log('✅ 日次レポート: 送信完了');
        } catch (error) {
            console.error('❌ 日次レポートエラー:', error.message);
        }
        
        // 待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. 定期更新通知
        console.log('\n【4. 定期更新通知送信テスト】');
        console.log('----------------------------------------');
        try {
            await multiUserSender.sendUpdateNotificationToAllUsers();
            testResults.updateNotification = true;
            console.log('✅ 定期更新通知: 送信完了');
        } catch (error) {
            console.error('❌ 定期更新通知エラー:', error.message);
        }
        
    } catch (error) {
        console.error('予期しないエラー:', error);
    }
    
    // テスト結果サマリー
    console.log('\n========================================');
    console.log('テスト結果サマリー');
    console.log('========================================');
    console.log('UserManager:', testResults.userManager ? '✅ 成功' : '❌ 失敗');
    console.log('アラートチェック:', testResults.alertCheck ? '✅ 成功' : '❌ 失敗');
    console.log('アラート送信:', testResults.alertSend ? '✅ 成功' : '❌ 失敗');
    console.log('日次レポート:', testResults.dailyReport ? '✅ 成功' : '❌ 失敗');
    console.log('定期更新通知:', testResults.updateNotification ? '✅ 成功' : '❌ 失敗');
    
    const successCount = Object.values(testResults).filter(r => r).length;
    console.log(`\n総合結果: ${successCount}/5 のテストが成功`);
    
    if (successCount === 5) {
        console.log('\n🎉 全機能が正常に動作しています！');
        console.log('\n【送信された通知】');
        console.log('1. アラート通知（CPM超過、CV未達成、予算消化率低下）');
        console.log('2. 日次レポート（昨日のデータ）');
        console.log('3. 定期更新通知');
        console.log('\n全てChatworkルーム 408053863 に送信されました。');
    }
}

// 実行
testAllFunctions();