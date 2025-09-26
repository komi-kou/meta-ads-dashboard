// alertSystem.js - ユーザー設定ベースのアラート判定とデータ管理
const fs = require('fs');
const path = require('path');
const { metaApi } = require('./metaApi');
const { sendChatworkNotification } = require('./chatworkApi');
const UserManager = require('./userManager');
const { checkSentHistory, recordSentHistory, sendAlertsDirectly } = require('./alertSystemExtensions');

// UserManagerのインスタンスを作成
const userManager = new UserManager();

// メトリクスの方向性定義（高い方が良い/低い方が良い）
const METRIC_DIRECTIONS = {
    // 高い方が良い指標（目標を下回るとアラート）
    ctr: 'higher_better',
    cvr: 'higher_better',
    conversions: 'higher_better',
    roas: 'higher_better',
    budget_rate: 'higher_better',  // 予算消化率: 目標を下回る（80%未満）とアラート
    
    // 低い方が良い指標（目標を上回るとアラート）
    cpa: 'lower_better',
    cpm: 'lower_better',
    cpc: 'lower_better'
};

// ユーザー設定から目標値を取得（ユーザー入力値のみ使用、デフォルト値なし）
function getUserTargets(userId) {
    try {
        const userSettings = userManager.getUserSettings(userId);
        if (!userSettings) {
            console.log('ユーザー設定が見つかりません:', userId);
            return null;
        }
        
        console.log(`ユーザー${userId}の生の設定:`, userSettings);
        const targets = {};
        
        // 各目標値を取得（空文字列や無効な値は無視）
        if (userSettings.target_cpa && userSettings.target_cpa !== '') {
            const val = parseFloat(userSettings.target_cpa);
            if (!isNaN(val) && val > 0) targets.cpa = val;
        }
        if (userSettings.target_cpm && userSettings.target_cpm !== '') {
            const val = parseFloat(userSettings.target_cpm);
            if (!isNaN(val) && val > 0) targets.cpm = val;
        }
        if (userSettings.target_ctr && userSettings.target_ctr !== '') {
            const val = parseFloat(userSettings.target_ctr);
            if (!isNaN(val) && val > 0) targets.ctr = val;
        }
        if (userSettings.target_cvr && userSettings.target_cvr !== '') {
            const val = parseFloat(userSettings.target_cvr);
            if (!isNaN(val) && val > 0) targets.cvr = val;
        }
        if (userSettings.target_cv && userSettings.target_cv !== '') {
            const val = parseInt(userSettings.target_cv);
            if (!isNaN(val) && val > 0) targets.conversions = val;
        }
        if (userSettings.target_budget_rate && userSettings.target_budget_rate !== '') {
            const val = parseFloat(userSettings.target_budget_rate);
            if (!isNaN(val) && val > 0) targets.budget_rate = val;
        }
        if (userSettings.target_roas && userSettings.target_roas !== '') {
            const val = parseFloat(userSettings.target_roas);
            if (!isNaN(val) && val > 0) targets.roas = val;
        }
        if (userSettings.target_cpc && userSettings.target_cpc !== '') {
            const val = parseFloat(userSettings.target_cpc);
            if (!isNaN(val) && val > 0) targets.cpc = val;
        }
        
        console.log(`ユーザー${userId}の有効な目標値:`, targets);
        return Object.keys(targets).length > 0 ? targets : null;
        
    } catch (error) {
        console.error('目標値取得エラー:', error);
        return null;
    }
}

// 現在のゴールタイプを取得（ユーザー設定のみ使用）
function getCurrentGoalType(userId = null) {
    try {
        if (userId) {
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings && (userSettings.service_goal || userSettings.goal_type)) {
                const goalType = userSettings.service_goal || userSettings.goal_type;
                return goalType;
            }
        }
        return null; // デフォルト値なし
    } catch (error) {
        console.error('ゴールタイプ取得エラー:', error.message);
        return null;
    }
}

// 過去のデータを取得
async function getHistoricalData(days, userId = null) {
    try {
        let config = null;
        
        // ユーザー固有の設定を優先
        if (userId) {
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings && userSettings.meta_access_token && userSettings.meta_account_id) {
                config = {
                    accessToken: userSettings.meta_access_token,
                    accountId: userSettings.meta_account_id
                };
            }
        }
        
        // フォールバック：共通設定
        if (!config) {
            const settingsPath = path.join(__dirname, 'settings.json');
            if (fs.existsSync(settingsPath)) {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.meta) {
                    config = settings.meta;
                }
            }
        }
        
        if (!config || !config.accessToken || !config.accountId) {
            console.log('Meta API設定が不完全です');
            return [];
        }

        // 過去のデータを取得
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // ユーザー設定をmetaApiに渡す
        if (userId) {
            const userSettings = userManager.getUserSettings(userId);
            if (userSettings) {
                // metaApiのgetUserSettings関数をセット
                metaApi.getUserSettings = () => userSettings;
            }
        }
        
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

// ユーザー固有のアラートチェック実行
async function checkUserAlerts(userId) {
    console.log(`=== ユーザー${userId}のアラートチェック開始 ===`);
    
    try {
        // ユーザーの目標値を取得
        const targets = getUserTargets(userId);
        if (!targets || Object.keys(targets).length === 0) {
            console.log('目標値が設定されていません:', userId);
            return [];
        }
        
        // 最新のデータを取得（1日分）
        const historicalData = await getHistoricalData(1, userId);
        if (!historicalData || historicalData.length === 0) {
            console.log('データが取得できませんでした');
            return [];
        }
        
        // 最新データは配列の最後の要素
        const latestData = historicalData[historicalData.length - 1];
        console.log('使用するデータ:', latestData);
        const alerts = [];
        
        // 各目標値に対してチェック
        for (const [metric, targetValue] of Object.entries(targets)) {
            const alertResult = await checkMetricAgainstTarget(
                metric,
                targetValue,
                latestData,
                userId
            );
            
            if (alertResult) {
                alerts.push({
                    ...alertResult,
                    userId: userId
                });
            }
        }
        
        // アラートが発生した場合の処理
        if (alerts.length > 0) {
            // アラート履歴に保存
            await saveAlertHistory(alerts);
            
            // チャットワーク通知は無効化
            // 通知は以下の場所でのみ送信：
            // 1. checkAllAlerts内のsendAlertsDirectly
            // 2. スケジューラーからの定期実行時
            // checkUserAlertsから直接送信しないことで重複を防ぐ
            
            console.log('📝 アラート履歴保存のみ実行（通知は別途送信）');
        }
        
        console.log(`ユーザー${userId}のアラートチェック完了: ${alerts.length}件のアラート`);
        return alerts;
        
    } catch (error) {
        console.error(`ユーザー${userId}のアラートチェックエラー:`, error);
        return [];
    }
}

// 個別メトリックのアラートチェック
async function checkMetricAgainstTarget(metric, targetValue, latestData, userId) {
    console.log(`${metric}のアラートチェック中... 目標値: ${targetValue}`);
    
    try {
        const currentValue = getMetricValue(latestData, metric);
        const direction = METRIC_DIRECTIONS[metric] || 'higher_better';
        
        let alertTriggered = false;
        let alertMessage = '';
        let severity = 'warning';
        
        // メトリクスの方向性に応じた判定
        if (direction === 'higher_better') {
            // 高い方が良い指標（目標を下回るとアラート）
            if (currentValue < targetValue) {
                alertTriggered = true;
                alertMessage = `${getMetricDisplayName(metric)}が目標値${formatValue(targetValue, metric)}を下回っています（現在: ${formatValue(currentValue, metric)}）`;
                severity = currentValue < targetValue * 0.7 ? 'critical' : 'warning';
            }
        } else if (direction === 'lower_better') {
            // 低い方が良い指標（目標を上回るとアラート）
            if (currentValue > targetValue) {
                alertTriggered = true;
                alertMessage = `${getMetricDisplayName(metric)}が目標値${formatValue(targetValue, metric)}を上回っています（現在: ${formatValue(currentValue, metric)}）`;
                severity = currentValue > targetValue * 1.3 ? 'critical' : 'warning';
            }
        }
        
        if (alertTriggered) {
            // 確認事項と改善施策を取得
            let checkItems = [];
            let improvementStrategies = {};
            
            try {
                const { checklistRules } = require('./utils/checklistRules');
                const { improvementStrategiesRules } = require('./utils/improvementStrategiesRules');
                
                const metricDisplayName = getMetricDisplayName(metric);
                
                // 確認事項を取得
                const ruleData = checklistRules[metricDisplayName];
                if (ruleData && ruleData.items) {
                    checkItems = ruleData.items;
                    console.log(`✅ ${metric}の確認事項を取得: ${checkItems.length}件`);
                }
                
                // 改善施策を取得
                improvementStrategies = improvementStrategiesRules[metricDisplayName] || {};
                console.log(`✅ ${metric}の改善施策を取得: ${Object.keys(improvementStrategies).length}カテゴリ`);
                
            } catch (error) {
                console.error('確認事項・改善施策の読み込みエラー:', error);
                // デフォルトのフォールバック
                checkItems = [
                    {
                        priority: 1,
                        title: '指標の確認',
                        description: '詳細な分析が必要です'
                    }
                ];
                improvementStrategies = {
                    '指標の確認': ['データを詳しく分析してください']
                };
            }
            
            return {
                id: `${metric}_${Date.now()}`,
                metric: metric,
                targetValue: targetValue,
                currentValue: currentValue,
                message: alertMessage,
                severity: severity,
                triggeredAt: new Date().toISOString(),
                data: latestData,
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

// メトリクス値取得
function getMetricValue(dayData, metric) {
    if (!dayData) {
        return 0;
    }
    
    switch (metric) {
        case 'budget_rate':
            return parseFloat(dayData.budgetRate || 0);
        case 'ctr':
            return parseFloat(dayData.ctr || 0);
        case 'conversions':
            return parseInt(dayData.conversions || 0);
        case 'cpm':
            return parseFloat(dayData.cpm || 0);
        case 'cpa':
            return parseFloat(dayData.cpa || 0);
        case 'cvr':
            return parseFloat(dayData.cvr || 0);
        case 'roas':
            return parseFloat(dayData.roas || 0);
        case 'cpc':
            return parseFloat(dayData.cpc || 0);
        default:
            return 0;
    }
}

// 値のフォーマット
function formatValue(value, metric) {
    switch (metric) {
        case 'ctr':
        case 'cvr':
            return `${Math.round(value * 10) / 10}%`;
        case 'budget_rate':
            return `${Math.round(value * 10) / 10}%`;
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

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    switch (metric) {
        case 'budget_rate':
            return '予算消化率';
        case 'ctr':
            return 'CTR';
        case 'conversions':
            return 'CV';
        case 'cpm':
            return 'CPM';
        case 'cpa':
            return 'CPA';
        case 'cvr':
            return 'CVR';
        case 'roas':
            return 'ROAS';
        case 'cpc':
            return 'CPC';
        default:
            return metric;
    }
}

// ユーザー固有のチャットワーク通知
async function sendUserAlertsToChatwork(alerts, userId) {
    try {
        const userSettings = userManager.getUserSettings(userId);
        if (!userSettings || !userSettings.chatwork_api_token || !userSettings.chatwork_room_id) {
            console.log('チャットワーク設定が不完全です:', userId);
            return;
        }
        
        const dateStr = new Date().toLocaleDateString('ja-JP');
        
        let message = `[info][title]Meta広告 アラート通知 (${dateStr})[/title]`;
        message += `以下の指標が目標値から外れています：\n\n`;
        
        // アラートを重要度順に並べ替え
        const sortedAlerts = alerts.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (a.severity !== 'critical' && b.severity === 'critical') return 1;
            return 0;
        });
        
        sortedAlerts.forEach((alert, index) => {
            const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
            const metricName = getMetricDisplayName(alert.metric);
            message += `${icon} ${metricName}: `;
            message += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
            message += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
        });
        
        message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
        message += `https://meta-ads-dashboard.onrender.com/dashboard\n\n`;
        message += `✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks\n`;
        message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies[/info]`;
        
        // チャットワークAPI呼び出し
        const fetch = require('node-fetch');
        const response = await fetch(`https://api.chatwork.com/v2/rooms/${userSettings.chatwork_room_id}/messages`, {
            method: 'POST',
            headers: {
                'X-ChatWorkToken': userSettings.chatwork_api_token,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `body=${encodeURIComponent(message)}`
        });
        
        if (response.ok) {
            console.log('✅ チャットワークアラート通知送信完了');
        } else {
            console.error('❌ チャットワーク通知失敗:', response.status);
        }
        
    } catch (error) {
        console.error('❌ チャットワーク通知エラー:', error);
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
        
        // 新しいアラートを履歴に追加
        alerts.forEach(alert => {
            const historyEntry = {
                id: alert.id,
                userId: alert.userId,
                metric: getMetricDisplayName(alert.metric),
                message: alert.message,
                targetValue: alert.targetValue,
                currentValue: alert.currentValue,
                severity: alert.severity,
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

// アラート履歴取得（ユーザーIDによるフィルタリング対応）
async function getAlertHistory(userId = null) {
    try {
        const historyPath = path.join(__dirname, 'alert_history.json');
        
        if (fs.existsSync(historyPath)) {
            let allHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            
            // ユーザーIDが指定されている場合
            if (userId) {
                // 現在の目標値を取得
                const currentTargets = getUserTargets(userId);
                
                // このユーザーのアラートをフィルタリング＆目標値を更新
                allHistory = allHistory.map(alert => {
                    if (alert.userId === userId && currentTargets) {
                        const metricLower = alert.metric.toLowerCase();
                        if (metricLower in currentTargets) {
                            const newTarget = currentTargets[metricLower];
                            if (alert.targetValue !== newTarget) {
                                // 目標値を更新
                                alert.targetValue = newTarget;
                                // メッセージも更新
                                const targetStr = metricLower === 'conversions' ? newTarget + '件' : 
                                                 metricLower === 'ctr' || metricLower === 'cvr' ? newTarget + '%' :
                                                 newTarget.toLocaleString('ja-JP') + '円';
                                alert.message = alert.message.replace(/目標値[^を）]+/g, '目標値' + targetStr);
                            }
                        }
                    }
                    return alert;
                });
                
                // 更新された履歴を保存
                fs.writeFileSync(historyPath, JSON.stringify(allHistory, null, 2));
                
                // フィルタリングして返す
                return allHistory.filter(alert => alert.userId === userId);
            }
            
            return allHistory;
        }
        
        return [];
    } catch (error) {
        console.error('アラート履歴取得エラー:', error);
        return [];
    }
}

// 全アラートチェック実行（後方互換性）
async function checkAllAlerts() {
    console.log('=== 統一アラートシステム: 全ユーザーチェック開始 ===');
    
    try {
        // 送信履歴チェック（ファイルベース）
        if (!checkSentHistory('alert')) {
            console.log('⚠️ アラート通知は本日既に送信済みです');
            return [];
        }
        
        const users = userManager.getAllUsers();
        const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
        const multiUserSender = new MultiUserChatworkSender();
        let totalAlerts = 0;
        
        // 各ユーザーのアラートをチェックして送信
        for (const user of users) {
            const userSettings = userManager.getUserSettings(user.id);
            
            // アラート機能が有効なユーザーのみ処理
            if (userSettings && userSettings.enable_alerts && userSettings.alert_notifications_enabled !== false) {
                const userAlerts = await checkUserAlerts(user.id);
                
                if (userAlerts.length > 0) {
                    totalAlerts += userAlerts.length;
                    // 統一フォーマットでチャットワーク送信
                    const userSettingsForSend = {
                        user_id: user.id,
                        chatwork_token: userSettings.chatwork_api_token || userSettings.chatwork_token,
                        chatwork_room_id: userSettings.chatwork_room_id,
                        alert_notifications_enabled: true
                    };
                    
                    // アラートデータを直接渡して送信
                    console.log('➡️ checkAllAlertsから統一通知送信');
                    await sendAlertsDirectly(userAlerts, userSettingsForSend);
                }
            }
        }
        
        // 送信完了を記録
        if (totalAlerts > 0) {
            recordSentHistory('alert');
        }
        
        console.log(`統一アラートシステム: 完了 (総アラート数: ${totalAlerts})`);
        return [];
        
    } catch (error) {
        console.error('統一アラートシステムエラー:', error);
        return [];
    }
}

// アラート設定取得（後方互換性）
function getAlertSettings() {
    return {
        mode: 'user_targets',
        description: 'ユーザー設定の目標値ベースでアラート判定',
        lastUpdated: new Date().toISOString()
    };
}

module.exports = {
    checkAllAlerts,
    checkUserAlerts,
    getAlertHistory,
    getAlertSettings,
    getCurrentGoalType,
    getUserTargets
};