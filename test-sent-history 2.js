// test-sent-history.js - 送信履歴機能のテスト
const { checkSentHistory, recordSentHistory } = require('./alertSystemExtensions');
const fs = require('fs');

console.log('=== 送信履歴機能テスト ===\n');

// 1. 現在の履歴を表示
console.log('1. 現在の送信履歴:');
const history = JSON.parse(fs.readFileSync('sent_history.json', 'utf8'));
Object.entries(history).forEach(([key, value]) => {
    console.log(`   - ${key}: ${value}`);
});

// 2. 同じ時間帯での重複チェック
console.log('\n2. 重複防止テスト:');
console.log('   alert (18時台):', checkSentHistory('alert') ? '送信可能' : '既に送信済み');
console.log('   daily_report (18時台):', checkSentHistory('daily_report') ? '送信可能' : '既に送信済み');
console.log('   update (18時台):', checkSentHistory('update') ? '送信可能' : '既に送信済み');

// 3. 日次レポート送信をシミュレート
console.log('\n3. 日次レポート送信シミュレート:');
if (checkSentHistory('daily_report')) {
    recordSentHistory('daily_report');
    console.log('   ✅ 日次レポートの送信履歴を記録');
} else {
    console.log('   ⚠️ 日次レポートは既に送信済み');
}

// 4. 更新後の履歴を確認
console.log('\n4. 更新後の送信履歴:');
const updatedHistory = JSON.parse(fs.readFileSync('sent_history.json', 'utf8'));
Object.entries(updatedHistory).forEach(([key, value]) => {
    console.log(`   - ${key}: ${value}`);
});

console.log('\n✅ 送信履歴機能テスト完了！');