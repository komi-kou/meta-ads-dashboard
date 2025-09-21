// URL動的生成ヘルパー
function getBaseUrl() {
    // 優先順位: 環境変数 > デフォルト値
    if (process.env.BASE_URL) {
        return process.env.BASE_URL;
    }
    
    // 本番環境のデフォルト
    if (process.env.NODE_ENV === 'production') {
        return 'https://meta-ads-dashboard.onrender.com';
    }
    
    // 開発環境のデフォルト
    return 'http://localhost:3000';
}

function getDashboardUrl(userId = null) {
    const baseUrl = getBaseUrl();
    const path = '/dashboard';
    
    if (userId) {
        return `${baseUrl}${path}?user=${userId}`;
    }
    return `${baseUrl}${path}`;
}

function getAlertsUrl(userId = null) {
    const baseUrl = getBaseUrl();
    const path = '/alerts';
    
    if (userId) {
        return `${baseUrl}${path}?user=${userId}`;
    }
    return `${baseUrl}${path}`;
}

function getImprovementTasksUrl(userId = null) {
    const baseUrl = getBaseUrl();
    const path = '/improvement-tasks';
    
    if (userId) {
        return `${baseUrl}${path}?user=${userId}`;
    }
    return `${baseUrl}${path}`;
}

function getImprovementStrategiesUrl(userId = null) {
    const baseUrl = getBaseUrl();
    const path = '/improvement-strategies';
    
    if (userId) {
        return `${baseUrl}${path}?user=${userId}`;
    }
    return `${baseUrl}${path}`;
}

module.exports = {
    getBaseUrl,
    getDashboardUrl,
    getAlertsUrl,
    getImprovementTasksUrl,
    getImprovementStrategiesUrl
};