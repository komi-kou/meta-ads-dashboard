// generateStaticAlerts.js - 静的アラートデータ生成機能
const fs = require('fs');
const path = require('path');

// メトリクスルールを読み込み
const { checklistRules } = require('./utils/checklistRules');
const { improvementStrategiesRules } = require('./utils/improvementStrategiesRules');

/**
 * 静的なアラートデータを生成する
 * ユーザーの目標値と仮想的な実績値を比較してアラートを生成
 */
function generateStaticAlerts(userSettings) {
    const alerts = [];
    const now = new Date();
    
    // デフォルトの目標値（ユーザー設定がない場合のフォールバック）
    const defaultTargets = {
        target_ctr: 1.5,     // CTR 1.5%
        target_cpa: 7000,    // CPA 7,000円
        target_cpm: 1500,    // CPM 1,500円
        target_cv: 3,        // CV 3件/日
        target_cvr: 2.0,     // CVR 2.0%
        target_budget_rate: 80  // 予算消化率 80%
    };
    
    // ユーザー設定とデフォルト値をマージ
    const targets = { ...defaultTargets, ...userSettings };
    
    // 施策3: 動的な実績値を生成（目標値の50%〜130%の範囲でランダム）
    const mockCurrentValues = {
        ctr: Number((targets.target_ctr * (0.5 + Math.random() * 0.8)).toFixed(2)),
        cpa: Math.round(targets.target_cpa * (0.7 + Math.random() * 0.6)),
        cpm: Math.round(targets.target_cpm * (0.8 + Math.random() * 0.4)),
        conversions: Math.max(0, Math.round(targets.target_cv * (0.3 + Math.random() * 0.9))),
        cvr: Number((targets.target_cvr * (0.5 + Math.random() * 0.8)).toFixed(2)),
        budget_rate: Math.round(targets.target_budget_rate * (0.6 + Math.random() * 0.6))
    };
    
    // CTRアラートチェック
    if (targets.target_ctr && mockCurrentValues.ctr < targets.target_ctr) {
        const alert = {
            id: `ctr_static_${Date.now()}`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: 'CTR',
            message: `CTRが目標値${targets.target_ctr}%を下回っています（現在: ${mockCurrentValues.ctr}%）`,
            targetValue: targets.target_ctr,
            currentValue: mockCurrentValues.ctr,
            severity: mockCurrentValues.ctr < targets.target_ctr * 0.7 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['CTR'] ? checklistRules['CTR'].items : [],
            improvements: improvementStrategiesRules['CTR'] || {}
        };
        alerts.push(alert);
    }
    
    // CPAアラートチェック
    if (targets.target_cpa && mockCurrentValues.cpa > targets.target_cpa) {
        const alert = {
            id: `cpa_static_${Date.now()}_2`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: 'CPA',
            message: `CPAが目標値${targets.target_cpa.toLocaleString()}円を上回っています（現在: ${mockCurrentValues.cpa.toLocaleString()}円）`,
            targetValue: targets.target_cpa,
            currentValue: mockCurrentValues.cpa,
            severity: mockCurrentValues.cpa > targets.target_cpa * 1.3 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['CPA'] ? checklistRules['CPA'].items : [],
            improvements: improvementStrategiesRules['CPA'] || {}
        };
        alerts.push(alert);
    }
    
    // CPMアラートチェック
    if (targets.target_cpm && mockCurrentValues.cpm > targets.target_cpm) {
        const alert = {
            id: `cpm_static_${Date.now()}_3`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: 'CPM',
            message: `CPMが目標値${targets.target_cpm.toLocaleString()}円を上回っています（現在: ${mockCurrentValues.cpm.toLocaleString()}円）`,
            targetValue: targets.target_cpm,
            currentValue: mockCurrentValues.cpm,
            severity: mockCurrentValues.cpm > targets.target_cpm * 1.2 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['CPM'] ? checklistRules['CPM'].items : [],
            improvements: improvementStrategiesRules['CPM'] || {}
        };
        alerts.push(alert);
    }
    
    // CVアラートチェック
    if (targets.target_cv && mockCurrentValues.conversions < targets.target_cv) {
        const alert = {
            id: `cv_static_${Date.now()}_4`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: 'CV',
            message: `CVが目標値${targets.target_cv}件を下回っています（現在: ${mockCurrentValues.conversions}件）`,
            targetValue: targets.target_cv,
            currentValue: mockCurrentValues.conversions,
            severity: mockCurrentValues.conversions === 0 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['CV'] ? checklistRules['CV'].items : [],
            improvements: improvementStrategiesRules['CV'] || {}
        };
        alerts.push(alert);
    }
    
    // CVRアラートチェック
    if (targets.target_cvr && mockCurrentValues.cvr < targets.target_cvr) {
        const alert = {
            id: `cvr_static_${Date.now()}_5`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: 'CVR',
            message: `CVRが目標値${targets.target_cvr}%を下回っています（現在: ${mockCurrentValues.cvr}%）`,
            targetValue: targets.target_cvr,
            currentValue: mockCurrentValues.cvr,
            severity: mockCurrentValues.cvr < targets.target_cvr * 0.6 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['CVR'] ? checklistRules['CVR'].items : [],
            improvements: improvementStrategiesRules['CVR'] || {}
        };
        alerts.push(alert);
    }
    
    // 予算消化率アラートチェック
    if (targets.target_budget_rate && mockCurrentValues.budget_rate < targets.target_budget_rate) {
        const alert = {
            id: `budget_static_${Date.now()}_6`,
            userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
            metric: '予算消化率',
            message: `予算消化率が目標値${targets.target_budget_rate}%を下回っています（現在: ${mockCurrentValues.budget_rate}%）`,
            targetValue: targets.target_budget_rate,
            currentValue: mockCurrentValues.budget_rate,
            severity: mockCurrentValues.budget_rate < targets.target_budget_rate * 0.7 ? 'critical' : 'warning',
            timestamp: now.toISOString(),
            status: 'active',
            checkItems: checklistRules['予算消化率'] ? checklistRules['予算消化率'].items : [],
            improvements: improvementStrategiesRules['予算消化率'] || {}
        };
        alerts.push(alert);
    }
    
    return alerts;
}

/**
 * 静的なアラート履歴を生成する
 */
function generateStaticAlertHistory(userSettings) {
    const history = [];
    const now = new Date();
    
    // 過去7日分の履歴を生成
    for (let i = 1; i <= 7; i++) {
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - i);
        
        // 各日付でランダムなアラートを生成
        const metricsPool = ['CPA', 'CTR', 'CPM', 'CV', 'CVR', '予算消化率'];
        const selectedMetrics = metricsPool.filter(() => Math.random() > 0.5);
        
        selectedMetrics.forEach((metric, index) => {
            const isResolved = i > 2; // 3日以上前のアラートは解決済み
            
            const targetVal = getTargetValue(metric, userSettings);
            const currentVal = getCurrentValue(metric, targetVal);
            
            const historyItem = {
                id: `history_${metric}_${pastDate.getTime()}_${index}`,
                userId: userSettings.userId || userSettings.id || userSettings.user_id || 'unknown',
                metric: metric,
                message: generateAlertMessage(metric, userSettings),
                targetValue: targetVal,
                currentValue: currentVal,
                severity: Math.random() > 0.5 ? 'critical' : 'warning',
                timestamp: pastDate.toISOString(),
                status: isResolved ? 'resolved' : 'active',
                checkItems: checklistRules[metric] ? checklistRules[metric].items : [],
                improvements: improvementStrategiesRules[metric] || {}
            };
            
            if (isResolved) {
                const resolvedDate = new Date(pastDate);
                resolvedDate.setDate(resolvedDate.getDate() + 1);
                historyItem.resolvedAt = resolvedDate.toISOString();
            }
            
            history.push(historyItem);
        });
    }
    
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// ヘルパー関数
function generateAlertMessage(metric, userSettings) {
    const messages = {
        'CPA': `CPAが目標値を上回っています`,
        'CTR': `CTRが目標値を下回っています`,
        'CPM': `CPMが目標値を上回っています`,
        'CV': `CV数が目標値を下回っています`,
        'CVR': `CVRが目標値を下回っています`,
        '予算消化率': `予算消化率が目標値を下回っています`
    };
    return messages[metric] || `${metric}に問題があります`;
}

function getTargetValue(metric, userSettings) {
    const targetMap = {
        'CPA': userSettings.target_cpa || 7000,
        'CTR': userSettings.target_ctr || 1.5,
        'CPM': userSettings.target_cpm || 1500,
        'CV': userSettings.target_cv || 3,
        'CVR': userSettings.target_cvr || 2.0,
        '予算消化率': userSettings.target_budget_rate || 80
    };
    return targetMap[metric] || 0;
}

function getCurrentValue(metric, targetValue) {
    // 施策3: 目標値に基づいた動的な値生成
    const varianceMap = {
        'CPA': targetValue * (0.7 + Math.random() * 0.6),
        'CTR': targetValue * (0.5 + Math.random() * 0.8),
        'CPM': targetValue * (0.8 + Math.random() * 0.4),
        'CV': Math.max(0, Math.round(targetValue * (0.3 + Math.random() * 0.9))),
        'CVR': targetValue * (0.5 + Math.random() * 0.8),
        '予算消化率': targetValue * (0.6 + Math.random() * 0.6)
    };
    
    // 数値を適切にフォーマット
    if (metric === 'CTR' || metric === 'CVR') {
        return Number(varianceMap[metric].toFixed(2));
    } else if (metric === 'CV') {
        return varianceMap[metric];
    } else {
        return Math.round(varianceMap[metric]);
    }
}

module.exports = {
    generateStaticAlerts,
    generateStaticAlertHistory
};