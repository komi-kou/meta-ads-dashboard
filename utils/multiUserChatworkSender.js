const UserManager = require('../userManager');
const { sendChatworkMessage } = require('../chatworkApi');
const { fetchMetaAdDailyStats } = require('../metaApi');

class MultiUserChatworkSender {
    constructor() {
        this.userManager = new UserManager();
        this.sentHistory = new Map(); // メモリ内送信履歴
    }

    // 全ユーザーの設定を取得
    getAllActiveUsers() {
        return this.userManager.getAllActiveUsers();
    }

    // 送信履歴チェック（ユーザー別）
    checkUserSentHistory(userId, type, date = null) {
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        const key = `${userId}_${type}_${date || today}_${currentHour}`;
        
        if (this.sentHistory.has(key)) {
            console.log(`⚠️ ユーザー${userId}の${type}は既に送信済み: ${key}`);
            return false;
        }
        
        this.sentHistory.set(key, new Date().toISOString());
        console.log(`✅ ユーザー${userId}の${type}送信履歴を記録: ${key}`);
        return true;
    }

    // ユーザー別日次レポート送信
    async sendUserDailyReport(userSettings, isTestMode = false) {
        try {
            if (!userSettings.daily_report_enabled) {
                console.log(`ユーザー${userSettings.user_id}: 日次レポート無効`);
                return;
            }

            if (!isTestMode && !this.checkUserSentHistory(userSettings.user_id, 'daily')) {
                return;
            }

            console.log(`📅 ユーザー${userSettings.user_id}の日次レポート${isTestMode ? 'テスト' : ''}送信開始`);

            // ===== テストモード: 専用メソッドを呼び出し =====
            if (isTestMode) {
                console.log('🔀 テスト専用メソッドにリダイレクト');
                return this.sendTestDailyReport(userSettings);
            }

            // ===== 以下、通常モードのみ実行（テストモードは上でreturn） =====
            
            // 実際のMeta広告データを取得
            const metaData = await fetchMetaAdDailyStats({
                accessToken: userSettings.meta_access_token,
                accountId: userSettings.meta_account_id,
                datePreset: 'yesterday'
            });

            if (!metaData || metaData.length === 0) {
                console.log(`ユーザー${userSettings.user_id}: データなし`);
                return;
            }

            const data = metaData[0];
            const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000)
                .toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });

            // ユーザー別データベースに保存
            this.userManager.saveUserAdData(userSettings.user_id, data);

            // CTRとfrequencyの特別処理（文字列で%が含まれている場合の対応）
            const ctr = typeof data.ctr === 'string' && data.ctr.includes('%') 
                ? parseFloat(data.ctr) 
                : data.ctr;
            const frequency = typeof data.frequency === 'string' && data.frequency.includes('%')
                ? parseFloat(data.frequency)
                : data.frequency;

            // チャットワークメッセージを生成（数値を適切に丸める）
            const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${Math.round(data.spend || 0).toLocaleString()}円
予算消化率（平均）：${Math.round(data.budgetRate || 0)}%
CTR（平均）：${Math.round((ctr || 0) * 10) / 10}%
CPM（平均）：${Math.round(data.cpm || 0).toLocaleString()}円 
CPA（平均）：${Math.round(data.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${Math.round((frequency || 0) * 10) / 10}
コンバージョン数：${Math.round(data.conversions || 0)}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

            // チャットワークに送信
            await sendChatworkMessage({
                date: yesterdayStr,
                message: message,
                token: userSettings.chatwork_token,
                room_id: userSettings.chatwork_room_id
            });

            console.log(`✅ ユーザー${userSettings.user_id}の日次レポート送信完了`);

        } catch (error) {
            console.error(`❌ ユーザー${userSettings.user_id}の日次レポート送信エラー:`, error);
        }
    }

    // テスト専用日次レポート送信（完全に独立したメソッド）
    async sendTestDailyReport(userSettings) {
        try {
            console.log('📝 === テスト専用日次レポート送信開始 ===');
            console.log('テストデータのみ使用（Meta APIは呼びません）');
            
            // 固定のテストデータ（絶対に変更されない）
            const testData = {
                spend: 2206.789,
                budgetRate: 99.876543,
                ctr: 0.793651,
                cpm: 1946.208,
                cpa: 0,
                frequency: 1.3451957295373667,
                conversions: 0.25
            };
            
            const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000)
                .toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
            
            // メッセージ生成（確実にフォーマット）
            const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${Math.round(testData.spend).toLocaleString()}円
予算消化率（平均）：${Math.round(testData.budgetRate)}%
CTR（平均）：${Math.round(testData.ctr * 10) / 10}%
CPM（平均）：${Math.round(testData.cpm).toLocaleString()}円
CPA（平均）：${Math.round(testData.cpa).toLocaleString()}円
フリークエンシー（平均）：${Math.round(testData.frequency * 10) / 10}
コンバージョン数：${Math.round(testData.conversions)}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard

※これはテストメッセージです`;
            
            console.log('生成されたメッセージ:');
            console.log('CTR:', Math.round(testData.ctr * 10) / 10 + '%');
            console.log('CPM:', Math.round(testData.cpm).toLocaleString() + '円');
            console.log('フリークエンシー:', Math.round(testData.frequency * 10) / 10);
            
            // 送信
            await sendChatworkMessage({
                date: yesterdayStr,
                message: message,
                token: userSettings.chatwork_token || 'dummy_test_token',
                room_id: userSettings.chatwork_room_id || 'dummy_test_room'
            });
            
            console.log('✅ テスト日次レポート送信完了');
            return { success: true, message: 'テスト日次レポート送信完了' };
            
        } catch (error) {
            console.error('❌ テスト日次レポート送信エラー:', error);
            return { success: false, error: error.message };
        }
    }

    // ユーザー別定期更新通知送信
    async sendUserUpdateNotification(userSettings, isTestMode = false) {
        try {
            if (!userSettings.update_notifications_enabled) {
                console.log(`ユーザー${userSettings.user_id}: 定期更新通知無効`);
                return;
            }

            if (!isTestMode && !this.checkUserSentHistory(userSettings.user_id, 'update')) {
                return;
            }

            console.log(`🔄 ユーザー${userSettings.user_id}の定期更新通知${isTestMode ? 'テスト' : ''}送信開始`);

            let message = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

            if (isTestMode) {
                message += '\n\n※これはテストメッセージです';
            }

            await sendChatworkMessage({
                date: new Date().toISOString().split('T')[0],
                message: message,
                token: userSettings.chatwork_token,
                room_id: userSettings.chatwork_room_id
            });

            console.log(`✅ ユーザー${userSettings.user_id}の定期更新通知送信完了`);

        } catch (error) {
            console.error(`❌ ユーザー${userSettings.user_id}の定期更新通知送信エラー:`, error);
        }
    }

    // ユーザー別アラート通知送信
    async sendUserAlertNotification(userSettings, isTestMode = false) {
        try {
            if (!userSettings.alert_notifications_enabled) {
                console.log(`ユーザー${userSettings.user_id}: アラート通知無効`);
                return;
            }

            if (!isTestMode && !this.checkUserSentHistory(userSettings.user_id, 'alert')) {
                return;
            }

            console.log(`🚨 ユーザー${userSettings.user_id}のアラート通知チェック開始`);

            let activeAlerts = [];
            
            if (isTestMode) {
                // テストモード: サンプルアラートを生成
                console.log('📝 テストモード: サンプルアラートを生成');
                activeAlerts = [
                    {
                        metric: 'CTR',
                        targetValue: 1.0,
                        currentValue: 0.8,
                        severity: 'warning',
                        timestamp: new Date().toISOString(),
                        status: 'active'
                    },
                    {
                        metric: 'CPM',
                        targetValue: 1800,
                        currentValue: 2100,
                        severity: 'warning',
                        timestamp: new Date().toISOString(),
                        status: 'active'
                    },
                    {
                        metric: 'CV',
                        targetValue: 1,
                        currentValue: 0,
                        severity: 'critical',
                        timestamp: new Date().toISOString(),
                        status: 'active'
                    },
                    {
                        metric: 'budget_rate',
                        targetValue: 80,
                        currentValue: 95,
                        severity: 'critical',
                        timestamp: new Date().toISOString(),
                        status: 'active'
                    }
                ];
            } else {
                // 通常モード: 改善施策2: アラート履歴から最新データを取得
                const { getAlertHistory } = require('../alertSystem');
                const alertHistory = await getAlertHistory(userSettings.user_id);
                
                // アクティブなアラートのみ抽出
                activeAlerts = alertHistory.filter(alert => alert.status === 'active');
                
                if (activeAlerts.length === 0) {
                    console.log(`ユーザー${userSettings.user_id}: アクティブなアラートなし`);
                    return;
                }
            }

            // 強化版: 完全な重複排除（メトリック + 目標値 + 現在値でユニーク）
            const seenKeys = new Set();
            const uniqueAlerts = [];
            
            console.log(`📊 重複排除開始: ${activeAlerts.length}件のアラート`);
            
            activeAlerts
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // 新しい順にソート
                .forEach(alert => {
                    // ユニークキーを作成（メトリック + 目標値 + 現在値）
                    const uniqueKey = `${alert.metric}_${alert.targetValue}_${alert.currentValue}`;
                    
                    if (!seenKeys.has(uniqueKey)) {
                        seenKeys.add(uniqueKey);
                        uniqueAlerts.push(alert);
                        console.log(`  ✅ 追加: ${alert.metric} (目標:${alert.targetValue}, 実績:${alert.currentValue})`);
                    } else {
                        console.log(`  ⚠️ 重複スキップ: ${alert.metric}`);
                    }
                });
            
            console.log(`ユーザー${userSettings.user_id}: 重複排除完了 ${activeAlerts.length}件 → ${uniqueAlerts.length}件`);
            
            if (uniqueAlerts.length === 0) {
                console.log(`ユーザー${userSettings.user_id}: 重複排除後のアラートなし`);
                return;
            }

            // 値のフォーマット用関数（適切な桁数に丸める）
            const formatValue = (value, metric) => {
                switch (metric.toLowerCase()) {
                    case 'ctr':
                    case 'cvr':
                        // CTR、CVRは小数点第1位まで表示（例: 0.899888 → 0.9）
                        return `${Math.round(value * 10) / 10}%`;
                    case 'budget_rate':
                    case '予算消化率':
                        // 予算消化率は整数表示（例: 62.178 → 62）
                        return `${Math.round(value)}%`;
                    case 'conversions':
                    case 'cv':
                        return `${Math.round(value)}件`;
                    case 'cpa':
                    case 'cpm':
                    case 'cpc':
                        // 整数に丸めてカンマ区切り（例: 1926.884 → 1,927）
                        return `${Math.round(value).toLocaleString('ja-JP')}円`;
                    default:
                        return value.toString();
                }
            };

            // メトリクス表示名取得
            const getMetricDisplayName = (metric) => {
                const names = {
                    'budget_rate': '予算消化率',
                    'ctr': 'CTR',
                    'conversions': 'CV',
                    'cv': 'CV',
                    'cpm': 'CPM',
                    'cpa': 'CPA',
                    'cvr': 'CVR',
                    'cpc': 'CPC'
                };
                return names[metric.toLowerCase()] || metric;
            };

            // アラートメッセージを構築
            const dateStr = new Date().toLocaleDateString('ja-JP');
            let message = `[info][title]Meta広告 アラート通知 (${dateStr})[/title]\n`;
            message += `以下の指標が目標値から外れています：\n\n`;

            // 重要度順にソート（重複排除後のアラートを使用）
            const sortedAlerts = uniqueAlerts.sort((a, b) => {
                if (a.severity === 'critical' && b.severity !== 'critical') return -1;
                if (a.severity !== 'critical' && b.severity === 'critical') return 1;
                // 同じ重要度の場合はメトリック順
                const metricOrder = ['CV', 'CTR', 'CPM', 'CPA', '予算消化率'];
                return metricOrder.indexOf(a.metric) - metricOrder.indexOf(b.metric);
            });

            // 全てのユニークなアラートを表示（最大10件制限を撤廃または維持）
            sortedAlerts.forEach((alert, index) => {
                const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
                const metricName = getMetricDisplayName(alert.metric);
                message += `${icon} ${metricName}: `;
                message += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
                message += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
            });

            // 10件を超える場合の表示は不要（重複排除後は通常10件以下）
            // if (sortedAlerts.length > 10) {
            //     message += `\n...他${sortedAlerts.length - 10}件のアラート\n`;
            // }

            message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
            message += `https://meta-ads-dashboard.onrender.com/dashboard\n\n`;
            message += `✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks\n`;
            message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies`;
            
            // テストモードの場合は表記を追加
            if (isTestMode) {
                message += `\n\n※これはテストメッセージです`;
            }
            
            message += `[/info]`;

            await sendChatworkMessage({
                date: new Date().toISOString().split('T')[0],
                message: message,
                token: userSettings.chatwork_token,
                room_id: userSettings.chatwork_room_id
            });

            console.log(`✅ ユーザー${userSettings.user_id}のアラート通知送信完了（${activeAlerts.length}件のアラート）`);

        } catch (error) {
            console.error(`❌ ユーザー${userSettings.user_id}のアラート通知送信エラー:`, error);
        }
    }

    // ユーザー別トークン更新通知送信（テスト用）
    async sendUserTokenUpdateNotification(userSettings) {
        try {
            console.log(`🔑 ユーザー${userSettings.user_id}のトークン更新通知テスト送信開始`);

            const message = `[info][title]Meta API アクセストークン更新通知[/title]
    
⚠️ アクセストークンの有効期限が近づいています

更新手順:
1. Meta for Developersにアクセス
   https://developers.facebook.com/tools/explorer/

2. 長期アクセストークンを生成
   https://developers.facebook.com/tools/debug/accesstoken/

3. ダッシュボード設定画面で更新
   https://meta-ads-dashboard.onrender.com/setup

※これはテスト通知です[/info]`;

            await sendChatworkMessage({
                date: new Date().toISOString().split('T')[0],
                message: message,
                token: userSettings.chatwork_token,
                room_id: userSettings.chatwork_room_id
            });

            console.log(`✅ ユーザー${userSettings.user_id}のトークン更新通知テスト送信完了`);

        } catch (error) {
            console.error(`❌ ユーザー${userSettings.user_id}のトークン更新通知テスト送信エラー:`, error);
        }
    }

    // 全ユーザーに日次レポート送信
    async sendDailyReportToAllUsers() {
        try {
            const activeUsers = this.getAllActiveUsers();
            console.log(`📅 ${activeUsers.length}人のユーザーに日次レポート送信開始`);

            for (const user of activeUsers) {
                await this.sendUserDailyReport(user);
                // 送信間隔を空ける（レート制限対策）
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('✅ 全ユーザーの日次レポート送信完了');
        } catch (error) {
            console.error('❌ 日次レポート一括送信エラー:', error);
        }
    }

    // 全ユーザーに定期更新通知送信
    async sendUpdateNotificationToAllUsers() {
        try {
            const activeUsers = this.getAllActiveUsers();
            console.log(`🔄 ${activeUsers.length}人のユーザーに定期更新通知送信開始`);

            for (const user of activeUsers) {
                await this.sendUserUpdateNotification(user);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('✅ 全ユーザーの定期更新通知送信完了');
        } catch (error) {
            console.error('❌ 定期更新通知一括送信エラー:', error);
        }
    }

    // 全ユーザーにアラート通知送信
    async sendAlertNotificationToAllUsers() {
        try {
            const activeUsers = this.getAllActiveUsers();
            console.log(`🚨 ${activeUsers.length}人のユーザーにアラート通知送信開始`);

            for (const user of activeUsers) {
                await this.sendUserAlertNotification(user);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            console.log('✅ 全ユーザーのアラート通知送信完了');
        } catch (error) {
            console.error('❌ アラート通知一括送信エラー:', error);
        }
    }

}

module.exports = MultiUserChatworkSender;