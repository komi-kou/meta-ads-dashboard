// test-alert-with-dummy.js - ダミーデータでアラートシステムをテスト
const fs = require('fs');
const path = require('path');

async function testAlertWithDummyData() {
    console.log('=== ダミーデータでアラートテスト ===\n');
    
    const userId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    
    try {
        // 1. ダミーデータを作成
        const dummyData = {
            date: new Date().toISOString().split('T')[0],
            spend: 15000,
            impressions: 50000,
            clicks: 1000,
            ctr: 2.0,          // 目標3.0%より低い → アラート
            cpm: 600,          // 目標500円より高い → アラート
            cpc: 150,          // 目標100円より高い → アラート
            conversions: 30,   // 目標50件より低い → アラート
            cvr: 1.5,          // 目標2.0%より低い → アラート
            cpa: 1500,         // 目標1000円より高い → アラート
            budgetRate: 75,    // 目標90%より低い → アラート
            roas: 350          // 目標400%より低い → アラート
        };
        
        console.log('テストデータ:', dummyData);
        
        // 2. 各メトリクスの判定
        const { checklistRules } = require('./utils/checklistRules');
        const { improvementStrategiesRules } = require('./utils/improvementStrategiesRules');
        const UserManager = require('./userManager');
        const userManager = new UserManager();
        
        const userSettings = userManager.getUserSettings(userId);
        const alerts = [];
        
        // メトリクスと目標値のマッピング
        const checks = [
            { metric: 'ctr', current: dummyData.ctr, target: userSettings.target_ctr, direction: 'higher' },
            { metric: 'cpm', current: dummyData.cpm, target: userSettings.target_cpm, direction: 'lower' },
            { metric: 'cpc', current: dummyData.cpc, target: userSettings.target_cpc, direction: 'lower' },
            { metric: 'cpa', current: dummyData.cpa, target: userSettings.target_cpa, direction: 'lower' },
            { metric: 'cvr', current: dummyData.cvr, target: userSettings.target_cvr, direction: 'higher' },
            { metric: 'conversions', current: dummyData.conversions, target: userSettings.target_cv, direction: 'higher' },
            { metric: 'budget_rate', current: dummyData.budgetRate, target: userSettings.target_budget_rate, direction: 'higher' },
            { metric: 'roas', current: dummyData.roas, target: userSettings.target_roas, direction: 'higher' }
        ];
        
        console.log('\n判定結果:');
        
        for (const check of checks) {
            if (!check.target) continue;
            
            let shouldAlert = false;
            if (check.direction === 'higher') {
                shouldAlert = check.current < check.target;
            } else {
                shouldAlert = check.current > check.target;
            }
            
            if (shouldAlert) {
                const metricDisplayName = getMetricDisplayName(check.metric);
                const message = check.direction === 'higher' 
                    ? `${metricDisplayName}が目標値${formatValue(check.target, check.metric)}を下回っています（現在: ${formatValue(check.current, check.metric)}）`
                    : `${metricDisplayName}が目標値${formatValue(check.target, check.metric)}を上回っています（現在: ${formatValue(check.current, check.metric)}）`;
                
                console.log(`✅ ${check.metric}: アラート発動`);
                console.log(`   ${message}`);
                
                // 確認事項と改善施策を取得
                const checkItems = checklistRules[metricDisplayName]?.items || [];
                const improvements = improvementStrategiesRules[metricDisplayName] || {};
                
                alerts.push({
                    id: `${check.metric}_${Date.now()}`,
                    userId: userId,
                    metric: metricDisplayName,
                    message: message,
                    targetValue: check.target,
                    currentValue: check.current,
                    severity: check.current > check.target * 1.5 || check.current < check.target * 0.5 ? 'critical' : 'warning',
                    timestamp: new Date().toISOString(),
                    status: 'active',
                    checkItems: checkItems,
                    improvements: improvements
                });
            } else {
                console.log(`⭕ ${check.metric}: 正常範囲内`);
            }
        }
        
        // 3. アラート履歴に保存
        if (alerts.length > 0) {
            const historyPath = path.join(__dirname, 'alert_history.json');
            let history = [];
            
            if (fs.existsSync(historyPath)) {
                history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            }
            
            // 新しいアラートを追加
            history.unshift(...alerts);
            
            // 30日分のみ保持
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            history = history.filter(entry => new Date(entry.timestamp) > thirtyDaysAgo);
            
            fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
            console.log(`\n✅ ${alerts.length}件のアラートを履歴に保存しました`);
        }
        
        // 4. チャットワーク通知テスト
        if (alerts.length > 0 && userSettings.enable_alerts && userSettings.chatwork_api_token) {
            console.log('\n📬 チャットワーク通知を送信中...');
            await sendTestChatworkNotification(alerts, userSettings);
        }
        
        console.log('\n=== テスト完了 ===');
        
    } catch (error) {
        console.error('テストエラー:', error);
    }
}

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    const names = {
        'budget_rate': '予算消化率',
        'ctr': 'CTR',
        'conversions': 'CV',
        'cpm': 'CPM',
        'cpa': 'CPA',
        'cvr': 'CVR',
        'roas': 'ROAS',
        'cpc': 'CPC'
    };
    return names[metric] || metric;
}

// 値のフォーマット
function formatValue(value, metric) {
    switch (metric) {
        case 'ctr':
        case 'cvr':
        case 'budget_rate':
            return `${value}%`;
        case 'roas':
            return `${value}%`;
        case 'conversions':
            return `${value}件`;
        case 'cpa':
        case 'cpm':
        case 'cpc':
            return `${value.toLocaleString()}円`;
        default:
            return value.toString();
    }
}

// チャットワーク通知送信
async function sendTestChatworkNotification(alerts, userSettings) {
    try {
        const fetch = require('node-fetch');
        const dateStr = new Date().toLocaleDateString('ja-JP');
        
        let message = `[info][title]Meta広告 アラート通知テスト (${dateStr})[/title]`;
        message += `以下の指標が目標値から外れています：\n\n`;
        
        alerts.forEach((alert) => {
            const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
            message += `${icon} ${alert.metric}: `;
            message += `目標 ${formatValue(alert.targetValue, alert.metric.toLowerCase())} → `;
            message += `実績 ${formatValue(alert.currentValue, alert.metric.toLowerCase())}\n`;
        });
        
        message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
        message += `http://localhost:3000/dashboard\n\n`;
        message += `✅ 確認事項：http://localhost:3000/improvement-tasks\n`;
        message += `💡 改善施策：http://localhost:3000/improvement-strategies[/info]`;
        
        const response = await fetch(`https://api.chatwork.com/v2/rooms/${userSettings.chatwork_room_id}/messages`, {
            method: 'POST',
            headers: {
                'X-ChatWorkToken': userSettings.chatwork_api_token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `body=${encodeURIComponent(message)}`
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ チャットワーク通知送信成功');
            console.log('メッセージID:', result.message_id);
        } else {
            console.error('❌ チャットワーク通知失敗:', response.status, await response.text());
        }
        
    } catch (error) {
        console.error('❌ チャットワーク通知エラー:', error);
    }
}

// テスト実行
testAlertWithDummyData();