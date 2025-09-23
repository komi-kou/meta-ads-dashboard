// test-daily-report.js - 日次レポートのテスト送信
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

async function testDailyReport() {
    console.log('=== 日次レポートテスト開始 ===\n');
    
    const multiUserSender = new MultiUserChatworkSender();
    
    const userSettings = {
        user_id: 'b4475ace-303e-4fd1-8740-221154c9b291',
        meta_access_token: 'EAAcUd0aSHKMBPG6f5enFvnu9I2Txcgulz7uHw0INre8ka8q4O0owf42kPnGePZAzPEPKeJbpWWAzulEUKVv6LkdNwiVisDmonyJW7OrU0L9X0Fynzc3X2RcXZBMBjLj7XsjP15G25CjiejDMe6DOXhqsMT4SdeZBwKuEqC202ETupxSmO9CFkHqGrlyIoPD5hp3BjsoCguD8i0F',
        meta_account_id: 'act_1165556408678089',
        chatwork_token: '10e7538af625f74890e0f0bc4747c976',
        chatwork_room_id: '408053863',
        daily_report_enabled: true
    };
    
    try {
        console.log('ユーザー情報:');
        console.log('  ID: b4475ace-303e-4fd1-8740-221154c9b291');
        console.log('  メール: komiya11122@gmail.com');
        console.log('  ルームID: 408053863\n');
        
        console.log('日次レポート送信中...');
        
        // テストモードで送信（実際のMeta APIデータを使用）
        await multiUserSender.sendUserDailyReport(userSettings, false);
        
        console.log('\n✅ 日次レポート送信成功！');
        console.log('チャットワークルーム408053863を確認してください。');
        
    } catch (error) {
        console.error('\n❌ エラー:', error.message);
        console.error(error.stack);
    }
    
    console.log('\n=== 日次レポートテスト完了 ===');
}

// 実行
testDailyReport();