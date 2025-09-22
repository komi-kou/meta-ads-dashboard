// executionManager.js - タスク実行の重複防止管理
const fs = require('fs');
const path = require('path');

class ExecutionManager {
    constructor() {
        this.executionLog = new Map();
        this.executionFile = path.join(__dirname, '..', 'execution_log.json');
        this.loadExecutionLog();
    }

    // 実行ログをファイルから読み込み
    loadExecutionLog() {
        try {
            if (fs.existsSync(this.executionFile)) {
                const data = JSON.parse(fs.readFileSync(this.executionFile, 'utf8'));
                this.executionLog = new Map(Object.entries(data));
            }
        } catch (error) {
            console.error('実行ログ読み込みエラー:', error);
        }
    }

    // 実行ログをファイルに保存
    saveExecutionLog() {
        try {
            const data = Object.fromEntries(this.executionLog);
            fs.writeFileSync(this.executionFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('実行ログ保存エラー:', error);
        }
    }

    // タスクの実行可能性をチェック
    canExecute(taskId, intervalMinutes = 55) {
        const now = Date.now();
        const lastExecution = this.executionLog.get(taskId);
        
        if (!lastExecution) {
            return true;
        }
        
        const timeDiff = now - lastExecution;
        const intervalMs = intervalMinutes * 60 * 1000;
        
        return timeDiff >= intervalMs;
    }

    // タスク実行を記録
    recordExecution(taskId) {
        this.executionLog.set(taskId, Date.now());
        this.saveExecutionLog();
    }

    // グローバルタスクの実行
    async executeGlobalTask(taskId, taskFunction, intervalMinutes = 55) {
        if (!this.canExecute(taskId, intervalMinutes)) {
            console.log(`⚠️ タスク ${taskId} は既に実行済みです（${intervalMinutes}分以内）`);
            return null;
        }
        
        try {
            console.log(`▶️ タスク ${taskId} を実行開始`);
            const result = await taskFunction();
            this.recordExecution(taskId);
            console.log(`✅ タスク ${taskId} 実行完了`);
            return result;
        } catch (error) {
            console.error(`❌ タスク ${taskId} 実行エラー:`, error);
            throw error;
        }
    }

    // 古いログをクリーンアップ
    cleanup(daysToKeep = 7) {
        const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        const keysToDelete = [];
        
        this.executionLog.forEach((timestamp, key) => {
            if (timestamp < cutoffTime) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => {
            this.executionLog.delete(key);
        });
        
        if (keysToDelete.length > 0) {
            this.saveExecutionLog();
            console.log(`🧹 ${keysToDelete.length}件の古い実行ログを削除`);
        }
    }
}

module.exports = new ExecutionManager();