const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');
const tokenManager = require('./tokenManager');

class ChatworkAutoSender {
    constructor() {
        this.settings = null;
        this.sentHistory = new Map(); // 送信履歴管理
        this.loadSettings();
    }

    // 設定ファイルを読み込み
    loadSettings() {
        try {
            // 本番環境では環境変数から設定を取得
            if (process.env.NODE_ENV === 'production') {
                this.settings = {
                    chatwork: {
                        apiToken: process.env.CHATWORK_TOKEN,
                        roomId: process.env.CHATWORK_ROOM_ID
                    },
                    notifications: {
                        daily_report: { enabled: process.env.DAILY_REPORT_ENABLED === 'true' || true },
                        update_notifications: { enabled: process.env.UPDATE_NOTIFICATIONS_ENABLED === 'true' || true },
                        alert_notifications: { enabled: process.env.ALERT_NOTIFICATIONS_ENABLED === 'true' || true }
                    }
                };
                console.log('✅ チャットワーク自動送信設定を環境変数から読み込みました');
            } else {
                // ローカル環境では設定ファイルから取得
                const settingsPath = path.join(__dirname, '..', 'settings.json');
                if (fs.existsSync(settingsPath)) {
                    this.settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                    console.log('✅ チャットワーク自動送信設定を読み込みました');
                } else {
                    console.log('⚠️ 設定ファイルが見つかりません');
                }
            }
        } catch (error) {
            console.error('❌ 設定ファイル読み込みエラー:', error.message);
        }
    }

    // 設定を再読み込み
    reloadSettings() {
        this.loadSettings();
    }

    // 送信履歴をチェック（重複送信防止）- 時間単位に変更
    checkSentHistory(type, date = null, alertIds = null) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        
        // アラートの場合は、アラートIDを使用して重複チェック
        if (type === 'alert' && alertIds && alertIds.length > 0) {
            const alertKey = `alert_${alertIds.sort().join('_')}`;
            if (this.sentHistory.has(alertKey)) {
                console.log(`⚠️ これらのアラートは既に送信済みです: ${alertKey}`);
                return false;
            }
            this.sentHistory.set(alertKey, new Date().toISOString());
            console.log(`✅ アラート送信履歴を記録: ${alertKey}`);
            return true;
        }
        
        // 通常の重複チェック
        const key = `${type}_${date || today}_${currentHour}`;
        
        if (this.sentHistory.has(key)) {
            console.log(`⚠️ ${type}は既にこの時間に送信済みです: ${key}`);
            return false;
        }
        
        this.sentHistory.set(key, new Date().toISOString());
        console.log(`✅ ${type}送信履歴を記録: ${key}`);
        return true;
    }

    // チャットワークにメッセージを送信
    async sendMessage(message) {
        if (!this.settings?.chatwork?.apiToken || !this.settings?.chatwork?.roomId) {
            console.log('⚠️ チャットワーク設定が不完全です');
            return false;
        }

        try {
            const url = `https://api.chatwork.com/v2/rooms/${this.settings.chatwork.roomId}/messages`;
            const response = await axios.post(url, `body=${encodeURIComponent(message)}`, {
                headers: {
                    'X-ChatWorkToken': this.settings.chatwork.apiToken,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.status === 200) {
                console.log('✅ チャットワーク送信成功');
                return true;
            } else {
                console.log('❌ チャットワーク送信失敗:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ チャットワーク送信エラー:', error.message);
            return false;
        }
    }

    // ダッシュボードデータを取得（修正版）
    async getDashboardData() {
        try {
            const response = await axios.get('http://localhost:3000/api/meta-ads-data?type=period&period=30');
            return response.data;
        } catch (error) {
            console.error('❌ ダッシュボードデータ取得エラー:', error.message);
            return null;
        }
    }

    // 最新のダッシュボードデータを取得（過去7日間から最新データを検索）
    async getYesterdayDashboardData() {
        try {
            console.log('📅 最新データ取得開始（過去7日間を検索）');
            
            // 過去7日間のデータを確認
            for (let i = 1; i <= 7; i++) {
                const targetDate = new Date();
                targetDate.setDate(targetDate.getDate() - i);
                const targetDateStr = targetDate.toISOString().split('T')[0];
                
                console.log(`🔍 ${targetDateStr} のデータ確認中...`);
                
                const defaultUserId = 'test@example.com';
                const dailyData = await this.fetchMetaDataDirectly(targetDateStr, null, defaultUserId);
                
                if (dailyData && (dailyData.spend > 0 || dailyData.impressions > 0)) {
                    console.log(`✅ ${targetDateStr} のデータ取得成功:`, dailyData);
                    return dailyData;
                }
            }
            
            console.log('❌ 過去7日間にデータが見つかりませんでした');
            return null;
            
        } catch (error) {
            console.error('❌ 最新ダッシュボードデータ取得エラー:', error.message);
            return null;
        }
    }

    // Meta APIから直接データを取得する関数
    async fetchMetaDataDirectly(selectedDate, campaignId = null, userId = null) {
        try {
            console.log(`=== 直接Meta API呼び出し: ${selectedDate} ===`, { userId });
            
            // 設定ファイルから認証情報を取得
            const config = this.getMetaApiConfigFromSetup(userId);
            
            if (!config || !config.accessToken || !config.accountId) {
                throw new Error('Meta API設定が見つかりません。設定画面で再度設定してください。');
            }
            
            console.log('🔍 Meta API使用する認証情報:', {
                accountId: config.accountId,
                accessTokenLength: config.accessToken.length,
                accessTokenPrefix: config.accessToken.substring(0, 10) + '...',
                userId: userId
            });
            
            const baseUrl = 'https://graph.facebook.com/v18.0';
            const endpoint = `${baseUrl}/${config.accountId}/insights`;
            
            const params = {
                access_token: config.accessToken,
                fields: [
                    'spend',
                    'impressions', 
                    'clicks',
                    'ctr',
                    'cpm',
                    'frequency',
                    'reach',
                    'actions',
                    'cost_per_action_type'
                ].join(','),
                time_range: JSON.stringify({
                    since: selectedDate,
                    until: selectedDate
                }),
                level: campaignId ? 'campaign' : 'account'
            };
            
            if (campaignId) {
                params.filtering = JSON.stringify([{
                    field: 'campaign.id',
                    operator: 'IN',
                    value: [campaignId]
                }]);
            }
            
            console.log('🚀 Meta API リクエスト開始:', endpoint);
            const response = await axios.get(endpoint, { params });
            
            if (!response.data || !response.data.data || response.data.data.length === 0) {
                console.log('⚠️ Meta APIから該当日のデータが見つかりませんでした');
                return this.getEmptyDailyData(selectedDate);
            }
            
            const insights = response.data.data[0];
            console.log('✅ Meta API レスポンス成功:', insights);
            
            // データを変換（impressionsも含める）
            const convertedData = this.convertInsightsToMetrics(insights, selectedDate, userId);
            convertedData.impressions = parseInt(insights.impressions || 0); // impressionsを追加
            return convertedData;
            
        } catch (error) {
            console.error('❌ 直接Meta API呼び出しエラー:', error.message);
            if (error.response?.status === 400) {
                console.log('⚠️ Meta API エラー詳細:', error.response.data);
            }
            return this.getEmptyDailyData(selectedDate);
        }
    }

    // 設定からMeta API認証情報を取得
    getMetaApiConfigFromSetup(userId = null) {
        try {
            const fs = require('fs');
            const path = require('path');
            
            // settings.jsonから設定を読み込み
            if (this.settings && this.settings.meta) {
                return {
                    accessToken: this.settings.meta.accessToken,
                    accountId: this.settings.meta.accountId
                };
            }
            
            // フォールバック: setup.jsonから読み込み
            const setupPath = path.join(__dirname, '..', 'config', 'setup.json');
            if (fs.existsSync(setupPath)) {
                const setupData = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
                console.log('📋 Setup.json読み込み成功:', {
                    hasMetaAccessToken: !!setupData.meta?.accessToken,
                    hasMetaAccountId: !!setupData.meta?.accountId,
                    accountId: setupData.meta?.accountId
                });
                
                if (setupData.meta && setupData.meta.accessToken && setupData.meta.accountId) {
                    return {
                        accessToken: setupData.meta.accessToken,
                        accountId: setupData.meta.accountId
                    };
                }
            }
            
            console.error('❌ Meta API設定が見つかりません');
            return null;
            
        } catch (error) {
            console.error('❌ Meta API設定読み込みエラー:', error.message);
            return null;
        }
    }

    // 空のデータを返す
    getEmptyDailyData(selectedDate) {
        return {
            spend: 0,
            budgetRate: '0.00',
            ctr: 0,
            cpm: 0,
            conversions: 0,
            cpa: 0,
            frequency: 0
        };
    }

    // インサイトデータをメトリクスに変換
    convertInsightsToMetrics(insights, selectedDate, userId = null) {
        const spend = parseFloat(insights.spend || 0);
        const conversions = this.getConversionsFromActions(insights.actions);
        const cpa = conversions > 0 ? spend / conversions : 0;
        
        const dailyBudget = this.getDailyBudgetFromGoals(userId);
        const budgetRate = (spend / dailyBudget) * 100;
        
        return {
            spend: Math.round(spend),
            budgetRate: parseFloat(Math.min(budgetRate, 999.99).toFixed(2)),
            ctr: parseFloat(parseFloat(insights.ctr || 0).toFixed(2)),
            cpm: Math.round(parseFloat(insights.cpm || 0)),
            conversions: conversions,
            cpa: Math.round(cpa),
            frequency: parseFloat(parseFloat(insights.frequency || 0).toFixed(2))
        };
    }

    // アクションからコンバージョン抽出
    getConversionsFromActions(actions) {
        if (!actions || !Array.isArray(actions)) return 0;
        
        let total = 0;
        let detectedEvents = [];
        
        // Meta標準コンバージョンイベント + カスタムコンバージョンイベント
        const conversionTypes = [
            // 標準イベント
            'purchase', 
            'lead', 
            'complete_registration', 
            'add_to_cart',
            'initiate_checkout',
            'add_payment_info',
            'subscribe',
            'start_trial',
            'submit_application',
            'schedule',
            'contact',
            'donate'
        ];
        
        // 重複カウント防止 - 同じ値の異なるアクションタイプは同一CVの可能性が高い
        const conversionsByValue = {};
        
        actions.forEach(action => {
            let shouldCount = false;
            let eventType = action.action_type;
            let priority = 0; // 優先度（高い方を採用）
            
            // 標準的なコンバージョンタイプをチェック
            if (conversionTypes.includes(action.action_type)) {
                shouldCount = true;
                priority = 10;
            }
            // offsite_conversion プレフィックスを持つアクション（ただしview_contentは除外）
            else if (action.action_type && action.action_type.startsWith('offsite_conversion.') &&
                     !action.action_type.includes('view_content')) {
                shouldCount = true;
                priority = 8;
                if (action.action_type === 'offsite_conversion.fb_pixel_custom') {
                    eventType = 'カスタムCV';
                }
            }
            // onsite_conversion プレフィックスを持つすべてのアクション
            else if (action.action_type && action.action_type.startsWith('onsite_conversion.')) {
                shouldCount = true;
                priority = 7;
            }
            // Metaリード広告のコンバージョン（最優先）
            else if (action.action_type && action.action_type.includes('meta_leads')) {
                shouldCount = true;
                eventType = 'Metaリード';
                priority = 15; // 最優先
            }
            // offsite_content_view系のコンバージョン（リード広告など）
            else if (action.action_type && action.action_type.startsWith('offsite_content_view_add_')) {
                shouldCount = true;
                eventType = 'リード広告CV';
                priority = 12;
            }
            // omni プレフィックスを持つコンバージョン系アクション
            else if (action.action_type && action.action_type.startsWith('omni_') && 
                     ['purchase', 'lead', 'complete_registration', 'add_to_cart', 'initiated_checkout'].some(type => 
                        action.action_type.includes(type))) {
                shouldCount = true;
                priority = 6;
            }
            // その他のlead関連アクション
            else if (action.action_type && action.action_type.toLowerCase().includes('lead')) {
                shouldCount = true;
                priority = 5;
            }
            
            if (shouldCount) {
                const value = parseInt(action.value || 0);
                
                // 重複チェック：同じ値のコンバージョンは優先度が高い方のみカウント
                if (!conversionsByValue[value] || conversionsByValue[value].priority < priority) {
                    if (conversionsByValue[value]) {
                        // 既存の値を減算
                        total -= value;
                    }
                    conversionsByValue[value] = { priority, eventType };
                    total += value;
                    detectedEvents.push(`${eventType}: ${value}`);
                }
            }
        });
        
        // デバッグ用ログ（本番環境では削除可能）
        if (detectedEvents.length > 0) {
            console.log('検出されたコンバージョン:', detectedEvents.join(', '));
        }
        
        return total;
    }

    // 日予算を取得
    getDailyBudgetFromGoals(userId = null) {
        try {
            if (this.settings?.goal?.target_dailyBudget) {
                return parseFloat(this.settings.goal.target_dailyBudget);
            }
            return 15000; // デフォルト値
        } catch (error) {
            console.error('日予算取得エラー:', error);
            return 15000;
        }
    }

    // 予算消化率を計算
    calculateBudgetRate(spend) {
        if (!this.settings?.goal?.target_dailyBudget) {
            return '0.00';
        }
        const dailyBudget = parseFloat(this.settings.goal.target_dailyBudget);
        if (dailyBudget === 0) return '0.00';
        return ((spend / dailyBudget) * 100).toFixed(2);
    }

    // アラート履歴を取得（重複除去強化版）
    getAlertHistory(isTestMode = false) {
        try {
            const alertHistoryPath = path.join(__dirname, '..', 'alert_history.json');
            if (fs.existsSync(alertHistoryPath)) {
                const alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
                
                let filteredAlerts;
                
                if (isTestMode) {
                    // テストモード時は最新のアクティブなアラートを取得（過去3日間）
                    const threeDaysAgo = new Date();
                    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
                    
                    filteredAlerts = alertHistory.filter(alert => {
                        const alertDate = new Date(alert.timestamp);
                        return alertDate >= threeDaysAgo && alert.status === 'active';
                    });
                    
                    console.log(`🧪 テストモード: 過去3日間のアクティブアラート数: ${filteredAlerts.length}件`);
                } else {
                    // 通常モード：過去24時間以内のアクティブなアラートを取得
                    const twentyFourHoursAgo = new Date();
                    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
                    
                    filteredAlerts = alertHistory.filter(alert => {
                        const alertDate = new Date(alert.timestamp);
                        return alertDate >= twentyFourHoursAgo && alert.status === 'active';
                    });
                    
                    console.log(`📊 過去24時間のアラート数: ${filteredAlerts.length}件`);
                    
                    // さらに、アラートがない場合は最新のアクティブなアラートを最大5件取得
                    if (filteredAlerts.length === 0) {
                        const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
                        // タイムスタンプでソート（新しい順）
                        activeAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                        // 最新5件を取得
                        filteredAlerts = activeAlerts.slice(0, 5);
                        console.log(`📝 最新のアクティブアラート数: ${filteredAlerts.length}件`);
                    }
                }

                // 重複を除去（同じmetricの最新のアラートのみを保持）
                const uniqueAlerts = [];
                const seenMetrics = new Set();
                
                // タイムスタンプでソート（新しい順）
                filteredAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                
                filteredAlerts.forEach(alert => {
                    if (!seenMetrics.has(alert.metric)) {
                        seenMetrics.add(alert.metric);
                        uniqueAlerts.push(alert);
                    }
                });

                return uniqueAlerts;
            }
        } catch (error) {
            console.error('❌ アラート履歴読み込みエラー:', error.message);
        }
        return [];
    }

    // アラートメトリック名を日本語に変換（強化版）
    getJapaneseMetricName(metric) {
        const metricMap = {
            'budget_rate': '予算消化率',
            'daily_budget': '日予算',
            'ctr': 'CTR',
            'cpm': 'CPM',
            'cpa_rate': 'CPA',
            'CV': 'CV数',
            'conversions': 'コンバージョン数',
            'cpm_increase': 'CPM上昇',
            '予算消化率': '予算消化率',
            '日予算': '日予算',
            'CTR': 'CTR',
            'CPM': 'CPM',
            'CPA': 'CPA',
            'コンバージョン数': 'コンバージョン数',
            'CPM上昇': 'CPM上昇'
        };
        return metricMap[metric] || metric;
    }

    // アラートメッセージを整形（強化版）
    formatAlertMessage(alert) {
        let message = alert.message;
        
        // 技術用語を日本語に変換
        const replacements = {
            'budget_rate': '予算消化率',
            'ctr': 'CTR',
            'conversions': 'CV',
            'cpa_rate': 'CPA',
            'cpm_increase': 'CPM上昇',
            'daily_budget': '日予算',
            'cpm': 'CPM',
            'コンバージョン数': 'CV',
            'CV数': 'CV'
        };
        
        Object.entries(replacements).forEach(([eng, jpn]) => {
            message = message.replace(new RegExp(eng, 'g'), jpn);
        });
        
        return message;
    }

    // 日次レポート送信（修正版）
    async sendDailyReport() {
        console.log('📅 日次レポート送信開始');
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('ja-JP');
        
        // 重複送信チェック
        if (!this.checkSentHistory('daily', yesterday.toISOString().split('T')[0])) {
            console.log('⚠️ 日次レポートは既に送信済みです');
            return;
        }
        
        const dashboardData = await this.getYesterdayDashboardData();
        if (!dashboardData) {
            console.log('❌ 前日ダッシュボードデータ取得失敗');
            // エラー時は基本的なメッセージを送信
            const fallbackMessage = `Meta広告 日次レポート (${yesterdayStr})

データ取得に失敗しました。ダッシュボードでご確認ください。

確認はこちら
http://localhost:3000/dashboard`;
            await this.sendMessage(fallbackMessage);
            return;
        }

        const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${(dashboardData.spend || 0).toLocaleString()}円
予算消化率（平均）：${dashboardData.budgetRate || '0.00'}%
CTR（平均）：${(dashboardData.ctr || 0).toFixed(2)}%
CPM（平均）：${Math.round(dashboardData.cpm || 0).toLocaleString()}円 
CPA（平均）：${(dashboardData.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${(dashboardData.frequency || 0).toFixed(2)}%
コンバージョン数：${dashboardData.conversions || 0}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessage(message);
    }

    // 定期更新通知送信（重複送信防止版）
    async sendUpdateNotification() {
        console.log('🔄 定期更新通知送信開始');
        
        // 重複送信チェック
        if (!this.checkSentHistory('update')) {
            console.log('⚠️ 定期更新通知は既に送信済みです');
            return;
        }
        
        const message = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessage(message);
    }

    // アラート通知送信（統一版・重複送信防止）
    async sendAlertNotification(isTestMode = false) {
        console.log('🚨 アラート通知送信開始');
        
        const todayAlerts = this.getAlertHistory(isTestMode);
        if (todayAlerts.length === 0) {
            console.log('📝 送信可能なアラートはありません');
            return;
        }
        
        // アラートIDを取得して重複送信チェック（テストモード時はスキップ）
        const alertIds = todayAlerts.map(alert => alert.id || alert.metric);
        if (!isTestMode && !this.checkSentHistory('alert', null, alertIds)) {
            console.log('⚠️ これらのアラートは既に送信済みです');
            return;
        }

        let message = `Meta広告 アラート通知 (${new Date().toLocaleDateString('ja-JP')})
以下のアラートが発生しています：

`;

        todayAlerts.forEach((alert, index) => {
            const japaneseMetric = this.getJapaneseMetricName(alert.metric);
            const formattedMessage = this.formatAlertMessage(alert);
            message += `${index + 1}. ${japaneseMetric}：${formattedMessage}\n`;
        });

        message += `
確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks
改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies
ダッシュボード：https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessage(message);
    }

    // アクセストークン更新通知送信（重複送信防止版）
    async sendTokenUpdateNotification() {
        console.log('🔑 アクセストークン更新通知送信開始');
        
        // 重複送信チェック
        if (!this.checkSentHistory('token')) {
            console.log('⚠️ アクセストークン更新通知は既に送信済みです');
            return;
        }
        
        const message = `Meta APIのアクセストークンが2ヶ月経過し更新が必要です。

更新手順
①アクセストークン発行：https://developers.facebook.com/tools/explorer/ 
②長期トークン発行：https://developers.facebook.com/tools/debug/accesstoken/
③設定画面で更新： https://meta-ads-dashboard.onrender.com/setup

トークンが期限切れになると、自動送信機能が停止します。`;

        await this.sendMessage(message);
    }

    // ユーザー固有の設定を取得
    getUserSettings(userId) {
        if (!userId) {
            console.log('⚠️ ユーザーIDが指定されていません');
            return null;
        }

        try {
            const UserManager = require('../userManager');
            const userManager = new UserManager();
            const userSettings = userManager.getUserSettings(userId);
            
            if (!userSettings) {
                console.log(`⚠️ ユーザー設定が見つかりません: ${userId}`);
                return null;
            }

            console.log(`✅ ユーザー設定取得成功: ${userId}`);
            return {
                chatwork: {
                    apiToken: userSettings.chatwork_token,
                    roomId: userSettings.chatwork_room_id
                }
            };
        } catch (error) {
            console.error('❌ ユーザー設定取得エラー:', error.message);
            return null;
        }
    }

    // チャットワークにメッセージを送信（ユーザー設定対応版）
    async sendMessageWithUserSettings(message, userId) {
        const userSettings = this.getUserSettings(userId);
        
        if (!userSettings?.chatwork?.apiToken || !userSettings?.chatwork?.roomId) {
            console.log('⚠️ ユーザーのチャットワーク設定が不完全です');
            return false;
        }

        try {
            const url = `https://api.chatwork.com/v2/rooms/${userSettings.chatwork.roomId}/messages`;
            const response = await axios.post(url, `body=${encodeURIComponent(message)}`, {
                headers: {
                    'X-ChatWorkToken': userSettings.chatwork.apiToken,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            if (response.status === 200) {
                console.log('✅ チャットワーク送信成功');
                return true;
            } else {
                console.log('❌ チャットワーク送信失敗:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ チャットワーク送信エラー:', error.message);
            return false;
        }
    }

    // テスト送信（重複送信チェック無効）
    async sendTestMessage(type, userId) {
        console.log(`🧪 テスト送信開始: ${type}`, { userId });
        
        // テスト送信時は重複送信チェックを一時的に無効化
        const originalCheckSentHistory = this.checkSentHistory;
        this.checkSentHistory = () => true; // 常にtrueを返す
        
        try {
            switch (type) {
                case 'daily':
                    await this.sendDailyReportWithUser(userId);
                    break;
                case 'update':
                    await this.sendUpdateNotificationWithUser(userId);
                    break;
                case 'alert':
                    await this.sendAlertNotificationWithUser(userId, true);
                    break;
                case 'token':
                    await this.sendTokenUpdateNotificationWithUser(userId);
                    break;
                default:
                    console.log('❌ 不明なテストタイプ:', type);
            }
        } finally {
            // 重複送信チェック機能を復元
            this.checkSentHistory = originalCheckSentHistory;
        }
    }

    // ユーザー固有の日次レポート送信
    async sendDailyReportWithUser(userId) {
        console.log('📅 ユーザー固有日次レポート送信開始', { userId });
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('ja-JP');
        
        const dashboardData = await this.getYesterdayDashboardData();
        if (!dashboardData) {
            console.log('❌ 前日ダッシュボードデータ取得失敗');
            const fallbackMessage = `Meta広告 日次レポート (${yesterdayStr})

データ取得に失敗しました。ダッシュボードでご確認ください。

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
            await this.sendMessageWithUserSettings(fallbackMessage, userId);
            return;
        }

        const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${(dashboardData.spend || 0).toLocaleString()}円
予算消化率（平均）：${dashboardData.budgetRate || '0.00'}%
CTR（平均）：${(dashboardData.ctr || 0).toFixed(2)}%
CPM（平均）：${Math.round(dashboardData.cpm || 0).toLocaleString()}円 
CPA（平均）：${(dashboardData.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${(dashboardData.frequency || 0).toFixed(2)}%
コンバージョン数：${dashboardData.conversions || 0}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessageWithUserSettings(message, userId);
    }

    // ユーザー固有の定期更新通知送信
    async sendUpdateNotificationWithUser(userId) {
        console.log('🔄 ユーザー固有定期更新通知送信開始', { userId });
        
        const message = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessageWithUserSettings(message, userId);
    }

    // ユーザー固有のアラート通知送信
    async sendAlertNotificationWithUser(userId, isTestMode = false) {
        console.log('🚨 ユーザー固有アラート通知送信開始', { userId });
        
        const todayAlerts = this.getAlertHistory(isTestMode);
        if (todayAlerts.length === 0) {
            console.log('📝 送信可能なアラートはありません');
            return;
        }
        
        // アラートIDを取得して重複送信チェック（テストモード時はスキップ）
        const alertIds = todayAlerts.map(alert => alert.id || alert.metric);
        if (!isTestMode && !this.checkSentHistory(`alert_user_${userId}`, null, alertIds)) {
            console.log('⚠️ これらのアラートは既にこのユーザーに送信済みです');
            return;
        }

        let message = `Meta広告 アラート通知 (${new Date().toLocaleDateString('ja-JP')})
以下のアラートが発生しています：

`;

        todayAlerts.forEach((alert, index) => {
            const japaneseMetric = this.getJapaneseMetricName(alert.metric);
            const formattedMessage = this.formatAlertMessage(alert);
            message += `${index + 1}. ${japaneseMetric}：${formattedMessage}\n`;
        });

        message += `
確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks
改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies
ダッシュボード：https://meta-ads-dashboard.onrender.com/dashboard`;

        await this.sendMessageWithUserSettings(message, userId);
    }

    // ユーザー固有のアクセストークン更新通知送信
    async sendTokenUpdateNotificationWithUser(userId) {
        console.log('🔑 ユーザー固有アクセストークン更新通知送信開始', { userId });
        
        const message = `Meta APIのアクセストークンが2ヶ月経過し更新が必要です。

更新手順
①アクセストークン発行：https://developers.facebook.com/tools/explorer/ 
②長期トークン発行：https://developers.facebook.com/tools/debug/accesstoken/
③設定画面で更新： https://meta-ads-dashboard.onrender.com/setup

トークンが期限切れになると、自動送信機能が停止します。`;

        await this.sendMessageWithUserSettings(message, userId);
    }

    // スケジューラーを開始
    startScheduler() {
        console.log('🕐 チャットワーク自動送信スケジューラーを開始しました');

        // 日次レポート: 毎朝9時
        cron.schedule('0 9 * * *', async () => {
            console.log('📅 日次レポート送信スケジュール実行');
            await this.sendDailyReport();
        }, {
            timezone: 'Asia/Tokyo'
        });

        // 定期更新通知: 12時、15時、17時、19時
        cron.schedule('0 12,15,17,19 * * *', async () => {
            console.log('🔄 定期更新通知送信スケジュール実行');
            await this.sendUpdateNotification();
        }, {
            timezone: 'Asia/Tokyo'
        });

        // アラート通知: 9時、12時、15時、17時、19時（アラートがある場合）
        cron.schedule('0 9,12,15,17,19 * * *', async () => {
            console.log('🚨 アラート通知送信スケジュール実行');
            await this.sendAlertNotification();
        }, {
            timezone: 'Asia/Tokyo'
        });

        // アクセストークン更新通知: 期限1週間前に1回のみ送信
        cron.schedule('0 9 * * *', async () => {
            console.log('🔑 アクセストークン更新通知チェック実行');
            try {
                const checkResult = await tokenManager.checkTokenExpiry();
                
                if (checkResult.shouldNotify) {
                    console.log('⚠️ トークン期限警告送信');
                    await this.sendTokenUpdateNotification();
                    await tokenManager.markNotificationSent();
                } else {
                    console.log(`ℹ️ トークン期限チェック: ${checkResult.reason}`);
                }
            } catch (error) {
                console.error('❌ トークン期限チェックエラー:', error);
            }
        }, {
            timezone: 'Asia/Tokyo'
        });

        console.log('✅ チャットワーク自動送信スケジューラー設定完了');
    }
}

module.exports = ChatworkAutoSender; 