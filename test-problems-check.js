// Chatworkテスト問題診断
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('Chatworkテスト問題診断');
console.log('========================================\n');

// 1. 日次レポートの桁問題を確認
console.log('【1. 日次レポートのフォーマット問題】');
console.log('----------------------------------------');

// chatworkAutoSender.js の日次レポートフォーマット（573-577行目）
console.log('現在のコード:');
console.log('  予算消化率（平均）：${dashboardData.budgetRate || "0.00"}%');
console.log('  CTR（平均）：${dashboardData.ctr || "0.00"}%');
console.log('  フリークエンシー（平均）：${dashboardData.frequency || "0.00"}');

console.log('\n問題: 小数点以下が長すぎる可能性');
console.log('例: 予算消化率 62.178% → 62% にすべき');
console.log('例: CTR 0.899888% → 0.9% にすべき\n');

// multiUserChatworkSender.js の日次レポートフォーマット（66-78行目）を確認
const senderPath = path.join(__dirname, 'utils/multiUserChatworkSender.js');
const senderContent = fs.readFileSync(senderPath, 'utf8');
const dailyReportLines = senderContent.split('\n').slice(65, 79);

console.log('multiUserChatworkSender.js の日次レポート（修正済み）:');
console.log('  予算消化率（平均）：${Math.round(data.budgetRate || 0)}%');
console.log('  CTR（平均）：${Math.round((data.ctr || 0) * 10) / 10}%');
console.log('  フリークエンシー（平均）：${Math.round((data.frequency || 0) * 10) / 10}');

console.log('\n========================================');
console.log('【2. テスト送信が届かない問題】');
console.log('========================================\n');

// テスト送信の流れを確認
console.log('アラート通知テストの流れ:');
console.log('1. /api/chatwork-test エンドポイント（app.js 4264行目）');
console.log('2. type="alert" の場合（app.js 4306行目）');
console.log('3. sender.sendUserAlertNotification(formattedSettings) を呼び出し');
console.log('4. multiUserChatworkSender.js の sendUserAlertNotification メソッド');

console.log('\n問題の可能性:');
console.log('❌ アラートが存在しない場合、送信されない');
console.log('❌ 重複送信チェックで既に送信済みと判定される');
console.log('❌ メッセージが生成されない\n');

// 3. アクセストークン更新通知テストの問題
console.log('アクセストークン更新通知テストの流れ:');
console.log('1. type="token" の場合（app.js 4309行目）');
console.log('2. ChatworkAutoSender を使用');
console.log('3. sendTokenUpdateNotificationWithUser(userId) を呼び出し');

console.log('\n問題の可能性:');
console.log('❌ ChatworkAutoSenderのsendMessage関数が正しく動作していない');
console.log('❌ メッセージは固定文言のため、送信処理自体に問題がある可能性\n');

// 4. 全テスト一括実行の問題
console.log('全テスト一括実行の流れ（chatwork-test.ejs 212行目）:');
console.log('1. sendAllTests() 関数が呼ばれる');
console.log('2. testTypes = ["daily", "update", "alert", "token"] を順次実行');
console.log('3. 各タイプで /api/chatwork-test を呼び出し');

console.log('\n問題の可能性:');
console.log('❌ 個別のテストが失敗しているため、全体も失敗');
console.log('❌ エラーハンドリングで処理が止まっている可能性\n');

// ChatworkAutoSenderとMultiUserChatworkSenderの違い
console.log('========================================');
console.log('【送信クラスの違い】');
console.log('========================================\n');

console.log('MultiUserChatworkSender:');
console.log('  - 日次レポート: sendUserDailyReport → 正常動作');
console.log('  - 定期更新通知: sendUserUpdateNotification → 正常動作');
console.log('  - アラート通知: sendUserAlertNotification → 送信されない？');
console.log('');
console.log('ChatworkAutoSender:');
console.log('  - トークン更新: sendTokenUpdateNotificationWithUser → 送信されない');
console.log('  - 使用するsendMessage関数が異なる可能性');

console.log('\n========================================');
console.log('【原因と対策】');
console.log('========================================\n');

console.log('1. 日次レポートの桁問題:');
console.log('   原因: chatworkAutoSender.js が古いフォーマットを使用');
console.log('   対策: Math.round()を使った適切な丸め処理を追加\n');

console.log('2. アラート通知テスト:');
console.log('   原因: アラートが存在しない、または重複送信チェック');
console.log('   対策: テストモード時は強制的にアラートを生成して送信\n');

console.log('3. トークン更新通知テスト:');
console.log('   原因: ChatworkAutoSenderのsendMessage実装の問題');
console.log('   対策: MultiUserChatworkSenderに統一するか、sendMessage修正\n');

console.log('4. 全テスト一括実行:');
console.log('   原因: 個別テストの失敗が連鎖');
console.log('   対策: 個別の問題を解決すれば自動的に解決');