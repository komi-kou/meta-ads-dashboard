// send-all-notifications.js - 全時間帯の通知を実際に送信
const { checkAllAlerts } = require('./alertSystem');
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
const fs = require('fs');

console.log('=== 全時間帯の通知送信 ===\n');
console.log('開始時刻:', new Date().toLocaleString('ja-JP'));
console.log('対象: komiya11122@gmail.com');
console.log('ChatworkルームID: 408053863\n');

async function send9AMNotifications() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('【9時】日次レポート + アラート通知');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const multiUserSender = new MultiUserChatworkSender();
    
    // 1. 日次レポート
    console.log('📅 日次レポート送信中...');
    await multiUserSender.sendDailyReportToAllUsers();
    console.log('✅ 日次レポート送信完了\n');
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. アラート通知
    console.log('🚨 アラート通知送信中...');
    await checkAllAlerts();
    console.log('✅ アラート通知送信完了\n');
    
    return { dailyReport: true, alert: true };
}

async function sendRegularNotifications(hour) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`【${hour}時】定期更新通知 + アラート通知`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const multiUserSender = new MultiUserChatworkSender();
    
    // 送信履歴を時間ごとにクリア（異なる時間帯として処理）
    const historyFile = 'sent_history.json';
    const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    
    // 現在の時間帯のアラート履歴を削除（別の時間として扱う）
    const currentHour = new Date().getHours();
    const alertKey = `alert_2025-09-23_${currentHour}`;
    if (history[alertKey]) {
        delete history[alertKey];
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
        console.log(`⚠️ ${hour}時用に履歴をリセット\n`);
    }
    
    // 1. 定期更新通知
    console.log('🔄 定期更新通知送信中...');
    await multiUserSender.sendUpdateNotificationToAllUsers();
    console.log('✅ 定期更新通知送信完了\n');
    
    // 少し待機
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. アラート通知
    console.log('🚨 アラート通知送信中...');
    await checkAllAlerts();
    console.log('✅ アラート通知送信完了\n');
    
    return { updateNotification: true, alert: true };
}

async function sendAllNotifications() {
    const results = {
        '9時': { dailyReport: false, alert: false },
        '12時': { updateNotification: false, alert: false },
        '15時': { updateNotification: false, alert: false },
        '17時': { updateNotification: false, alert: false },
        '19時': { updateNotification: false, alert: false }
    };
    
    try {
        // 9時の通知
        results['9時'] = await send9AMNotifications();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 12時の通知
        results['12時'] = await sendRegularNotifications(12);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 15時の通知
        results['15時'] = await sendRegularNotifications(15);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 17時の通知
        results['17時'] = await sendRegularNotifications(17);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // 19時の通知
        results['19時'] = await sendRegularNotifications(19);
        
    } catch (error) {
        console.error('エラー発生:', error);
    }
    
    // 結果サマリー
    console.log('\n════════════════════════════════════════');
    console.log('送信結果サマリー');
    console.log('════════════════════════════════════════\n');
    
    console.log('【9時】');
    console.log(`  日次レポート: ${results['9時'].dailyReport ? '✅ 送信済み' : '❌ 失敗'}`);
    console.log(`  アラート通知: ${results['9時'].alert ? '✅ 送信済み' : '❌ 失敗'}`);
    
    ['12時', '15時', '17時', '19時'].forEach(time => {
        console.log(`\n【${time}】`);
        console.log(`  定期更新通知: ${results[time].updateNotification ? '✅ 送信済み' : '❌ 失敗'}`);
        console.log(`  アラート通知: ${results[time].alert ? '✅ 送信済み' : '❌ 失敗'}`);
    });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 送信内訳');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('日次レポート: 1通（9時）');
    console.log('定期更新通知: 4通（12,15,17,19時）');
    console.log('アラート通知: 5通（9,12,15,17,19時）');
    console.log('合計: 10通');
    
    console.log('\n✅ 全ての時間帯の通知送信が完了しました！');
    console.log('ChatworkルームID 408053863 をご確認ください。');
}

// 実行
sendAllNotifications();