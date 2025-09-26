// URL生成ヘルパー
module.exports = {
    generateDashboardUrl: function(userId = '') {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3457';
        return `${baseUrl}/dashboard`;
    },
    
    generateAlertUrl: function(userId = '') {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3457';
        return `${baseUrl}/alerts`;
    }
};