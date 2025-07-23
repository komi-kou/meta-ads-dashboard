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
            const settingsPath = path.join(__dirname, '..', 'settings.json');
            if (fs.existsSync(settingsPath)) {
                this.settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                console.log('✅ チャットワーク自動送信設定を読み込みました');
            } else {
                console.log('⚠️ 設定ファイルが見つかりません');
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
    checkSentHistory(type, date = null) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
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
            const response = await axios.get('https://meta-ads-dashboard.onrender.com/api/meta-ads-data?type=period&period=30');
            return response.data;
        } catch (error) {
            console.error('❌ ダッシュボードデータ取得エラー:', error.message);
            return null;
        }
    }

    // 前日のダッシュボードデータを取得（修正版）
    async getYesterdayDashboardData() {
        try {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            console.log(`📅 前日データ取得開始: ${yesterdayStr}`);
            
            // User-Agentを付与して内部リクエスト扱いにする
            const response = await axios.get(`https://meta-ads-dashboard.onrender.com/api/meta-ads-data?type=daily&date=${yesterdayStr}`,
                { headers: { 'User-Agent': 'Internal-Server-Request' } });
            const dailyData = response.data;
            
            if (!dailyData) {
                console.log('❌ 前日データが取得できませんでした');
                return null;
            }
            
            console.log('✅ 前日データ取得成功:', dailyData);
            return dailyData;
            
        } catch (error) {
            console.error('❌ 前日ダッシュボードデータ取得エラー:', error.message);
            
            // フォールバック: 期間データから前日を抽出
            try {
                console.log('🔄 フォールバック: 期間データから前日を抽出');
                const periodResponse = await axios.get('https://meta-ads-dashboard.onrender.com/api/meta-ads-data?type=period&period=30',
                    { headers: { 'User-Agent': 'Internal-Server-Request' } });
                const periodData = periodResponse.data;
                
                if (!periodData || !periodData.chartData) {
                    console.log('❌ 期間データも取得できませんでした');
                    return null;
                }
                
                // 最新のデータを前日として扱う
                const labels = periodData.chartData.labels;
                const yesterdayIndex = labels.length - 1;
                
                if (yesterdayIndex >= 0) {
                    const yesterdayData = {
                        spend: periodData.chartData.spend[yesterdayIndex] || 0,
                        budgetRate: this.calculateBudgetRate(periodData.chartData.spend[yesterdayIndex] || 0),
                        ctr: periodData.chartData.ctr[yesterdayIndex] || 0,
                        cpm: periodData.chartData.cpm[yesterdayIndex] || 0,
                        cpa: periodData.chartData.cpa[yesterdayIndex] || 0,
                        frequency: periodData.chartData.frequency[yesterdayIndex] || 0,
                        conversions: periodData.chartData.conversions[yesterdayIndex] || 0
                    };
                    
                    console.log('✅ フォールバック前日データ取得成功:', yesterdayData);
                    return yesterdayData;
                }
            } catch (fallbackError) {
                console.error('❌ フォールバック処理も失敗:', fallbackError.message);
            }
            
            return null;
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
                    // 通常モード：今日のアラートのみをフィルタリング
                    const today = new Date();
                    const todayStr = today.toISOString().split('T')[0];
                    
                    filteredAlerts = alertHistory.filter(alert => {
                        const alertDate = new Date(alert.timestamp);
                        const alertDateStr = alertDate.toISOString().split('T')[0];
                        return alertDateStr === todayStr && alert.status === 'active';
                    });
                    
                    console.log(`📊 今日のアラート数: ${filteredAlerts.length}件`);
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
https://meta-ads-dashboard.onrender.com/dashboard`;
            await this.sendMessage(fallbackMessage);
            return;
        }

        const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${(dashboardData.spend || 0).toLocaleString()}円
予算消化率（平均）：${dashboardData.budgetRate || '0.00'}%
CTR（平均）：${dashboardData.ctr || '0.00'}%
CPM（平均）：${(dashboardData.cpm || 0).toLocaleString()}円 
CPA（平均）：${(dashboardData.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${dashboardData.frequency || '0.00'}%
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
        
        // 重複送信チェック（テストモード時はスキップ）
        if (!isTestMode && !this.checkSentHistory('alert')) {
            console.log('⚠️ アラート通知は既に送信済みです');
            return;
        }
        
        const todayAlerts = this.getAlertHistory(isTestMode);
        if (todayAlerts.length === 0) {
            console.log('📝 今日のアラートはありません');
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

    // テスト送信（重複送信チェック無効）
    async sendTestMessage(type) {
        console.log(`🧪 テスト送信開始: ${type}`);
        
        // テスト送信時は重複送信チェックを一時的に無効化
        const originalCheckSentHistory = this.checkSentHistory;
        this.checkSentHistory = () => true; // 常にtrueを返す
        
        try {
            switch (type) {
                case 'daily':
                    await this.sendDailyReport();
                    break;
                case 'update':
                    await this.sendUpdateNotification();
                    break;
                case 'alert':
                    await this.sendAlertNotification(true);
                    break;
                case 'token':
                    await this.sendTokenUpdateNotification();
                    break;
                default:
                    console.log('❌ 不明なテストタイプ:', type);
            }
        } finally {
            // 重複送信チェック機能を復元
            this.checkSentHistory = originalCheckSentHistory;
        }
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