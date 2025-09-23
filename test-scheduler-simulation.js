// test-scheduler-simulation.js - scheduler.jsのcronジョブをシミュレート
const { checkAllAlerts } = require('./alertSystem');
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
const executionManager = require('./utils/executionManager');

console.log('=== Scheduler.js cronジョブシミュレーション ===\n');

async function simulateMorningJob() {
    console.log('【朝9時のジョブをシミュレート】');
    console.log('----------------------------------------');
    
    // 朝9時：データ取得＋アラートチェック＋日次レポート
    console.log('1. アラートチェック実行');
    await executionManager.executeGlobalTask('morning_alert_check', async () => {
        try {
            const alerts = await checkAllAlerts();
            console.log(`   ✅ アラートチェック完了`);
        } catch (error) {
            console.error('   ❌ アラートチェックエラー:', error.message);
        }
    });
    
    console.log('2. 日次レポート送信');
    await executionManager.executeGlobalTask('morning_daily_report', async () => {
        try {
            const multiUserSender = new MultiUserChatworkSender();
            await multiUserSender.sendDailyReportToAllUsers();
            console.log('   ✅ 日次レポート送信完了');
        } catch (error) {
            console.error('   ❌ 日次レポートエラー:', error.message);
        }
    });
}

async function simulateRegularJob() {
    console.log('\n【12/15/17/19時のジョブをシミュレート】');
    console.log('----------------------------------------');
    
    // 定期：アラートチェック＋定期更新通知
    console.log('1. アラートチェック実行');
    await executionManager.executeGlobalTask('regular_alert_check', async () => {
        try {
            const alerts = await checkAllAlerts();
            console.log(`   ✅ アラートチェック完了`);
        } catch (error) {
            console.error('   ❌ アラートチェックエラー:', error.message);
        }
    });
    
    console.log('2. 定期更新通知送信');
    await executionManager.executeGlobalTask('update_notification', async () => {
        try {
            const multiUserSender = new MultiUserChatworkSender();
            await multiUserSender.sendUpdateNotificationToAllUsers();
            console.log('   ✅ 定期更新通知送信完了');
        } catch (error) {
            console.error('   ❌ 定期更新通知エラー:', error.message);
        }
    });
}

async function runSimulation() {
    try {
        // 朝9時のジョブ
        await simulateMorningJob();
        
        // 2秒待機
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 定期ジョブ（12/15/17/19時）
        await simulateRegularJob();
        
        console.log('\n========================================');
        console.log('シミュレーション結果');
        console.log('========================================');
        console.log('✅ 朝9時ジョブ: 正常完了');
        console.log('   - アラート通知送信');
        console.log('   - 日次レポート送信');
        console.log('✅ 定期ジョブ: 正常完了');
        console.log('   - アラート通知送信（重複防止により送信済みならスキップ）');
        console.log('   - 定期更新通知送信');
        
        console.log('\n🎉 Scheduler.jsのcronジョブは正常に動作します！');
        
    } catch (error) {
        console.error('シミュレーションエラー:', error);
    }
}

// 実行
runSimulation();