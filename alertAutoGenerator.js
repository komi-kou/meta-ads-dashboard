// alertAutoGenerator.js - アラート自動生成システム
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

class AlertAutoGenerator {
    constructor() {
        this.alertHistoryPath = path.join(__dirname, 'alert_history.json');
        this.isRunning = false;
        this.maxHistoryDays = 30; // 30日以上古いアラートは自動削除
    }

    /**
     * アラート履歴を読み込み
     */
    loadAlertHistory() {
        try {
            if (fs.existsSync(this.alertHistoryPath)) {
                return JSON.parse(fs.readFileSync(this.alertHistoryPath, 'utf8'));
            }
        } catch (error) {
            console.error('アラート履歴読み込みエラー:', error);
        }
        return [];
    }

    /**
     * アラート履歴を保存（重複チェック付き）
     */
    saveAlertHistory(newAlerts) {
        try {
            let history = this.loadAlertHistory();
            
            // 古いアクティブアラートをresolvedに変更
            const now = new Date();
            history.forEach(alert => {
                if (alert.status === 'active') {
                    // 同じメトリクスの新しいアラートがある場合は解決済みに
                    const hasNewAlert = newAlerts.some(newAlert => 
                        newAlert.metric === alert.metric && 
                        newAlert.userId === alert.userId
                    );
                    if (hasNewAlert) {
                        alert.status = 'resolved';
                        alert.resolvedAt = now.toISOString();
                        console.log(`📝 既存アラート解決済みに変更: ${alert.metric}`);
                    }
                }
            });

            // 重複チェック：同じID/メトリクス/ユーザーのアラートは追加しない
            const addedAlerts = [];
            newAlerts.forEach(newAlert => {
                const isDuplicate = history.some(existingAlert => 
                    existingAlert.id === newAlert.id ||
                    (existingAlert.metric === newAlert.metric && 
                     existingAlert.userId === newAlert.userId &&
                     existingAlert.status === 'active' &&
                     this.isSameDay(existingAlert.timestamp, newAlert.timestamp))
                );

                if (!isDuplicate) {
                    addedAlerts.push(newAlert);
                    console.log(`✅ 新規アラート追加: ${newAlert.metric}`);
                } else {
                    console.log(`⚠️ 重複アラートスキップ: ${newAlert.metric}`);
                }
            });

            // 新規アラートを追加
            history.push(...addedAlerts);

            // 古いアラートをクリーンアップ
            history = this.cleanupOldAlerts(history);

            // 保存
            fs.writeFileSync(this.alertHistoryPath, JSON.stringify(history, null, 2));
            console.log(`✅ アラート履歴保存完了: 総数${history.length}件`);

            return addedAlerts.length;
        } catch (error) {
            console.error('アラート履歴保存エラー:', error);
            return 0;
        }
    }

    /**
     * 同じ日かチェック
     */
    isSameDay(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return d1.toDateString() === d2.toDateString();
    }

    /**
     * 古いアラートをクリーンアップ
     */
    cleanupOldAlerts(history) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.maxHistoryDays);

        const cleanedHistory = history.filter(alert => {
            const alertDate = new Date(alert.timestamp || alert.triggeredAt);
            return alertDate > cutoffDate;
        });

        const removedCount = history.length - cleanedHistory.length;
        if (removedCount > 0) {
            console.log(`🗑️ ${removedCount}件の古いアラートを削除`);
        }

        return cleanedHistory;
    }

    /**
     * 全ユーザーのアラートを生成
     */
    async generateAllUserAlerts() {
        console.log('=== アラート自動生成開始 ===');
        
        try {
            const { checkUserAlerts } = require('./alertSystem');
            const UserManager = require('./userManager');
            const userManager = new UserManager();
            
            const allNewAlerts = [];
            
            // アクティブユーザーを取得
            const activeUsers = userManager.getAllActiveUsers();
            console.log(`📊 アクティブユーザー数: ${activeUsers.length}`);

            // 各ユーザーのアラートをチェック
            for (const user of activeUsers) {
                try {
                    console.log(`👤 ユーザー ${user.user_id} のアラートチェック中...`);
                    const userAlerts = await checkUserAlerts(user.user_id);
                    
                    if (userAlerts && userAlerts.length > 0) {
                        console.log(`  → ${userAlerts.length}件のアラート検出`);
                        allNewAlerts.push(...userAlerts);
                    } else {
                        console.log(`  → アラートなし`);
                    }
                } catch (error) {
                    console.error(`  ❌ ユーザー ${user.user_id} のチェックエラー:`, error.message);
                }
            }

            // デフォルトユーザーも確認
            try {
                console.log(`👤 デフォルトユーザーのアラートチェック中...`);
                const defaultAlerts = await checkUserAlerts('test@example.com');
                if (defaultAlerts && defaultAlerts.length > 0) {
                    console.log(`  → ${defaultAlerts.length}件のアラート検出`);
                    allNewAlerts.push(...defaultAlerts);
                }
            } catch (error) {
                console.error('  ❌ デフォルトユーザーのチェックエラー:', error.message);
            }

            // アラートを保存
            if (allNewAlerts.length > 0) {
                const savedCount = this.saveAlertHistory(allNewAlerts);
                console.log(`🚨 ${savedCount}件の新規アラートを保存`);
                
                // チャットワーク通知（必要に応じて）
                await this.notifyNewAlerts(allNewAlerts);
            } else {
                console.log('✅ 新規アラートなし');
            }

            console.log('=== アラート自動生成完了 ===\n');
            return allNewAlerts;

        } catch (error) {
            console.error('❌ アラート自動生成エラー:', error);
            return [];
        }
    }

    /**
     * 新規アラートの通知
     */
    async notifyNewAlerts(alerts) {
        // チャットワーク通知が必要な場合はここで実装
        // 既存のChatworkAutoSenderを使用可能
        console.log(`📢 ${alerts.length}件の新規アラートが生成されました`);
    }

    /**
     * スケジューラーを開始
     */
    startScheduler() {
        if (this.isRunning) {
            console.log('⚠️ アラート自動生成スケジューラーは既に実行中です');
            return;
        }

        console.log('🕐 アラート自動生成スケジューラーを開始します');

        // 毎日9時、12時、15時、17時、19時に実行
        cron.schedule('0 9,12,15,17,19 * * *', async () => {
            console.log('📅 定期アラート生成実行');
            await this.generateAllUserAlerts();
        }, {
            timezone: 'Asia/Tokyo'
        });

        this.isRunning = true;
        console.log('✅ アラート自動生成スケジューラー設定完了');
        console.log('   実行時刻: 毎日 9:00, 12:00, 15:00, 17:00, 19:00 (JST)');
    }

    /**
     * 手動実行（テスト用）
     */
    async runManual() {
        console.log('🔧 アラート生成を手動実行します');
        return await this.generateAllUserAlerts();
    }
}

module.exports = AlertAutoGenerator;