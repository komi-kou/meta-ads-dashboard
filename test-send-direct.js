// 直接Chatworkに送信テスト
const { sendChatworkMessage } = require('./chatworkApi');
const fs = require('fs');
const path = require('path');

async function testDirectSend() {
    console.log('========================================');
    console.log('Chatwork直接送信テスト');
    console.log('========================================\n');
    
    // ユーザー設定を取得
    const userSettingsPath = path.join(__dirname, 'data/user_settings/b4475ace-303e-4fd1-8740-221154c9b291.json');
    const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
    
    // アラート履歴から最新のアクティブアラートを取得
    const historyPath = path.join(__dirname, 'alert_history.json');
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    
    const activeAlerts = history.filter(h => 
        h.status === 'active' && 
        h.userId === userId
    );
    
    console.log(`アクティブアラート: ${activeAlerts.length}件`);
    
    // 重複排除
    const latestByMetric = {};
    activeAlerts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .forEach(alert => {
            if (!latestByMetric[alert.metric]) {
                latestByMetric[alert.metric] = alert;
            }
        });
    
    const uniqueAlerts = Object.values(latestByMetric);
    console.log(`重複排除後: ${uniqueAlerts.length}件`);
    
    // ソート
    const sortedAlerts = uniqueAlerts.sort((a, b) => {
        if (a.severity === 'critical' && b.severity !== 'critical') return -1;
        if (a.severity !== 'critical' && b.severity === 'critical') return 1;
        const metricOrder = ['CV', 'CTR', 'CPM', 'CPA', '予算消化率'];
        return metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric);
    });
    
    // フォーマット関数
    const formatValue = (value, metric) => {
        switch (metric.toLowerCase()) {
            case 'ctr':
            case 'cvr':
                return `${Math.round(value * 10) / 10}%`;
            case 'budget_rate':
            case '予算消化率':
                return `${Math.round(value)}%`;
            case 'conversions':
            case 'cv':
                return `${Math.round(value)}件`;
            case 'cpa':
            case 'cpm':
            case 'cpc':
                return `${Math.round(value).toLocaleString('ja-JP')}円`;
            default:
                return value.toString();
        }
    };
    
    // メッセージ生成
    const dateStr = new Date().toLocaleDateString('ja-JP');
    let message = `[info][title]Meta広告 アラート通知テスト (${dateStr})[/title]\n`;
    message += `以下の指標が目標値から外れています：\n\n`;
    
    sortedAlerts.forEach((alert) => {
        const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
        message += `${icon} ${alert.metric}: `;
        message += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
        message += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
    });
    
    message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
    message += `https://meta-ads-dashboard.onrender.com/dashboard\n\n`;
    message += `✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks\n`;
    message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies\n\n`;
    message += `※これはテスト送信です[/info]`;
    
    console.log('【送信メッセージ】');
    console.log('----------------------------------------');
    console.log(message);
    console.log('----------------------------------------\n');
    
    try {
        console.log('送信中...');
        await sendChatworkMessage({
            date: new Date().toISOString().split('T')[0],
            message: message,
            token: userSettings.chatwork_api_token,
            room_id: userSettings.chatwork_room_id
        });
        
        console.log('\n✅ 送信成功！');
        console.log('\nChatworkを確認してください:');
        console.log('  Room ID:', userSettings.chatwork_room_id);
        console.log('  各メトリック最新1件のみ表示されているか');
        console.log('  数値フォーマットが適切か（CTR: 1桁、CPM: 整数）');
        console.log('  URLが本番環境になっているか');
        
    } catch (error) {
        console.error('❌ 送信エラー:', error.message);
        if (error.response) {
            console.error('レスポンス:', error.response.data);
        }
    }
}

// 確認プロンプト
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('⚠️  このテストは実際にChatworkにメッセージを送信します。');
console.log('Room ID: 408053863 に送信されます。\n');

rl.question('続行しますか？ (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        rl.close();
        testDirectSend();
    } else {
        console.log('テストをキャンセルしました。');
        rl.close();
    }
});