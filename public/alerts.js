// アラートページの初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== アラートページ初期化 ===');
    
    await loadAlertData();
    
    // 5分毎にアラートデータを更新
    setInterval(loadAlertData, 5 * 60 * 1000);
});

// アラートデータ読み込み
async function loadAlertData() {
    try {
        showLoadingState();
        
        const response = await fetch('/api/alerts');
        const data = await response.json();
        
        if (data.success) {
            updateAlertDisplay(data.alerts);
            updateAlertHistory(data.history);
            updateAlertSettings(data.settings);
            updateAlertSummary(data.alerts, data.lastCheck);
        } else {
            showErrorMessage('アラートデータの取得に失敗しました');
        }
        
        hideLoadingState();
        
    } catch (error) {
        console.error('アラートデータ読み込みエラー:', error);
        hideLoadingState();
        showErrorMessage('アラートデータの読み込みに失敗しました');
    }
}

// アラート表示更新
function updateAlertDisplay(alerts) {
    const criticalContainer = document.getElementById('critical-alerts');
    const warningContainer = document.getElementById('warning-alerts');
    
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    const warningAlerts = alerts.filter(alert => alert.severity === 'warning');
    
    // 緊急アラート表示
    criticalContainer.innerHTML = criticalAlerts.length > 0 
        ? criticalAlerts.map(alert => createAlertCard(alert, 'critical')).join('')
        : '<div class="no-alerts">緊急アラートはありません</div>';
    
    // 注意アラート表示
    warningContainer.innerHTML = warningAlerts.length > 0
        ? warningAlerts.map(alert => createAlertCard(alert, 'warning')).join('')
        : '<div class="no-alerts">注意アラートはありません</div>';
}

// アラートカード生成
function createAlertCard(alert, type) {
    const icon = type === 'critical' ? '🔴' : '⚠️';
    const bgClass = type === 'critical' ? 'alert-critical' : 'alert-warning';
    
    return `
        <div class="alert-card ${bgClass}">
            <div class="alert-header">
                <span class="alert-icon">${icon}</span>
                <span class="alert-metric">${getMetricDisplayName(alert.metric)}</span>
                <span class="alert-time">${formatTimeAgo(alert.triggeredAt)}</span>
            </div>
            <div class="alert-message">${alert.message}</div>
            <div class="alert-actions">
                <button onclick="viewAlertDetails('${alert.id}')" class="btn-details">詳細表示</button>
                <button onclick="acknowledgeAlert('${alert.id}')" class="btn-acknowledge">確認済み</button>
            </div>
        </div>
    `;
}

// メトリクス表示名取得
function getMetricDisplayName(metric) {
    const metricNames = {
        'budget_rate': '予算消化率',
        'ctr': 'CTR',
        'conversions': 'コンバージョン',
        'cpm_increase': 'CPM上昇',
        'cpa_rate': 'CPA率'
    };
    return metricNames[metric] || metric;
}

// 時間表示フォーマット
function formatTimeAgo(timestamp) {
    const now = new Date();
    const alertTime = new Date(timestamp);
    const diffMs = now - alertTime;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMinutes < 1) return '今';
    if (diffMinutes < 60) return `${diffMinutes}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    return `${diffDays}日前`;
}

// アラート履歴更新
function updateAlertHistory(history) {
    const historyContainer = document.getElementById('alert-history');
    
    if (!history || history.length === 0) {
        historyContainer.innerHTML = '<div class="no-history">アラート履歴はありません</div>';
        return;
    }
    
    const historyHTML = history.slice(0, 10).map(entry => {
        const date = new Date(entry.timestamp).toLocaleString('ja-JP');
        const alertCount = entry.count;
        
        return `
            <div class="history-item">
                <div class="history-date">${date}</div>
                <div class="history-count">${alertCount}件のアラート</div>
            </div>
        `;
    }).join('');
    
    historyContainer.innerHTML = historyHTML;
}

// アラート設定更新
function updateAlertSettings(settings) {
    const settingsContainer = document.getElementById('alert-settings-summary');
    
    const goalNames = {
        'toC_メルマガ登録': 'toC（メルマガ登録）',
        'toC_LINE登録': 'toC（LINE登録）',
        'toC_電話ボタン': 'toC（電話ボタン）',
        'toC_購入': 'toC（購入）',
        'toB_メルマガ登録': 'toB（メルマガ登録）',
        'toB_LINE登録': 'toB（LINE登録）',
        'toB_電話ボタン': 'toB（電話ボタン）',
        'toB_購入': 'toB（購入）'
    };
    
    const currentGoalName = goalNames[settings.currentGoal] || settings.currentGoal;
    
    settingsContainer.innerHTML = `
        <div class="settings-item">
            <strong>現在のゴール:</strong> ${currentGoalName}
        </div>
        <div class="settings-item">
            <strong>監視項目:</strong> ${Object.keys(settings.rules || {}).length}項目
        </div>
        <div class="settings-item">
            <strong>最終更新:</strong> ${new Date(settings.lastUpdated).toLocaleString('ja-JP')}
        </div>
    `;
}

// アラートサマリー更新
function updateAlertSummary(alerts, lastCheck) {
    const activeAlertsElement = document.getElementById('active-alerts');
    const lastCheckElement = document.getElementById('last-check');
    
    activeAlertsElement.textContent = alerts.length;
    lastCheckElement.textContent = new Date(lastCheck).toLocaleString('ja-JP');
}

// アラート詳細表示
function viewAlertDetails(alertId) {
    // アラート詳細モーダル表示（実装予定）
    console.log('アラート詳細表示:', alertId);
    alert('アラート詳細機能は実装予定です');
}

// アラート確認済み
function acknowledgeAlert(alertId) {
    // アラート確認済み処理（実装予定）
    console.log('アラート確認済み:', alertId);
    alert('アラート確認済み機能は実装予定です');
}

// ローディング状態表示
function showLoadingState() {
    const containers = ['critical-alerts', 'warning-alerts', 'alert-history', 'alert-settings-summary'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = '<div class="loading">読み込み中...</div>';
        }
    });
}

// ローディング状態非表示
function hideLoadingState() {
    // ローディング状態のクリア（必要に応じて実装）
}

// エラーメッセージ表示
function showErrorMessage(message) {
    const containers = ['critical-alerts', 'warning-alerts'];
    containers.forEach(id => {
        const container = document.getElementById(id);
        if (container) {
            container.innerHTML = `<div class="error-message">${message}</div>`;
        }
    });
} 