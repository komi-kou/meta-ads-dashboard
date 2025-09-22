// 重複実行防止マネージャー
class ExecutionManager {
    constructor() {
        this.runningTasks = new Map();
        this.completedTasks = new Map();
    }
    
    /**
     * タスクの実行を管理
     * @param {string} userId - ユーザーID
     * @param {string} taskId - タスクID
     * @param {Function} taskFunction - 実行する関数
     * @returns {Promise} 実行結果
     */
    async executeTask(userId, taskId, taskFunction) {
        const now = new Date();
        const hour = now.getHours();
        const dateKey = now.toISOString().split('T')[0];
        const uniqueKey = `${userId}_${taskId}_${dateKey}_${hour}`;
        
        // 既に実行中かチェック
        if (this.runningTasks.get(uniqueKey)) {
            console.log(`[ExecutionManager] タスク ${uniqueKey} は既に実行中です`);
            return { skipped: true, reason: 'already_running' };
        }
        
        // 1時間以内に完了済みかチェック
        const completedTime = this.completedTasks.get(uniqueKey);
        if (completedTime) {
            const timeDiff = now - completedTime;
            if (timeDiff < 3600000) { // 1時間 = 3600000ms
                console.log(`[ExecutionManager] タスク ${uniqueKey} は既に完了済みです`);
                return { skipped: true, reason: 'already_completed', completedAt: completedTime };
            }
        }
        
        // 実行開始
        this.runningTasks.set(uniqueKey, true);
        console.log(`[ExecutionManager] タスク ${uniqueKey} 実行開始`);
        
        try {
            const result = await taskFunction();
            this.completedTasks.set(uniqueKey, now);
            console.log(`[ExecutionManager] タスク ${uniqueKey} 正常完了`);
            return { success: true, result };
        } catch (error) {
            console.error(`[ExecutionManager] タスク ${uniqueKey} エラー:`, error);
            return { success: false, error: error.message };
        } finally {
            this.runningTasks.delete(uniqueKey);
        }
    }
    
    /**
     * 全ユーザー向けタスクの実行管理（ユーザーIDなし）
     */
    async executeGlobalTask(taskId, taskFunction) {
        return this.executeTask('GLOBAL', taskId, taskFunction);
    }
    
    /**
     * 実行状態を取得
     */
    getStatus() {
        const status = {
            running: [],
            completed: []
        };
        
        this.runningTasks.forEach((value, key) => {
            if (value) status.running.push(key);
        });
        
        this.completedTasks.forEach((time, key) => {
            status.completed.push({ task: key, completedAt: time });
        });
        
        return status;
    }
    
    /**
     * 古い完了タスクをクリーンアップ（24時間以上経過）
     */
    cleanup() {
        const now = new Date();
        const oneDayAgo = 24 * 3600000; // 24時間
        
        this.completedTasks.forEach((time, key) => {
            if (now - time > oneDayAgo) {
                this.completedTasks.delete(key);
            }
        });
    }
}

// シングルトンインスタンス
const executionManager = new ExecutionManager();

module.exports = executionManager;