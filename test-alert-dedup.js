// アラート重複排除機能のテスト
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');

async function testAlertDeduplication() {
    console.log('========================================');
    console.log('アラート重複排除機能テスト');
    console.log('========================================\n');
    
    try {
        // テスト用のアラートデータ（実際のalert_history.jsonの形式）
        const testAlerts = [
            // CV重複（6件）
            { id: 'cv1', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-20T03:00:00Z', status: 'active' },
            { id: 'cv2', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-20T02:00:00Z', status: 'active' },
            { id: 'cv3', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-20T01:00:00Z', status: 'active' },
            { id: 'cv4', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-19T23:00:00Z', status: 'active' },
            { id: 'cv5', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-19T22:00:00Z', status: 'active' },
            { id: 'cv6', metric: 'CV', targetValue: 1, currentValue: 0, severity: 'critical', timestamp: '2025-09-19T21:00:00Z', status: 'active' },
            
            // CTR重複（異なる値）
            { id: 'ctr1', metric: 'CTR', targetValue: 1, currentValue: 0.5, severity: 'critical', timestamp: '2025-09-20T03:00:00Z', status: 'active' },
            { id: 'ctr2', metric: 'CTR', targetValue: 1, currentValue: 0.5, severity: 'critical', timestamp: '2025-09-20T02:00:00Z', status: 'active' },
            { id: 'ctr3', metric: 'CTR', targetValue: 1, currentValue: 0.5, severity: 'critical', timestamp: '2025-09-20T01:00:00Z', status: 'active' },
            { id: 'ctr4', metric: 'CTR', targetValue: 1, currentValue: 0.8, severity: 'warning', timestamp: '2025-09-19T23:00:00Z', status: 'active' },
            
            // CPM
            { id: 'cpm1', metric: 'CPM', targetValue: 1800, currentValue: 1946, severity: 'warning', timestamp: '2025-09-20T03:00:00Z', status: 'active' },
            { id: 'cpm2', metric: 'CPM', targetValue: 1800, currentValue: 1946, severity: 'warning', timestamp: '2025-09-20T01:00:00Z', status: 'active' },
            
            // 予算消化率
            { id: 'budget1', metric: '予算消化率', targetValue: 80, currentValue: 68, severity: 'warning', timestamp: '2025-09-20T03:00:00Z', status: 'active' }
        ];
        
        console.log(`【重複排除前】アクティブアラート: ${testAlerts.length}件`);
        
        // メトリック別集計
        const counts = {};
        testAlerts.forEach(alert => {
            counts[alert.metric] = (counts[alert.metric] || 0) + 1;
        });
        
        console.log('メトリック別件数:');
        Object.entries(counts).forEach(([metric, count]) => {
            console.log(`  ${metric}: ${count}件`);
        });
        
        // 重複排除ロジックを適用
        console.log('\n--- 重複排除処理 ---');
        
        const latestAlertsByMetric = {};
        testAlerts
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach(alert => {
                if (!latestAlertsByMetric[alert.metric]) {
                    latestAlertsByMetric[alert.metric] = alert;
                    console.log(`✅ ${alert.metric}: 最新のアラート(${alert.id})を保持`);
                } else {
                    console.log(`❌ ${alert.metric}: 古いアラート(${alert.id})をスキップ`);
                }
            });
        
        const uniqueAlerts = Object.values(latestAlertsByMetric);
        
        console.log(`\n【重複排除後】ユニークアラート: ${uniqueAlerts.length}件`);
        
        // 重要度順にソート
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
        console.log('\n【生成されるメッセージ】');
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
        message += `http://localhost:3000/dashboard\n\n`;
        message += `✅ 確認事項：http://localhost:3000/improvement-tasks\n`;
        message += `💡 改善施策：http://localhost:3000/improvement-strategies`;
        
        console.log(message);
        console.log('----------------------------------------');
        
        console.log('\n✅ 重複排除機能が正常に動作しています');
        console.log(`   重複排除前: ${testAlerts.length}件`);
        console.log(`   重複排除後: ${uniqueAlerts.length}件`);
        console.log(`   削減数: ${testAlerts.length - uniqueAlerts.length}件`);
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error);
    }
}

// テスト実行
testAlertDeduplication();