// alertSystem.js - アラート判定とデータ管理
const fs = require('fs');
const path = require('path');
const { metaApi } = require('./metaApi');
const { sendChatworkNotification } = require('./chatworkApi');

// アラートルール定義
const ALERT_RULES = {
    'toC_メルマガ登録': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_LINE登録': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_電話ボタン': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_購入': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_newsletter': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        daily_budget: { threshold: 1000, days: 1, operator: 'above' },
        ctr: { threshold: 1.5, days: 3, operator: 'below' },
        cpm: { threshold: 6000, days: 3, operator: 'above' },
        conversions: { threshold: 0, days: 3, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_LINE登録': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_電話ボタン': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_購入': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    }
};

// 設定から現在のゴールタイプを取得
function getCurrentGoalType() {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return settings.goal?.type || 'toC_メルマガ登録';
        }
    } catch (error) {
        console.error('設定読み込みエラー:', error);
    }
    return 'toC_メルマガ登録';
}

// 過去のデータを取得
async function getHistoricalData(days) {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            console.log('設定ファイルが見つかりません');
            return [];
        }

        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const config = settings.meta;

        if (!config.accessToken || !config.accountId) {
            console.log('Meta API設定が不完全です');
            return [];
        }

        // 過去のデータを取得
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const data = await metaApi.getAdInsights(
            config.accountId,
            config.accessToken,
            startDate,
            endDate
        );

        return data.dailyData || [];
    } catch (error) {
        console.error('過去データ取得エラー:', error);
        return [];
    }
}

// 全アラートチェック実行
async function checkAllAlerts() {
    console.log('=== 全アラートチェック開始 ===');
    
    try {
        const currentGoal = getCurrentGoalType();
        const rules = ALERT_RULES[currentGoal];
        
        if (!rules) {
            console.log('アラートルールが見つかりません:', currentGoal);
            return [];
        }
        
        const alerts = [];
        
        // 過去のデータを取得（必要な日数分）
        const maxDays = Math.max(...Object.values(rules).map(rule => rule.days));
        const historicalData = await getHistoricalData(maxDays);
        
        // 各ルールをチェック
        for (const [metric, rule] of Object.entries(rules)) {
            const alertResult = await checkMetricAlert(metric, rule, historicalData, currentGoal);
            if (alertResult) {
                alerts.push(alertResult);
            }
        }
        
        // アラートが発生した場合、チャットワークに通知
        if (alerts.length > 0) {
            await sendAlertsToChatwork(alerts);
        }
        
        // アラート履歴に保存
        await saveAlertHistory(alerts);
        
        console.log(`アラートチェック完了: ${alerts.length}件のアラート`);
        return alerts;
        
    } catch (error) {
        console.error('アラートチェックエラー:', error);
        return [];
    }
}

// 個別メトリックのアラートチェック
async function checkMetricAlert(metric, rule, historicalData, goalType) {
    console.log(`${metric}のアラートチェック中...`);
    
    try {
        let alertTriggered = false;
        let alertMessage = '';
        let severity = 'warning';
        
        switch (rule.operator) {
            case 'below':
                alertTriggered = checkBelowThreshold(metric, rule, historicalData);
                if (alertTriggered) {
                    alertMessage = `${metric}が${rule.threshold}${metric.includes('rate') ? '%' : metric.includes('ctr') ? '%' : ''}以下の状態が${rule.days}日間続いています`;
                    severity = 'critical';
                }
                break;
                
            case 'equal':
                alertTriggered = checkEqualThreshold(metric, rule, historicalData);
                if (alertTriggered) {
                    alertMessage = `${metric}が${rule.days}日連続で0です`;
                    severity = 'critical';
                }
                break;
                
            case 'above':
                alertTriggered = checkAboveThreshold(metric, rule, historicalData);
                if (alertTriggered) {
                    const metricName = getMetricDisplayName(metric);
                    alertMessage = `${metricName}が${rule.threshold}${metric.includes('cpm') ? '円' : '円'}以上の状態が${rule.days}日間続いています`;
                    severity = 'warning';
                }
                break;
                
            case 'above_baseline':
                alertTriggered = await checkCPMBaseline(rule, historicalData);
                if (alertTriggered) {
                    alertMessage = `CPMがベースラインから+${rule.threshold}円上がった状態が${rule.days}日間続いています`;
                    severity = 'warning';
                }
                break;
                
            case 'above_target':
                alertTriggered = await checkCPATarget(rule, historicalData);
                if (alertTriggered) {
                    alertMessage = `CPAが目標の${rule.threshold}%を超えた状態が${rule.days}日間続いています`;
                    severity = 'critical';
                }
                break;
        }
        
        if (alertTriggered) {
            return {
                id: `${metric}_${Date.now()}`,
                metric: metric,
                type: goalType,
                message: alertMessage,
                severity: severity,
                threshold: rule.threshold,
                days: rule.days,
                triggeredAt: new Date().toISOString(),
                data: historicalData.slice(0, rule.days)
            };
        }
        
        return null;
        
    } catch (error) {
        console.error(`${metric}アラートチェックエラー:`, error);
        return null;
    }
}

// 閾値以下チェック
function checkBelowThreshold(metric, rule, historicalData) {
    const relevantData = historicalData.slice(0, rule.days);
    
    return relevantData.every(dayData => {
        const value = getMetricValue(dayData, metric);
        return value < rule.threshold;
    });
}

// 等しいかチェック（CV=0用）
function checkEqualThreshold(metric, rule, historicalData) {
    const relevantData = historicalData.slice(0, rule.days);
    
    return relevantData.every(dayData => {
        const value = getMetricValue(dayData, metric);
        return value === rule.threshold;
    });
}

// 閾値以上チェック（日予算・CPM用）
function checkAboveThreshold(metric, rule, historicalData) {
    const relevantData = historicalData.slice(0, rule.days);
    
    return relevantData.every(dayData => {
        const value = getMetricValue(dayData, metric);
        return value > rule.threshold;
    });
}

// CPMベースラインチェック
async function checkCPMBaseline(rule, historicalData) {
    try {
        // 設定からの目標CPMを取得
        const targetCPM = await getTargetCPM();
        const recentData = historicalData.slice(0, rule.days);
        
        return recentData.every(dayData => {
            const currentCPM = getMetricValue(dayData, 'cpm');
            return currentCPM > (targetCPM + rule.threshold);
        });
    } catch (error) {
        console.error('CPMベースラインチェックエラー:', error);
        return false;
    }
}

// CPA目標チェック
async function checkCPATarget(rule, historicalData) {
    try {
        const targetCPA = await getTargetCPA();
        const thresholdCPA = targetCPA * (rule.threshold / 100);
        
        const recentData = historicalData.slice(0, rule.days);
        
        return recentData.every(dayData => {
            const currentCPA = getMetricValue(dayData, 'cpa');
            return currentCPA > thresholdCPA;
        });
    } catch (error) {
        console.error('CPA目標チェックエラー:', error);
        return false;
    }
}

// メトリクス値取得
function getMetricValue(dayData, metric) {
    switch (metric) {
        case 'budget_rate':
            return parseFloat(dayData.budgetRate || 0);
        case 'daily_budget':
            return parseInt(dayData.dailyBudget || 0);
        case 'ctr':
            return parseFloat(dayData.ctr || 0);
        case 'conversions':
            return parseInt(dayData.conversions || 0);
        case 'cpm':
            return parseInt(dayData.cpm || 0);
        case 'cpa':
            return parseInt(dayData.cpa || 0);
        default:
            return 0;
    }
}

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    switch (metric) {
        case 'budget_rate':
            return '予算消化率';
        case 'daily_budget':
            return '日予算';
        case 'ctr':
            return 'CTR';
        case 'conversions':
            return 'CV';
        case 'cpm':
            return 'CPM';
        case 'cpa':
            return 'CPA';
        default:
            return metric;
    }
}

// 平均CPM計算
function calculateAverageCPM(data) {
    if (!data || data.length === 0) return 0;
    
    const totalCPM = data.reduce((sum, dayData) => {
        return sum + getMetricValue(dayData, 'cpm');
    }, 0);
    
    return totalCPM / data.length;
}

// 目標CPA取得（設定から）
async function getTargetCPA() {
    try {
        // setup.jsonから現在のゴール設定を取得
        const setupPath = path.join(__dirname, 'config/setup.json');
        if (fs.existsSync(setupPath)) {
            const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
            const goalType = setup.goal?.type || 'toC_newsletter';
            
            // alertRules.jsからそのゴールタイプのCPA閾値を取得
            const alertRules = require('./alertRules');
            const goalRule = alertRules.goals[goalType];
            
            if (goalRule && goalRule.rules && goalRule.rules.cpa) {
                return goalRule.rules.cpa.threshold;
            }
        }
        
        // フォールバック: settings.jsonから取得
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return settings.targetCPA || 1000;
        }
    } catch (error) {
        console.error('目標CPA取得エラー:', error);
    }
    return 1000; // デフォルト値
}

// 目標CPM取得（設定から）
async function getTargetCPM() {
    try {
        // setup.jsonから現在のゴール設定を取得
        const setupPath = path.join(__dirname, 'config/setup.json');
        if (fs.existsSync(setupPath)) {
            const setup = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
            const goalType = setup.goal?.type || 'toC_newsletter';
            
            // alertRules.jsからそのゴールタイプのCPM閾値を取得
            const alertRules = require('./alertRules');
            const goalRule = alertRules.goals[goalType];
            
            if (goalRule && goalRule.rules && goalRule.rules.cpm) {
                return goalRule.rules.cpm.threshold;
            }
        }
        
        // フォールバック: settings.jsonから取得
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            return settings.targetCPM || 3000;
        }
    } catch (error) {
        console.error('目標CPM取得エラー:', error);
    }
    return 3000; // デフォルト値
}

// 技術用語を日本語に変換する関数
function translateAlertTerms(alertText) {
    return alertText
        .replace(/budget_rate/g, '予算消化率')
        .replace(/ctr/g, 'CTR')
        .replace(/conversions/g, 'CV')
        .replace(/cpa_rate/g, 'CPA')
        .replace(/cpm_increase/g, 'CPM上昇')
        .replace(/日予算/g, '日予算')
        .replace(/CPM/g, 'CPM');
}

// アラートのチャットワーク通知
async function sendAlertsToChatwork(alerts) {
    try {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (!fs.existsSync(settingsPath)) {
            console.log('設定ファイルなし - アラート通知スキップ');
            return;
        }

        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        const config = settings.chatwork;
        
        if (!config.apiToken || !config.roomId) {
            console.log('チャットワーク設定なし - アラート通知スキップ');
            return;
        }
        
        if (alerts.length === 0) {
            console.log('アラートなし - 通知スキップ');
            return;
        }
        
        const dateStr = new Date().toLocaleDateString('ja-JP');
        
        let message = `Meta広告 アラート通知 (${dateStr})
以下のアラートが発生しています：

`;

        // 全てのアラートを統合して表示
        alerts.forEach((alert, index) => {
            const translatedMessage = translateAlertTerms(alert.message);
            const category = getMetricDisplayName(alert.metric);
            message += `${index + 1}. **${category}**：${translatedMessage}\n`;
        });

        message += `
確認事項：http://localhost:3000/improvement-tasks
改善施策：http://localhost:3000/improvement-strategies

📊 ダッシュボードで詳細を確認してください。
http://localhost:3000/dashboard`;
        
        await sendChatworkNotification('alert_notification', { customMessage: message });
        
        console.log('✅ アラートチャットワーク通知送信完了');
        
    } catch (error) {
        console.error('❌ アラートチャットワーク通知エラー:', error);
    }
}

// アラート履歴保存
async function saveAlertHistory(alerts) {
    try {
        const historyPath = path.join(__dirname, 'alert_history.json');
        let history = [];
        
        if (fs.existsSync(historyPath)) {
            history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }
        
        // 個別のアラートを履歴に追加
        alerts.forEach(alert => {
            const historyEntry = {
                id: alert.id,
                metric: getMetricDisplayName(alert.metric),
                message: alert.message,
                level: alert.severity === 'critical' ? 'high' : 'medium',
                timestamp: alert.triggeredAt,
                status: 'active'
            };
            
            history.unshift(historyEntry);
        });
        
        // 直近30日分のみ保持
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        history = history.filter(entry => {
            return new Date(entry.timestamp) > thirtyDaysAgo;
        });
        
        fs.writeFileSync(historyPath, JSON.stringify(history, null, 2));
        console.log('✅ アラート履歴保存完了');
        
    } catch (error) {
        console.error('❌ アラート履歴保存エラー:', error);
    }
}

// アラート履歴取得
async function getAlertHistory() {
    try {
        const historyPath = path.join(__dirname, 'alert_history.json');
        
        if (fs.existsSync(historyPath)) {
            return JSON.parse(fs.readFileSync(historyPath, 'utf8'));
        }
        
        return [];
    } catch (error) {
        console.error('アラート履歴取得エラー:', error);
        return [];
    }
}

// アラート設定取得
function getAlertSettings() {
    try {
        const currentGoal = getCurrentGoalType();
        const rules = ALERT_RULES[currentGoal];
        
        return {
            currentGoal: currentGoal,
            rules: rules,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('アラート設定取得エラー:', error);
        return {
            currentGoal: 'toC_メルマガ登録',
            rules: {},
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = {
    checkAllAlerts,
    getAlertHistory,
    getAlertSettings,
    getCurrentGoalType
}; 