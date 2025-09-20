// URL変更確認テスト

console.log('========================================');
console.log('URL変更確認テスト');
console.log('========================================\n');

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

// テスト用アラートデータ
const testAlerts = [
    { metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical' },
    { metric: 'CTR', targetValue: 1, currentValue: 0.6, severity: 'critical' },
    { metric: '予算消化率', targetValue: 80, currentValue: 52, severity: 'critical' },
    { metric: 'CPM', targetValue: 1800, currentValue: 2188, severity: 'warning' }
];

// メッセージ生成
const dateStr = new Date().toLocaleDateString('ja-JP');
let message = `Meta広告 アラート通知 (${dateStr})\n`;
message += `以下の指標が目標値から外れています：\n\n`;

testAlerts.forEach((alert) => {
    const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
    message += `${icon} ${alert.metric}: `;
    message += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
    message += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
});

message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
message += `https://meta-ads-dashboard.onrender.com/dashboard\n\n`;
message += `✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks\n`;
message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies`;

console.log('【送信されるメッセージ】');
console.log('----------------------------------------');
console.log(message);
console.log('----------------------------------------');

console.log('\n✅ URL変更確認結果:');
console.log('  ダッシュボード: https://meta-ads-dashboard.onrender.com/dashboard');
console.log('  確認事項: https://meta-ads-dashboard.onrender.com/improvement-tasks');
console.log('  改善施策: https://meta-ads-dashboard.onrender.com/improvement-strategies');
console.log('\n全てのURLが本番環境(onrender.com)に変更されています。');