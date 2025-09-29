// URL生成ヘルパー
module.exports = {
    generateDashboardUrl: function(userId = '') {
        const baseUrl = process.env.BASE_URL || 'https://meta-ads-dashboard.onrender.com';
        return `${baseUrl}/dashboard`;
    },
    
    generateAlertUrl: function(userId = '') {
        const baseUrl = process.env.BASE_URL || 'https://meta-ads-dashboard.onrender.com';
        return `${baseUrl}/alerts`;
    }
};