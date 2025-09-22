// alertSystemExtensions.js - アラートシステム拡張機能
const fs = require('fs');
const path = require('path');
const { sendChatworkMessage } = require('./chatworkApi');

// 送信履歴管理（ファイルベース）
const SENT_HISTORY_FILE = path.join(__dirname, 'sent_history.json');

function checkSentHistory(type) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const key = `${type}_${today}_${hour}`;
        
        if (fs.existsSync(SENT_HISTORY_FILE)) {
            const history = JSON.parse(fs.readFileSync(SENT_HISTORY_FILE, 'utf8'));
            if (history[key]) {
                console.log(`⚠️ ${type}は既に送信済み: ${key}`);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('送信履歴チェックエラー:', error);
        return true; // エラー時は送信を許可
    }
}

function recordSentHistory(type) {
    try {
        const today = new Date().toISOString().split('T')[0];
        const hour = new Date().getHours();
        const key = `${type}_${today}_${hour}`;
        
        let history = {};
        if (fs.existsSync(SENT_HISTORY_FILE)) {
            history = JSON.parse(fs.readFileSync(SENT_HISTORY_FILE, 'utf8'));
        }
        
        history[key] = new Date().toISOString();
        
        // 30日以上古いエントリを削除
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        
        Object.keys(history).forEach(k => {
            const dateStr = k.split('_')[1];
            if (dateStr < cutoffStr) {
                delete history[k];
            }
        });
        
        fs.writeFileSync(SENT_HISTORY_FILE, JSON.stringify(history, null, 2));
        console.log(`✅ ${type}送信履歴を記録: ${key}`);
        
    } catch (error) {
        console.error('送信履歴記録エラー:', error);
    }
}

// 直接アラート送信（MultiUserChatworkSenderを経由しない）
async function sendAlertsDirectly(alerts, userSettings) {
    try {
        if (!userSettings.chatwork_token || !userSettings.chatwork_room_id) {
            console.log('チャットワーク設定が不完全です');
            return;
        }

        // 値のフォーマット用関数
        const formatValue = (value, metric) => {
            switch (metric.toLowerCase()) {
                case 'ctr':
                case 'cvr':
                    return `${Math.round(value * 10) / 10}%`;
                case 'budget_rate':
                case '予算消化率':
                    return `${Math.round(value)}%`;
                case 'conversions':
                case 'cv':
                    return `${Math.round(value)}件`;
                case 'cpa':
                case 'cpm':
                case 'cpc':
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

        // メッセージ構築
        const dateStr = new Date().toLocaleDateString('ja-JP');
        let message = `[info][title]Meta広告 アラート通知 (${dateStr})[/title]\n`;
        message += `以下の指標が目標値から外れています：\n\n`;

        // アラート表示
        alerts.forEach(alert => {
            const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
            const metricName = getMetricDisplayName(alert.metric);
            message += `${icon} ${metricName}: `;
            message += `目標 ${formatValue(alert.targetValue, alert.metric)} → `;
            message += `実績 ${formatValue(alert.currentValue, alert.metric)}\n`;
        });

        message += `\n📊 詳細はダッシュボードでご確認ください：\n`;
        message += `https://meta-ads-dashboard.onrender.com/dashboard\n\n`;
        message += `✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks\n`;
        message += `💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies`;
        message += `[/info]`;

        // チャットワーク送信
        await sendChatworkMessage({
            date: dateStr,
            message: message,
            token: userSettings.chatwork_token,
            room_id: userSettings.chatwork_room_id
        });

        console.log(`✅ ユーザー${userSettings.user_id}のアラート通知送信完了`);

    } catch (error) {
        console.error('アラート送信エラー:', error);
    }
}

module.exports = {
    checkSentHistory,
    recordSentHistory,
    sendAlertsDirectly
};