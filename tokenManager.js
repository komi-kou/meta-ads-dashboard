// tokenManager.js - トークン管理用のダミーファイル
// 本来の機能はutils/tokenManager.jsに移動済み

module.exports = {
    checkTokenExpiry: async function() {
        return {
            shouldNotify: false,
            reason: 'Token check skipped (dummy implementation)'
        };
    },
    markNotificationSent: async function() {
        return true;
    }
};