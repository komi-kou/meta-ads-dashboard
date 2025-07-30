// alertSystem.js - アラート判定とデータ管理
const fs = require('fs');
const path = require('path');
const { metaApi } = require('./metaApi');
const { sendChatworkNotification } = require('./chatworkApi');
const UserManager = require('./userManager');

// UserManagerのインスタンスを作成
const userManager = new UserManager();

// アラートルール定義
const ALERT_RULES = {
    'toC_newsletter': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_line': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_phone': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toC_purchase': {
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
    'toB_line': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_phone': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    },
    'toB_purchase': {
        budget_rate: { threshold: 80, days: 3, operator: 'below' },
        ctr: { threshold: 2.5, days: 3, operator: 'below' },
        conversions: { threshold: 0, days: 2, operator: 'equal' },
        cpm_increase: { threshold: 500, days: 3, operator: 'above_baseline' },
        cpa_rate: { threshold: 120, days: 2, operator: 'above_target' }
    }
};

// 設定から現在のゴールタイプを取得
function getCurrentGoalType(userId = null) {
    try {
        // 優先順位1: UserManagerからユーザー固有設定を読み込み
        if (userId) {
            try {
                const userSettings = userManager.getUserSettings(userId);
                if (userSettings && (userSettings.service_goal || userSettings.goal_type)) {
                    const goalType = userSettings.service_goal || userSettings.goal_type;
                    console.log('✅ アラートシステム ゴールタイプ読み込み成功 (ユーザー固有):', goalType, 'for user:', userId);
                    return goalType;
                }
            } catch (userError) {
                console.log('⚠️ ユーザー固有設定読み込み失敗:', userError.message);
            }
        }
        
        // 優先順位2: ユーザー設定ファイルから読み込み（後方互換性）
        const userSettingsPath = path.join(__dirname, 'data', 'user_settings.json');
        if (fs.existsSync(userSettingsPath)) {
            const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
            if (Array.isArray(userSettings) && userSettings.length > 0) {
                // 最新のユーザー設定を使用
                const latestUserSetting = userSettings[userSettings.length - 1];
                if (latestUserSetting.service_goal || latestUserSetting.goal_type) {
                    const goalType = latestUserSetting.service_goal || latestUserSetting.goal_type;
                    console.log('✅ アラートシステム ゴールタイプ読み込み成功 (共通設定):', goalType);
                    return goalType;
                }
            }
        }

        // 優先順位2: setup.jsonから読み込み
        const setupPath = path.join(__dirname, 'config', 'setup.json');
        if (fs.existsSync(setupPath)) {
            const setupData = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
            if (setupData.goal && setupData.goal.type) {
                console.log('✅ アラートシステム ゴールタイプ読み込み成功 (setup.json):', setupData.goal.type);
                return setupData.goal.type;
            }
        }

        // 優先順位3: settings.jsonから読み込み
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.goal && settings.goal.type) {
                console.log('✅ アラートシステム ゴールタイプ読み込み成功 (settings.json):', settings.goal.type);
                return settings.goal.type;
            }
        }

        console.log('⚠️ アラートシステム ゴールタイプが見つかりません。デフォルト値を使用: toC_newsletter');
        return 'toC_newsletter'; // デフォルト値
    } catch (error) {
        console.error('❌ アラートシステム ゴールタイプ読み込みエラー:', error.message);
        return 'toC_newsletter'; // エラー時のデフォルト値
    }
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
            const alertResult = await checkMetricAlert(metric, rule, historicalData, currentGoal, null);
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

// ユーザー固有のアラートチェック実行
async function checkUserAlerts(userId) {
    console.log(`=== ユーザー${userId}のアラートチェック開始 ===`);
    
    try {
        const userSettings = userManager.getUserSettings(userId);
        if (!userSettings) {
            console.log('ユーザー設定が見つかりません:', userId);
            return [];
        }
        
        // 現在のゴールタイプを使用（ユーザー固有）
        const currentGoal = getCurrentGoalType(userId);
        const rules = ALERT_RULES[currentGoal];
        
        if (!rules) {
            console.log('アラートルールが見つかりません');
            return [];
        }
        
        const alerts = [];
        
        // 過去のデータを取得（必要な日数分）
        const maxDays = Math.max(...Object.values(rules).map(rule => rule.days));
        const historicalData = await getHistoricalData(maxDays);
        
        // 各ルールをチェック（ユーザーIDを渡す）
        for (const [metric, rule] of Object.entries(rules)) {
            const alertResult = await checkMetricAlert(metric, rule, historicalData, currentGoal, userId);
            if (alertResult) {
                alerts.push({
                    ...alertResult,
                    userId: userId
                });
            }
        }
        
        console.log(`ユーザー${userId}のアラートチェック完了: ${alerts.length}件のアラート`);
        return alerts;
        
    } catch (error) {
        console.error(`ユーザー${userId}のアラートチェックエラー:`, error);
        return [];
    }
}

// 個別メトリックのアラートチェック
async function checkMetricAlert(metric, rule, historicalData, goalType, userId = null) {
    console.log(`${metric}のアラートチェック中...`);
    
    try {
        // 履歴データが不十分な場合はスキップ
        if (!historicalData || historicalData.length < rule.days) {
            console.log(`${metric}: 履歴データが不十分です (必要: ${rule.days}日, 実際: ${historicalData ? historicalData.length : 0}日)`);
            return null;
        }
        
        let alertTriggered = false;
        let alertMessage = '';
        let severity = 'warning';
        
        switch (rule.operator) {
            case 'below':
                alertTriggered = await checkBelowThresholdDynamic(metric, rule, historicalData, userId);
                if (alertTriggered) {
                    const currentValue = getMetricValue(historicalData[0], metric);
                    
                    if (metric === 'ctr' && userId) {
                        const userSettings = userManager.getUserSettings(userId);
                        const targetCTR = userSettings?.target_ctr ? parseFloat(userSettings.target_ctr) : rule.threshold;
                        alertMessage = `CTRが${targetCTR}%以下の${currentValue.toFixed(2)}%が${rule.days}日間続いています`;
                    } else if (metric === 'budget_rate' && userId) {
                        const userSettings = userManager.getUserSettings(userId);
                        const userDailyBudget = userSettings?.target_dailyBudget ? parseInt(userSettings.target_dailyBudget) : null;
                        
                        // ハイブリッド方式: 実際のAPI取得日予算があればそれを優先、なければユーザー設定を使用
                        let finalDailyBudget = userDailyBudget;
                        let budgetSource = 'ユーザー設定';
                        
                        // 注意: ここではAPI取得日予算は利用できないため、ユーザー設定を優先使用
                        if (finalDailyBudget && finalDailyBudget > 0) {
                            alertMessage = `予算消化率が80%以下の${currentValue}%が${rule.days}日間続いています（${budgetSource}日予算: ${finalDailyBudget.toLocaleString()}円）`;
                        } else {
                            alertMessage = `予算消化率が80%以下の${currentValue}%が${rule.days}日間続いています`;
                        }
                    } else {
                        const dynamicThreshold = rule.threshold;
                        alertMessage = `${getMetricDisplayName(metric)}が${dynamicThreshold}${metric.includes('rate') ? '%' : metric.includes('ctr') ? '%' : ''}以下の${currentValue}${metric.includes('rate') ? '%' : metric.includes('ctr') ? '%' : ''}が${rule.days}日間続いています`;
                    }
                    severity = 'critical';
                }
                break;
                
            case 'equal':
                // CV=0の場合、API値を使用（閾値は0で固定）
                alertTriggered = checkEqualThreshold(metric, rule, historicalData);
                if (alertTriggered) {
                    const currentValue = getMetricValue(historicalData[0], metric);
                    if (metric === 'conversions') {
                        alertMessage = `CV数が${rule.threshold}件以下の${currentValue}件が${rule.days}日間続いています`;
                    } else {
                        alertMessage = `${getMetricDisplayName(metric)}が${rule.days}日連続で${currentValue}です`;
                    }
                    severity = 'critical';
                }
                break;
                
            case 'above':
                alertTriggered = checkAboveThreshold(metric, rule, historicalData);
                if (alertTriggered) {
                    const metricName = getMetricDisplayName(metric);
                    const currentValue = getMetricValue(historicalData[0], metric);
                    alertMessage = `${metricName}が${rule.threshold}${metric.includes('cpm') ? '円' : '円'}以上の${currentValue.toLocaleString()}${metric.includes('cpm') ? '円' : '円'}が${rule.days}日間続いています`;
                    severity = 'warning';
                }
                break;
                
            case 'above_baseline':
                alertTriggered = await checkCPMBaseline(rule, historicalData, userId);
                if (alertTriggered) {
                    const currentCPM = getMetricValue(historicalData[0], 'cpm');
                    const targetCPM = await getTargetCPM(userId);
                    if (targetCPM === null) return null; // 設定がない場合はスキップ
                    const upperLimit = targetCPM + rule.threshold;
                    const lowerLimit = targetCPM - rule.threshold;
                    alertMessage = `CPMが目標範囲（${lowerLimit.toLocaleString()}～${upperLimit.toLocaleString()}円）を超えた${currentCPM.toLocaleString()}円が${rule.days}日間続いています`;
                    severity = 'warning';
                }
                break;
                
            case 'above_target':
                alertTriggered = await checkCPATarget(rule, historicalData, userId);
                if (alertTriggered) {
                    const currentCPA = getMetricValue(historicalData[0], 'cpa');
                    const targetCPA = await getTargetCPA(userId);
                    if (targetCPA === null) return null; // 設定がない場合はスキップ
                    const thresholdCPA = targetCPA * (rule.threshold / 100);
                    alertMessage = `CPAが目標の${rule.threshold}%（${thresholdCPA.toLocaleString()}円）を超えた${currentCPA.toLocaleString()}円が${rule.days}日間続いています`;
                    severity = 'critical';
                }
                break;
        }
        
        if (alertTriggered) {
            // 確認事項と改善施策を取得
            let checkItems = [];
            let improvementStrategies = {};
            
            try {
                const { checklistRules } = require('./utils/checklistRules');
                const { improvementStrategiesRules } = require('./utils/improvementStrategiesRules');
                
                const metricDisplayName = getMetricDisplayName(metric);
                console.log(`=== ${metric} のcheckItems生成デバッグ ===`);
                console.log('原始メトリック名:', metric);
                console.log('表示メトリック名:', metricDisplayName);
                console.log('checklistRulesで利用可能なキー:', Object.keys(checklistRules));
                console.log(`checklistRules["${metricDisplayName}"]の存在:`, !!checklistRules[metricDisplayName]);
                console.log('checklistRules[metricDisplayName]の内容:', checklistRules[metricDisplayName]);
                
                const ruleData = checklistRules[metricDisplayName];
                if (ruleData && ruleData.items) {
                    checkItems = ruleData.items;
                    console.log('✅ checkItemsを正常に取得:', checkItems.length, '件');
                } else {
                    console.log('❌ checkItems取得失敗 - フォールバック使用');
                    checkItems = [];
                }
                
                try {
                    improvementStrategies = improvementStrategiesRules[metricDisplayName] || {};
                } catch (improvementError) {
                    console.error('改善施策読み込みエラー:', improvementError);
                    improvementStrategies = {};
                }
                
                console.log('最終checkItems数:', checkItems.length);
                console.log('最終checkItems内容:', checkItems);
                console.log('=== checkItems生成デバッグ終了 ===');
                
            } catch (error) {
                console.error('確認事項・改善施策の読み込みエラー:', error);
                // デフォルトのダミーデータを使用
                checkItems = [
                    {
                        priority: 1,
                        title: 'メトリクス確認',
                        description: '指標の詳細分析が必要です'
                    }
                ];
                improvementStrategies = {
                    'メトリクス確認': ['データを詳しく分析してください']
                };
                console.log('フォールバックcheckItemsを使用:', checkItems.length, '件');
            }
            
            return {
                id: `${metric}_${Date.now()}`,
                metric: metric,
                type: goalType,
                message: alertMessage,
                severity: severity,
                threshold: rule.threshold,
                days: rule.days,
                triggeredAt: new Date().toISOString(),
                data: historicalData.slice(0, rule.days),
                checkItems: checkItems,
                improvements: improvementStrategies
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

// 動的閾値での閾値以下チェック
async function checkBelowThresholdDynamic(metric, rule, historicalData, userId) {
    try {
        const relevantData = historicalData.slice(0, rule.days);
        let threshold = rule.threshold;
        
        // ユーザー設定から実際の目標値を取得
        if (userId) {
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings) {
                switch (metric) {
                    case 'ctr':
                        if (userSettings.target_ctr) {
                            threshold = parseFloat(userSettings.target_ctr);
                        }
                        break;
                    case 'budget_rate':
                        // 予算消化率は80%固定（標準的な基準）
                        threshold = 80;
                        break;
                    default:
                        // その他のメトリクスは従来のルール閾値を使用
                        threshold = rule.threshold;
                        break;
                }
            }
        }
        
        return relevantData.every(dayData => {
            const value = getMetricValue(dayData, metric);
            return value < threshold;
        });
    } catch (error) {
        console.error(`動的閾値チェックエラー(${metric}):`, error);
        return checkBelowThreshold(metric, rule, historicalData);
    }
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
async function checkCPMBaseline(rule, historicalData, userId) {
    try {
        // ユーザー設定からの目標CPMを取得
        const targetCPM = await getTargetCPM(userId);
        if (targetCPM === null) return false; // 設定がない場合はスキップ
        
        const recentData = historicalData.slice(0, rule.days);
        
        return recentData.every(dayData => {
            const currentCPM = getMetricValue(dayData, 'cpm');
            // ±500円の範囲外かチェック
            return currentCPM > (targetCPM + rule.threshold) || currentCPM < (targetCPM - rule.threshold);
        });
    } catch (error) {
        console.error('CPMベースラインチェックエラー:', error);
        return false;
    }
}

// CPA目標チェック
async function checkCPATarget(rule, historicalData, userId) {
    try {
        const targetCPA = await getTargetCPA(userId);
        if (targetCPA === null) return false; // 設定がない場合はスキップ
        
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
    // dayDataがundefinedまたはnullの場合の安全な処理
    if (!dayData) {
        return 0;
    }
    
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
        case 'cpm_increase':
            return 'CPM';
        case 'cpa':
        case 'cpa_rate':
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

// 目標CPA取得（ユーザー設定から）
async function getTargetCPA(userId) {
    try {
        if (userId) {
            // ユーザー固有の設定から取得（実際の入力値のみ）
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings && userSettings.target_cpa) {
                return parseFloat(userSettings.target_cpa);
            }
        }
        
        console.log('警告: ユーザーのCPA設定が見つかりません:', userId);
        return null; // 設定がない場合はアラートをスキップ
    } catch (error) {
        console.error('目標CPA取得エラー:', error);
        return null;
    }
}

// 目標CPM取得（ユーザー設定から）
async function getTargetCPM(userId) {
    try {
        if (userId) {
            // ユーザー固有の設定から取得（実際の入力値のみ）
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings && userSettings.target_cpm) {
                return parseFloat(userSettings.target_cpm);
            }
        }
        
        console.log('警告: ユーザーのCPM設定が見つかりません:', userId);
        return null; // 設定がない場合はアラートをスキップ
    } catch (error) {
        console.error('目標CPM取得エラー:', error);
        return null;
    }
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
                status: 'active',
                checkItems: alert.checkItems || [],
                improvements: alert.improvements || {}
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
            currentGoal: 'toC_newsletter',
            rules: {},
            lastUpdated: new Date().toISOString()
        };
    }
}

module.exports = {
    checkAllAlerts,
    checkUserAlerts,
    getAlertHistory,
    getAlertSettings,
    getCurrentGoalType
}; 