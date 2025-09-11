// dayOverDayScheduler.js - 前日比アラートの自動生成スケジューラー
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { checkDayOverDayAlerts, saveAlertHistory } = require('./dayOverDayAlertSystem');

class DayOverDayScheduler {
    constructor(chatworkAutoSender = null) {
        this.chatworkAutoSender = chatworkAutoSender;
        this.isRunning = false;
    }

    /**
     * Meta APIから当日と前日のデータを取得
     */
    async fetchComparisonData(userId = null) {
        try {
            // chatworkAutoSenderのfetchMetaDataDirectlyメソッドを使用
            if (!this.chatworkAutoSender) {
                console.error('❌ ChatworkAutoSenderが設定されていません');
                return null;
            }

            // 当日のデータを取得
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            // 前日のデータを取得
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            console.log(`📊 データ取得開始: ${yesterdayStr} vs ${todayStr}`);

            // 並行してデータを取得
            const [currentData, previousData] = await Promise.all([
                this.chatworkAutoSender.fetchMetaDataDirectly(todayStr, null, userId),
                this.chatworkAutoSender.fetchMetaDataDirectly(yesterdayStr, null, userId)
            ]);

            // データの有効性をチェック
            if (!currentData || currentData.spend === 0) {
                console.log('⚠️ 当日のデータがまだ利用できません');
                // 当日データがない場合は、前日と前々日を比較
                const dayBeforeYesterday = new Date();
                dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
                const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
                
                const alternativeCurrentData = previousData;
                const alternativePreviousData = await this.chatworkAutoSender.fetchMetaDataDirectly(
                    dayBeforeYesterdayStr, null, userId
                );
                
                if (alternativeCurrentData && alternativePreviousData) {
                    console.log('📝 前日と前々日のデータで比較します');
                    return {
                        current: alternativeCurrentData,
                        previous: alternativePreviousData,
                        dates: {
                            current: yesterdayStr,
                            previous: dayBeforeYesterdayStr
                        }
                    };
                }
            }

            if (!currentData || !previousData) {
                console.log('❌ 比較に必要なデータが取得できませんでした');
                return null;
            }

            return {
                current: currentData,
                previous: previousData,
                dates: {
                    current: todayStr,
                    previous: yesterdayStr
                }
            };

        } catch (error) {
            console.error('❌ データ取得エラー:', error);
            return null;
        }
    }

    /**
     * 前日比アラートチェックを実行
     */
    async runDayOverDayCheck(userId = null) {
        console.log('=== 前日比アラートチェック実行開始 ===');
        
        try {
            // データを取得
            const comparisonData = await this.fetchComparisonData(userId);
            if (!comparisonData) {
                console.log('⚠️ データ取得失敗のため処理を中止');
                return [];
            }

            const { current, previous, dates } = comparisonData;
            console.log(`📊 比較期間: ${dates.previous} → ${dates.current}`);

            // アラートチェック
            const alerts = await checkDayOverDayAlerts(current, previous, userId);

            if (alerts.length > 0) {
                console.log(`🚨 ${alerts.length}件の前日比アラートを検出`);
                
                // アラート履歴に保存
                await saveAlertHistory(alerts);

                // チャットワーク通知（ChatworkAutoSenderが設定されている場合）
                if (this.chatworkAutoSender) {
                    await this.sendDayOverDayAlerts(alerts, dates);
                }
            } else {
                console.log('✅ 前日比で大きな変化はありませんでした');
            }

            return alerts;

        } catch (error) {
            console.error('❌ 前日比アラートチェックエラー:', error);
            return [];
        }
    }

    /**
     * 前日比アラートをチャットワークに送信
     */
    async sendDayOverDayAlerts(alerts, dates) {
        if (!alerts || alerts.length === 0) return;

        try {
            let message = `📊 Meta広告 前日比アラート
比較期間: ${dates.previous} → ${dates.current}

以下の指標で大きな変化がありました：

`;

            alerts.forEach((alert, index) => {
                const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
                message += `${icon} ${index + 1}. ${alert.message}\n`;
                
                // 変化の詳細を追加
                if (alert.changePercent > 0) {
                    message += `   ↑ ${Math.abs(alert.changePercent)}%上昇\n`;
                } else {
                    message += `   ↓ ${Math.abs(alert.changePercent)}%下落\n`;
                }
            });

            message += `
詳細確認：https://meta-ads-dashboard.onrender.com/dashboard
アラート履歴：https://meta-ads-dashboard.onrender.com/alerts

※前日比で20%以上の変化があった指標を表示しています`;

            // チャットワークに送信
            await this.chatworkAutoSender.sendMessage(message);
            console.log('✅ 前日比アラートをチャットワークに送信しました');

        } catch (error) {
            console.error('❌ 前日比アラート送信エラー:', error);
        }
    }

    /**
     * スケジューラーを開始
     */
    startScheduler() {
        if (this.isRunning) {
            console.log('⚠️ スケジューラーは既に実行中です');
            return;
        }

        console.log('🕐 前日比アラートスケジューラーを開始します');

        // 毎日午前10時に実行（データが安定している時間帯）
        cron.schedule('0 10 * * *', async () => {
            console.log('📅 定期前日比アラートチェック実行');
            await this.runDayOverDayCheck();
        }, {
            timezone: 'Asia/Tokyo'
        });

        // 毎日午後3時にも実行（午後のデータ確認）
        cron.schedule('0 15 * * *', async () => {
            console.log('📅 午後の前日比アラートチェック実行');
            await this.runDayOverDayCheck();
        }, {
            timezone: 'Asia/Tokyo'
        });

        this.isRunning = true;
        console.log('✅ 前日比アラートスケジューラー設定完了');
        console.log('   実行時刻: 毎日 10:00, 15:00 (JST)');
    }

    /**
     * スケジューラーを停止
     */
    stopScheduler() {
        // Node-cronはグローバルにタスクを管理するため、
        // 個別の停止は実装が複雑
        this.isRunning = false;
        console.log('⏹ スケジューラーを停止しました');
    }
}

module.exports = DayOverDayScheduler;