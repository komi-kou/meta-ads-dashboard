// グローバル重複排除マネージャー
// 全システム共通でアラートの重複を防ぐ

class GlobalDeduplicationManager {
    constructor() {
        // メトリック名と時間帯でユニーク管理
        this.sentAlerts = new Map();
        
        // 古いエントリーの自動削除（24時間後）
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 3600000); // 1時間ごとにクリーンアップ
    }
    
    /**
     * アラートが送信済みかチェック
     * @param {string} metric - メトリック名（CTR, CPM, CV等）
     * @param {string} userId - ユーザーID（省略可能）
     * @returns {boolean} true: 送信済み, false: 未送信
     */
    isAlreadySent(metric, userId = 'GLOBAL') {
        const now = new Date();
        const hour = now.getHours();
        const dateKey = now.toISOString().split('T')[0];
        
        // ユニークキー: 日付_時間_メトリック
        // ユーザーIDは含めない（全ユーザー共通で重複排除）
        const uniqueKey = `${dateKey}_${hour}_${metric}`;
        
        if (this.sentAlerts.has(uniqueKey)) {
            const sentTime = this.sentAlerts.get(uniqueKey);
            const timeDiff = now - sentTime;
            
            // 1時間以内に送信済みの場合は重複とみなす
            if (timeDiff < 3600000) {
                console.log(`[GlobalDedup] アラート重複検出: ${metric} (${Math.floor(timeDiff/60000)}分前に送信済み)`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * アラート送信を記録
     * @param {string} metric - メトリック名
     * @param {string} userId - ユーザーID（省略可能）
     */
    markAsSent(metric, userId = 'GLOBAL') {
        const now = new Date();
        const hour = now.getHours();
        const dateKey = now.toISOString().split('T')[0];
        
        const uniqueKey = `${dateKey}_${hour}_${metric}`;
        this.sentAlerts.set(uniqueKey, now);
        
        console.log(`[GlobalDedup] アラート送信記録: ${metric}`);
    }
    
    /**
     * 複数のアラートから重複を除外
     * @param {Array} alerts - アラート配列
     * @returns {Array} 重複を除外したアラート配列
     */
        /**
     * 複数のアラートから重複を除外（改善版）
     * @param {Array} alerts - アラート配列
     * @param {string} userId - ユーザーID
     * @returns {Array} 重複を除外したアラート配列
     */
    filterDuplicates(alerts, userId = null) {
        if (!alerts || alerts.length === 0) return alerts;
        
        const filtered = [];
        const metricsSeen = new Set();
        const messagesSeen = new Set();
        
        for (const alert of alerts) {
            const metric = alert.metric || alert.type || alert.name;
            const message = alert.message || '';
            
            // メトリックとメッセージの組み合わせで重複チェック
            const uniqueKey = `${metric}_${message}`;
            
            // 同一バッチ内での重複チェック
            if (metricsSeen.has(metric) || messagesSeen.has(uniqueKey)) {
                console.log(`[GlobalDedup] バッチ内重複スキップ: ${metric}`);
                continue;
            }
            
            // グローバル履歴での重複チェック
            if (this.isAlreadySent(metric, userId)) {
                console.log(`[GlobalDedup] 履歴重複スキップ: ${metric}`);
                continue;
            }
            
            metricsSeen.add(metric);
            messagesSeen.add(uniqueKey);
            filtered.push(alert);
        }
        
        console.log(`[GlobalDedup] 重複排除結果: ${alerts.length}件 → ${filtered.length}件`);
        return filtered;
    }
    
    /**
     * 古いエントリーをクリーンアップ
     */
    cleanup() {
        const now = new Date();
        const oneDayAgo = 24 * 3600000; // 24時間
        
        let cleanedCount = 0;
        for (const [key, time] of this.sentAlerts.entries()) {
            if (now - time > oneDayAgo) {
                this.sentAlerts.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[GlobalDedup] ${cleanedCount}件の古いエントリーを削除`);
        }
    }
    
    /**
     * 状態をリセット（テスト用）
     */
    reset() {
        this.sentAlerts.clear();
        console.log('[GlobalDedup] 履歴をリセットしました');
    }
    
    /**
     * 現在の状態を取得
     */
    getStatus() {
        return {
            totalEntries: this.sentAlerts.size,
            entries: Array.from(this.sentAlerts.entries()).map(([key, time]) => ({
                key,
                sentAt: time.toISOString()
            }))
        };
    }
}

// シングルトンインスタンス
const globalDeduplication = new GlobalDeduplicationManager();

module.exports = globalDeduplication;