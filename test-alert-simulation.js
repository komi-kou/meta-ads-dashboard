// アラート重複解消シミュレーション
const fs = require('fs');
const path = require('path');

// アラート履歴データを読み込み
const alertHistoryPath = path.join(__dirname, 'alert_history.json');
const alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));

console.log('========================================');
console.log('現在の状況分析');
console.log('========================================');

// 現在のアクティブアラート
const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
console.log(`\n総アラート数: ${alertHistory.length}件`);
console.log(`アクティブアラート数: ${activeAlerts.length}件`);

// メトリクス別集計
const metricCounts = {};
activeAlerts.forEach(alert => {
    const key = `${alert.metric}: ${alert.currentValue}`;
    metricCounts[key] = (metricCounts[key] || 0) + 1;
});

console.log('\n【重複アラート一覧】');
Object.entries(metricCounts)
    .filter(([key, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .forEach(([key, count]) => {
        console.log(`  ${key} → ${count}件`);
    });

console.log('\n========================================');
console.log('修正案1: 重複を排除（同一メトリック・同一値は1つに集約）');
console.log('========================================');

// 重複を排除したアラート
const uniqueAlerts = [];
const seen = new Set();

activeAlerts
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // 最新を優先
    .forEach(alert => {
        const key = `${alert.metric}_${alert.currentValue}_${alert.targetValue}`;
        if (!seen.has(key)) {
            seen.add(key);
            uniqueAlerts.push(alert);
        }
    });

// フォーマット関数（multiUserChatworkSender.jsから）
function formatValue(value, metric) {
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
}

// 重要度順にソート
const sortedAlerts = uniqueAlerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    // 同じ重要度の場合は、メトリック順
    const metricOrder = ['CV', 'CTR', 'CPM', 'CPA', '予算消化率'];
    return metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric);
});

// メッセージ生成
const dateStr = new Date().toLocaleDateString('ja-JP');
let message1 = `Meta広告 アラート通知 (${dateStr})\n`;
message1 += `以下の指標が目標値から外れています：\n\n`;

sortedAlerts.slice(0, 10).forEach((alert) => {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    message1 += `${icon} ${alert.metric}: `;
    message1 += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
    message1 += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
});

if (sortedAlerts.length > 10) {
    message1 += `\n...他${sortedAlerts.length - 10}件のアラート\n`;
}

message1 += `\n📊 詳細はダッシュボードでご確認ください：\n`;
message1 += `http://localhost:3000/dashboard\n\n`;
message1 += `✅ 確認事項：http://localhost:3000/improvement-tasks\n`;
message1 += `💡 改善施策：http://localhost:3000/improvement-strategies`;

console.log('\n【修正後のメッセージ】');
console.log('----------------------------------------');
console.log(message1);
console.log('----------------------------------------');
console.log(`\n表示アラート数: ${Math.min(sortedAlerts.length, 10)}件（重複なし）`);
console.log(`削減数: ${activeAlerts.length - sortedAlerts.length}件の重複を削除`);

console.log('\n========================================');
console.log('修正案2: メトリック別に最新の1件のみ表示');
console.log('========================================');

// メトリック別に最新の1件のみを取得
const latestByMetric = {};
activeAlerts
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach(alert => {
        if (!latestByMetric[alert.metric]) {
            latestByMetric[alert.metric] = alert;
        }
    });

const latestAlerts = Object.values(latestByMetric);

// 重要度順にソート
const sortedLatest = latestAlerts.sort((a, b) => {
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (a.severity !== 'critical' && b.severity === 'critical') return 1;
    const metricOrder = ['CV', 'CTR', 'CPM', 'CPA', '予算消化率'];
    return metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric);
});

// メッセージ生成
let message2 = `Meta広告 アラート通知 (${dateStr})\n`;
message2 += `以下の指標が目標値から外れています：\n\n`;

sortedLatest.forEach((alert) => {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    message2 += `${icon} ${alert.metric}: `;
    message2 += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
    message2 += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
});

message2 += `\n📊 詳細はダッシュボードでご確認ください：\n`;
message2 += `http://localhost:3000/dashboard\n\n`;
message2 += `✅ 確認事項：http://localhost:3000/improvement-tasks\n`;
message2 += `💡 改善施策：http://localhost:3000/improvement-strategies`;

console.log('\n【修正後のメッセージ】');
console.log('----------------------------------------');
console.log(message2);
console.log('----------------------------------------');
console.log(`\n表示アラート数: ${sortedLatest.length}件（各メトリック最新1件）`);
console.log(`削減数: ${activeAlerts.length - sortedLatest.length}件を削減`);

console.log('\n========================================');
console.log('比較結果');
console.log('========================================');
console.log('現在: 重複を含む68件から上位10件を表示（CV×6, CTR×41など）');
console.log('修正案1: 同一値の重複を排除して表示');
console.log('修正案2: 各メトリックの最新1件のみ表示（最もシンプル）');
console.log('\n推奨: 修正案1（同一値の重複は排除するが、異なる値は表示）');