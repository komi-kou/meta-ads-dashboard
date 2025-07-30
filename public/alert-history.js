// アラート履歴ページの初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== アラート履歴ページ初期化 ===');
    
    await loadAlertHistory();
    
    // 5分毎にアラート履歴を更新
    setInterval(loadAlertHistory, 5 * 60 * 1000);
});

// アラート履歴データ読み込み
async function loadAlertHistory() {
    try {
        showLoadingState();
        
        const response = await fetch('/api/alert-history');
        const data = await response.json();
        
        if (data.success) {
            updateAlertHistoryDisplay(data.alerts);
            updateHistorySummary(data.alerts);
        } else {
            showErrorMessage('アラート履歴データの取得に失敗しました');
        }
        
        hideLoadingState();
        
    } catch (error) {
        console.error('アラート履歴データ読み込みエラー:', error);
        hideLoadingState();
        showErrorMessage('アラート履歴データの読み込みに失敗しました');
    }
}

// アラート履歴表示更新
function updateAlertHistoryDisplay(alerts) {
    const container = document.getElementById('alert-history-container');
    
    if (!alerts || alerts.length === 0) {
        container.innerHTML = '<div class="no-history">📋 アラート履歴はありません</div>';
        return;
    }
    
    // 日付別にグループ化
    const groupedByDate = {};
    alerts.forEach(alert => {
        const date = new Date(alert.timestamp).toLocaleDateString('ja-JP');
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(alert);
    });
    
    // HTML生成
    const historyHTML = Object.entries(groupedByDate)
        .sort(([a], [b]) => new Date(b) - new Date(a))
        .map(([date, dayAlerts]) => {
            const alertsHTML = dayAlerts
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                .map(alert => createHistoryCard(alert))
                .join('');
            
            return `
                <div class="date-section">
                    <h4 class="date-header">${date} (${dayAlerts.length}件)</h4>
                    <div class="date-alerts">
                        ${alertsHTML}
                    </div>
                </div>
            `;
        }).join('');
    
    container.innerHTML = historyHTML;
}

// 履歴カード生成
function createHistoryCard(alert) {
    const levelClass = getLevelClass(alert.level);
    const levelIcon = getLevelIcon(alert.level);
    const metricDisplayName = getMetricDisplayName(alert.metric);
    const time = new Date(alert.timestamp).toLocaleTimeString('ja-JP');
    
    return `
        <div class="history-card ${levelClass}">
            <div class="card-header">
                <div class="alert-info">
                    <span class="level-icon">${levelIcon}</span>
                    <span class="metric-badge">${metricDisplayName}</span>
                    <span class="alert-time">${time}</span>
                </div>
                <div class="alert-status status-${alert.status}">${getStatusDisplayName(alert.status)}</div>
            </div>
            <div class="alert-message">${alert.message}</div>
        </div>
    `;
}

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    const metricNames = {
        'budget_rate': '予算消化率',
        'daily_budget': '日予算',
        'ctr': 'CTR',
        'conversions': 'CV',
        'cpm': 'CPM',
        'cpm_increase': 'CPM',
        'cpa': 'CPA',
        'cpa_rate': 'CPA'
    };
    return metricNames[metric] || metric;
}

// レベルクラス取得
function getLevelClass(level) {
    const levelClasses = {
        'high': 'level-critical',
        'medium': 'level-warning',
        'low': 'level-info'
    };
    return levelClasses[level] || 'level-info';
}

// レベルアイコン取得
function getLevelIcon(level) {
    const levelIcons = {
        'high': '🔴',
        'medium': '⚠️',
        'low': 'ℹ️'
    };
    return levelIcons[level] || 'ℹ️';
}

// ステータス表示名取得
function getStatusDisplayName(status) {
    const statusNames = {
        'active': 'アクティブ',
        'resolved': '解決済み',
        'acknowledged': '確認済み'
    };
    return statusNames[status] || status;
}

// 履歴サマリー更新
function updateHistorySummary(alerts) {
    const totalCountElement = document.getElementById('total-count');
    const activeCountElement = document.getElementById('active-count');
    const resolvedCountElement = document.getElementById('resolved-count');
    
    const totalCount = alerts.length;
    const activeCount = alerts.filter(alert => alert.status === 'active').length;
    const resolvedCount = alerts.filter(alert => alert.status === 'resolved').length;
    
    if (totalCountElement) totalCountElement.textContent = totalCount;
    if (activeCountElement) activeCountElement.textContent = activeCount;
    if (resolvedCountElement) resolvedCountElement.textContent = resolvedCount;
}

// ローディング状態表示
function showLoadingState() {
    const container = document.getElementById('alert-history-container');
    if (container) {
        container.innerHTML = '<div class="loading">読み込み中...</div>';
    }
}

// ローディング状態非表示
function hideLoadingState() {
    // ローディング状態のクリア（必要に応じて実装）
}

// エラーメッセージ表示
function showErrorMessage(message) {
    const container = document.getElementById('alert-history-container');
    if (container) {
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
}