// 現在のアラート状況シミュレーション
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('現在のアラート送信シミュレーション');
console.log('========================================\n');

// alert_history.jsonから現在のアクティブアラートを取得
const historyPath = path.join(__dirname, 'alert_history.json');
const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';

// アクティブアラートを抽出
const activeAlerts = history.filter(h => 
    h.status === 'active' && 
    h.userId === userId
);

console.log('【現在の状況】');
console.log(`アクティブアラート総数: ${activeAlerts.length}件`);

// メトリック別集計
const byMetric = {};
activeAlerts.forEach(alert => {
    if (!byMetric[alert.metric]) byMetric[alert.metric] = [];
    byMetric[alert.metric].push({
        target: alert.targetValue,
        current: alert.currentValue,
        timestamp: alert.timestamp,
        severity: alert.severity
    });
});

console.log('\nメトリック別詳細:');
Object.entries(byMetric).forEach(([metric, alerts]) => {
    console.log(`  ${metric}: ${alerts.length}件`);
    alerts.forEach(a => {
        console.log(`    - 目標${a.target} → 実績${a.current} (${new Date(a.timestamp).toLocaleString()})`);
    });
});

console.log('\n========================================');
console.log('修正案2適用後のシミュレーション');
console.log('========================================\n');

// 修正案2: 各メトリックの最新1件のみ
const latestByMetric = {};
activeAlerts
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach(alert => {
        if (!latestByMetric[alert.metric]) {
            latestByMetric[alert.metric] = alert;
        }
    });

const uniqueAlerts = Object.values(latestByMetric);
console.log(`重複排除後: ${uniqueAlerts.length}件（各メトリック最新1件）`);

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

console.log('\n【送信されるメッセージ】');
console.log('----------------------------------------');
const dateStr = new Date().toLocaleDateString('ja-JP');
let message = `Meta広告 アラート通知 (${dateStr})\n`;
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
message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies`;

console.log(message);
console.log('----------------------------------------');

console.log('\n【問題の原因】');
if (activeAlerts.length > uniqueAlerts.length) {
    console.log('❌ 同じメトリックのアラートが複数存在しています');
    console.log('   原因: アラート生成が複数回実行され、古いアラートが解決されていない');
    console.log('\n【解決策】');
    console.log('✅ 修正案2により各メトリックの最新1件のみ表示');
    console.log('✅ 古いアラートは自動的に解決済みに変更');
} else {
    console.log('✅ 重複はありません');
}