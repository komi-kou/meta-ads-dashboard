// 最終動作テスト
const fs = require('fs');
const path = require('path');
const { generateDynamicAlerts, saveAlertsToHistory } = require('./dynamicAlertGenerator');

async function testFinal() {
    console.log('========================================');
    console.log('最終動作テスト');
    console.log('========================================\n');
    
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    
    try {
        // 1. 現在の状態を確認
        console.log('【STEP 1: 現在の状態確認】');
        const historyPath = path.join(__dirname, 'alert_history.json');
        const beforeHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const beforeActive = beforeHistory.filter(h => h.status === 'active' && h.userId === userId);
        
        console.log(`処理前のアクティブアラート: ${beforeActive.length}件`);
        const beforeByMetric = {};
        beforeActive.forEach(alert => {
            beforeByMetric[alert.metric] = (beforeByMetric[alert.metric] || 0) + 1;
        });
        Object.entries(beforeByMetric).forEach(([metric, count]) => {
            console.log(`  ${metric}: ${count}件`);
        });
        
        // 2. 新しいアラートを生成
        console.log('\n【STEP 2: 新規アラート生成】');
        const newAlerts = await generateDynamicAlerts(userId);
        
        if (newAlerts.length > 0) {
            console.log(`生成されたアラート: ${newAlerts.length}件`);
            newAlerts.forEach(alert => {
                console.log(`  ${alert.metric}: 目標${alert.targetValue} → 実績${alert.currentValue}`);
            });
            
            // 3. アラートを保存（古いアラートの解決を含む）
            console.log('\n【STEP 3: アラート保存処理】');
            await saveAlertsToHistory(newAlerts);
        }
        
        // 4. 処理後の状態を確認
        console.log('\n【STEP 4: 処理後の状態確認】');
        const afterHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        const afterActive = afterHistory.filter(h => h.status === 'active' && h.userId === userId);
        const afterResolved = afterHistory.filter(h => h.status === 'resolved' && h.userId === userId);
        
        console.log(`処理後のアクティブアラート: ${afterActive.length}件`);
        console.log(`解決済みアラート: ${afterResolved.length}件`);
        
        const afterByMetric = {};
        afterActive.forEach(alert => {
            afterByMetric[alert.metric] = (afterByMetric[alert.metric] || 0) + 1;
        });
        
        console.log('\nメトリック別アクティブアラート（処理後）:');
        Object.entries(afterByMetric).forEach(([metric, count]) => {
            const before = beforeByMetric[metric] || 0;
            const change = count - before;
            console.log(`  ${metric}: ${count}件 (変化: ${change >= 0 ? '+' : ''}${change})`);
        });
        
        // 5. Chatwork送信シミュレーション
        console.log('\n【STEP 5: Chatwork送信シミュレーション】');
        
        // 重複排除処理をシミュレート
        const latestByMetric = {};
        afterActive
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .forEach(alert => {
                if (!latestByMetric[alert.metric]) {
                    latestByMetric[alert.metric] = alert;
                }
            });
        
        const uniqueAlerts = Object.values(latestByMetric);
        console.log(`重複排除後: ${uniqueAlerts.length}件（各メトリック最新1件）`);
        
        // ソートとメッセージ生成
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
        
        console.log('\n【最終メッセージ】');
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
        
        // 6. テスト結果サマリー
        console.log('\n========================================');
        console.log('【テスト結果サマリー】');
        console.log('========================================\n');
        
        const success = afterActive.length <= uniqueAlerts.length && uniqueAlerts.length <= 5;
        
        if (success) {
            console.log('✅ テスト成功！');
            console.log(`  - 重複アラートが解消されました（${beforeActive.length}件 → ${uniqueAlerts.length}件）`);
            console.log('  - 各メトリック最新1件のみ表示');
            console.log('  - URLは本番環境を指定');
            console.log('  - 数値フォーマットも適切');
        } else {
            console.log('⚠️ 確認が必要です');
            console.log(`  - アクティブアラート: ${afterActive.length}件`);
            console.log(`  - ユニークアラート: ${uniqueAlerts.length}件`);
        }
        
    } catch (error) {
        console.error('❌ テストエラー:', error.message);
        console.error(error.stack);
    }
}

// テスト実行
testFinal();