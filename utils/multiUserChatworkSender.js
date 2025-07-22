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
    async sendUserDailyReport(userSettings) {
        try {
            if (!userSettings.daily_report_enabled) {
                console.log(`ユーザー${userSettings.user_id}: 日次レポート無効`);
                return;
            }

            if (!this.checkUserSentHistory(userSettings.user_id, 'daily')) {
                return;
            }

            console.log(`📅 ユーザー${userSettings.user_id}の日次レポート送信開始`);

            // ユーザーのMeta広告データを取得
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

            // チャットワークメッセージを生成
            const message = `Meta広告 日次レポート (${yesterdayStr})

消化金額（合計）：${(data.spend || 0).toLocaleString()}円
予算消化率（平均）：${data.budgetRate || '0.00'}%
CTR（平均）：${data.ctr || '0.00'}%
CPM（平均）：${(data.cpm || 0).toLocaleString()}円 
CPA（平均）：${(data.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${data.frequency || '0.00'}%
コンバージョン数：${data.conversions || 0}件  

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

    // ユーザー別定期更新通知送信
    async sendUserUpdateNotification(userSettings) {
        try {
            if (!userSettings.update_notifications_enabled) {
                console.log(`ユーザー${userSettings.user_id}: 定期更新通知無効`);
                return;
            }

            if (!this.checkUserSentHistory(userSettings.user_id, 'update')) {
                return;
            }

            console.log(`🔄 ユーザー${userSettings.user_id}の定期更新通知送信開始`);

            const message = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

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
    async sendUserAlertNotification(userSettings) {
        try {
            if (!userSettings.alert_notifications_enabled) {
                console.log(`ユーザー${userSettings.user_id}: アラート通知無効`);
                return;
            }

            if (!this.checkUserSentHistory(userSettings.user_id, 'alert')) {
                return;
            }

            console.log(`🚨 ユーザー${userSettings.user_id}のアラート通知チェック開始`);

            // ユーザーの最新データを取得してアラートチェック
            const userAdData = this.userManager.getUserAdData(userSettings.user_id, 3);
            
            if (userAdData.length === 0) {
                console.log(`ユーザー${userSettings.user_id}: アラートチェック用データなし`);
                return;
            }

            // 簡易アラートチェック（実際のロジックは既存のものを流用）
            const alerts = [];
            const latestData = userAdData[0];

            // 予算消化率チェック
            if (latestData.budget_rate > 100) {
                alerts.push('予算超過が発生しています');
            }

            // CPAチェック
            if (userSettings.target_cpa && latestData.cpa > userSettings.target_cpa * 1.2) {
                alerts.push(`CPA目標値を20%超過: ${latestData.cpa}円 (目標: ${userSettings.target_cpa}円)`);
            }

            if (alerts.length === 0) {
                console.log(`ユーザー${userSettings.user_id}: アラートなし`);
                return;
            }

            const message = `Meta広告 アラート通知 (${new Date().toLocaleDateString('ja-JP')})
以下のアラートが発生しています：

${alerts.map((alert, index) => `${index + 1}. ${alert}`).join('\n')}

確認事項：https://meta-ads-dashboard.onrender.com/improvement-taskss
改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategiess
ダッシュボード：https://meta-ads-dashboard.onrender.com/dashboard`;

            await sendChatworkMessage({
                date: new Date().toISOString().split('T')[0],
                message: message,
                token: userSettings.chatwork_token,
                room_id: userSettings.chatwork_room_id
            });

            console.log(`✅ ユーザー${userSettings.user_id}のアラート通知送信完了`);

        } catch (error) {
            console.error(`❌ ユーザー${userSettings.user_id}のアラート通知送信エラー:`, error);
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