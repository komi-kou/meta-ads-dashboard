// URL生成ヘルパー
function getDashboardUrl(userId = '') {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3457';
    return `${baseUrl}/dashboard`;
}

function getAlertUrl(userId = '') {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3457';
    return `${baseUrl}/alerts`;
}

module.exports = {
    getDashboardUrl,
    getAlertUrl,
    generateDashboardUrl: getDashboardUrl, // 後方互換性
    generateAlertUrl: getAlertUrl // 後方互換性
};