// 環境変数による制御を行うロガー
const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
    log: function(userId, message, data = null) {
        if (isDevelopment) {
            const prefix = userId ? `[${userId}]` : '[SYSTEM]';
            console.log(`${prefix} ${message}`, data || '');
        }
    },
    
    error: function(userId, message, error = null) {
        // エラーは常に出力
        const prefix = userId ? `[ERROR][${userId}]` : '[ERROR][SYSTEM]';
        console.error(`${prefix} ${message}`, error || '');
    },
    
    warn: function(userId, message, data = null) {
        if (isDevelopment) {
            const prefix = userId ? `[WARN][${userId}]` : '[WARN][SYSTEM]';
            console.warn(`${prefix} ${message}`, data || '');
        }
    },
    
    // 既存のconsole.logとの互換性のため
    simple: function(message) {
        if (isDevelopment) {
            console.log(message);
        }
    }
};

module.exports = logger;