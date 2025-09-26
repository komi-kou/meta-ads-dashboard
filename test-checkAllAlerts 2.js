// test-checkAllAlerts.js - checkAllAlertsの動作テスト
const { checkAllAlerts } = require('./alertSystem');

console.log('=== checkAllAlerts動作テスト ===\n');

async function testCheckAllAlerts() {
    try {
        console.log('1. checkAllAlerts実行');
        console.log('   現在時刻:', new Date().toLocaleString('ja-JP'));
        
        const result = await checkAllAlerts();
        
        console.log('\n2. 実行結果:');
        console.log('   正常に完了しました');
        
        // sent_history.jsonの内容を確認
        const fs = require('fs');
        const sentHistory = JSON.parse(fs.readFileSync('sent_history.json', 'utf8'));
        console.log('\n3. 送信履歴:');
        
        if (Object.keys(sentHistory).length > 0) {
            Object.entries(sentHistory).forEach(([key, value]) => {
                console.log(`   - ${key}: ${value}`);
            });
        } else {
            console.log('   履歴なし（アラートがないか、既に送信済み）');
        }
        
        console.log('\n✅ checkAllAlertsテスト成功！');
        
    } catch (error) {
        console.error('\n❌ エラー:', error.message);
        console.error(error.stack);
    }
}

testCheckAllAlerts();