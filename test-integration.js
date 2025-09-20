// 統合テスト：実際のアラート生成と重複排除の確認
const fs = require('fs');
const path = require('path');
const { generateDynamicAlerts, saveAlertsToHistory } = require('./dynamicAlertGenerator');

async function testIntegration() {
    console.log('========================================');
    console.log('統合テスト：アラート生成と重複排除');
    console.log('========================================\n');
    
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    
    try {
        // 1. 現在のアラート履歴を確認
        console.log('【1. 現在のアラート履歴確認】');
        const historyPath = path.join(__dirname, 'alert_history.json');
        let originalHistory = [];
        if (fs.existsSync(historyPath)) {
            originalHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }
        
        const activeAlerts = originalHistory.filter(h => h.status === 'active');
        console.log(`総アラート数: ${originalHistory.length}件`);
        console.log(`アクティブアラート数: ${activeAlerts.length}件`);
        
        // メトリック別のアクティブアラート数
        const metricCounts = {};
        activeAlerts.forEach(alert => {
            metricCounts[alert.metric] = (metricCounts[alert.metric] || 0) + 1;
        });
        
        console.log('メトリック別アクティブアラート:');
        Object.entries(metricCounts).forEach(([metric, count]) => {
            console.log(`  ${metric}: ${count}件`);
        });
        
        // 2. 新しいアラートを生成
        console.log('\n【2. 新しいアラート生成】');
        const newAlerts = await generateDynamicAlerts(userId);
        console.log(`生成されたアラート数: ${newAlerts.length}件`);
        
        if (newAlerts.length > 0) {
            console.log('生成されたアラート:');
            newAlerts.forEach(alert => {
                const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
                console.log(`  ${icon} ${alert.metric}: 目標${alert.targetValue} → 実績${alert.currentValue}`);
            });
            
            // 3. アラートを保存（古いアラートの自動解決を含む）
            console.log('\n【3. アラート履歴保存（古いアラート解決）】');
            await saveAlertsToHistory(newAlerts);
        }
        
        // 4. 保存後の状態を確認
        console.log('\n【4. 保存後の状態確認】');
        const updatedHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const updatedActiveAlerts = updatedHistory.filter(h => h.status === 'active');
        const resolvedAlerts = updatedHistory.filter(h => h.status === 'resolved');
        
        console.log(`総アラート数: ${updatedHistory.length}件`);
        console.log(`アクティブアラート: ${updatedActiveAlerts.length}件`);
        console.log(`解決済みアラート: ${resolvedAlerts.length}件`);
        
        // 更新後のメトリック別カウント
        const updatedMetricCounts = {};
        updatedActiveAlerts.forEach(alert => {
            updatedMetricCounts[alert.metric] = (updatedMetricCounts[alert.metric] || 0) + 1;
        });
        
        console.log('メトリック別アクティブアラート（更新後）:');
        Object.entries(updatedMetricCounts).forEach(([metric, count]) => {
            const before = metricCounts[metric] || 0;
            const change = count - before;
            const changeStr = change > 0 ? `+${change}` : change.toString();
            console.log(`  ${metric}: ${count}件 (変化: ${changeStr})`);
        });
        
        // 5. 重複排除の効果を確認
        console.log('\n【5. 重複排除の効果】');
        console.log(`処理前のアクティブアラート: ${activeAlerts.length}件`);
        console.log(`処理後のアクティブアラート: ${updatedActiveAlerts.length}件`);
        console.log(`削減数: ${activeAlerts.length - updatedActiveAlerts.length}件`);
        
        // 6. Chatwork送信時のシミュレーション
        console.log('\n【6. Chatwork送信シミュレーション】');
        
        // メトリック別最新1件のみ取得（修正案2）
        const latestByMetric = {};
        updatedActiveAlerts
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach(alert => {
                if (!latestByMetric[alert.metric]) {
                    latestByMetric[alert.metric] = alert;
                }
            });
        
        const uniqueAlerts = Object.values(latestByMetric);
        console.log(`送信されるアラート数: ${uniqueAlerts.length}件（各メトリック最新1件）`);
        
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
        
        console.log('\n--- 送信メッセージプレビュー ---');
        const sortedAlerts = uniqueAlerts.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            const metricOrder = ['CV', 'CTR', 'CPM', 'CPA', '予算消化率'];
            return metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric);
        });
        
        sortedAlerts.forEach(alert => {
            const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
            console.log(`${icon} ${alert.metric}: 目標 ${formatValue(alert.targetValue, alert.metric)} → 実績 ${formatValue(alert.currentValue, alert.metric)}`);
        });
        
        console.log('\n✅ 統合テスト完了');
        
    } catch (error) {
        console.error('❌ テストエラー:', error);
    }
}

// テスト実行
testIntegration();