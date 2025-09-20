// test-day-over-day.js - 前日比アラート機能のテストスクリプト
const ChatworkAutoSender = require('./chatworkAutoSender');
const DayOverDayScheduler = require('./dayOverDayScheduler');
const { checkDayOverDayAlerts } = require('./dayOverDayAlertSystem');

console.log('===========================================');
console.log('前日比アラート機能テスト');
console.log('===========================================\n');

async function testDayOverDayAlerts() {
    try {
        // テスト1: 前日比アラートロジックのテスト（モックデータ使用）
        console.log('📝 テスト1: アラート生成ロジックのテスト');
        console.log('-------------------------------------------');
        
        // モックデータ（前日）
        const previousData = {
            spend: 3000,
            budgetRate: 80,
            ctr: 1.0,
            cpm: 1200,
            conversions: 5,
            cpa: 600,
            frequency: 1.5
        };
        
        // モックデータ（当日 - 大幅な変化あり）
        const currentData = {
            spend: 2000,
            budgetRate: 50,
            ctr: 0.6,      // 40%下落（アラート対象）
            cpm: 1600,      // 33%上昇（アラート対象）
            conversions: 2,  // 60%下落（アラート対象）
            cpa: 1000,      // 66%上昇（アラート対象）
            frequency: 2.2   // 46%上昇（アラート対象）
        };
        
        console.log('前日データ:', previousData);
        console.log('当日データ:', currentData);
        console.log('');
        
        // アラートチェック実行
        const alerts = await checkDayOverDayAlerts(currentData, previousData, 'test_user');
        
        if (alerts.length > 0) {
            console.log(`✅ ${alerts.length}件のアラートが生成されました：`);
            alerts.forEach((alert, index) => {
                console.log(`\n${index + 1}. ${alert.message}`);
                console.log(`   重要度: ${alert.severity}`);
                console.log(`   変化率: ${alert.changePercent}%`);
            });
        } else {
            console.log('❌ アラートが生成されませんでした（想定外）');
        }
        
        console.log('\n');
        
        // テスト2: 実際のMeta APIデータでのテスト
        console.log('📝 テスト2: 実際のAPIデータでのテスト');
        console.log('-------------------------------------------');
        
        const chatworkSender = new ChatworkAutoSender();
        const scheduler = new DayOverDayScheduler(chatworkSender);
        
        // データ取得（実際のAPI呼び出し）
        console.log('Meta APIからデータ取得中...');
        const comparisonData = await scheduler.fetchComparisonData('test@example.com');
        
        if (comparisonData) {
            console.log(`✅ データ取得成功`);
            console.log(`   比較期間: ${comparisonData.dates.previous} → ${comparisonData.dates.current}`);
            console.log(`   前日の消化金額: ${comparisonData.previous.spend}円`);
            console.log(`   当日の消化金額: ${comparisonData.current.spend}円`);
            
            // アラートチェック
            const realAlerts = await checkDayOverDayAlerts(
                comparisonData.current,
                comparisonData.previous,
                'test@example.com'
            );
            
            if (realAlerts.length > 0) {
                console.log(`\n🚨 ${realAlerts.length}件の前日比アラートが検出されました`);
                realAlerts.forEach((alert, index) => {
                    console.log(`\n${index + 1}. ${alert.message}`);
                });
            } else {
                console.log('\n✅ 前日比で大きな変化はありませんでした');
            }
        } else {
            console.log('❌ データ取得失敗');
        }
        
        console.log('\n');
        
        // テスト3: チャットワーク送信テスト（実際には送信しない）
        console.log('📝 テスト3: チャットワーク送信フォーマットテスト');
        console.log('-------------------------------------------');
        
        if (alerts.length > 0) {
            let testMessage = `📊 Meta広告 前日比アラート
比較期間: 2025-09-10 → 2025-09-11

以下の指標で大きな変化がありました：

`;
            alerts.forEach((alert, index) => {
                const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
                testMessage += `${icon} ${index + 1}. ${alert.message}\n`;
                
                if (alert.changePercent > 0) {
                    testMessage += `   ↑ ${Math.abs(alert.changePercent)}%上昇\n`;
                } else {
                    testMessage += `   ↓ ${Math.abs(alert.changePercent)}%下落\n`;
                }
            });

            testMessage += `
詳細確認：https://meta-ads-dashboard.onrender.com/dashboard
アラート履歴：https://meta-ads-dashboard.onrender.com/alerts

※前日比で20%以上の変化があった指標を表示しています`;

            console.log('送信予定メッセージ:');
            console.log('---');
            console.log(testMessage);
            console.log('---');
        }
        
        console.log('\n===========================================');
        console.log('✅ テスト完了');
        console.log('===========================================');
        
    } catch (error) {
        console.error('❌ テストエラー:', error);
        console.error('エラー詳細:', error.stack);
    }
}

// テスト実行
testDayOverDayAlerts().then(() => {
    console.log('\nテストスクリプト終了');
    process.exit(0);
}).catch(error => {
    console.error('致命的エラー:', error);
    process.exit(1);
});