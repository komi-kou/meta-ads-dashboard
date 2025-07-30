// 確認事項ページの初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== 確認事項ページ初期化 ===');
    
    await loadCheckItems();
    
    // 5分毎に確認事項を更新
    setInterval(loadCheckItems, 5 * 60 * 1000);
});

// 確認事項データ読み込み
async function loadCheckItems() {
    try {
        showLoadingState();
        
        const response = await fetch('/api/check-items');
        const data = await response.json();
        
        if (data.success) {
            updateCheckItemsDisplay(data.checkItems);
            updateCheckItemsSummary(data.checkItems);
        } else {
            showErrorMessage('確認事項データの取得に失敗しました');
        }
        
        hideLoadingState();
        
    } catch (error) {
        console.error('確認事項データ読み込みエラー:', error);
        hideLoadingState();
        showErrorMessage('確認事項データの読み込みに失敗しました');
    }
}

// 確認事項表示更新
function updateCheckItemsDisplay(checkItems) {
    const container = document.getElementById('check-items-container');
    
    if (!checkItems || checkItems.length === 0) {
        container.innerHTML = '<div class="no-alerts">確認が必要な項目はありません ✅</div>';
        return;
    }
    
    // メトリック別にグループ化
    const metricGroups = {};
    checkItems.forEach(item => {
        if (!metricGroups[item.metric]) {
            metricGroups[item.metric] = {
                metric: item.metric,
                message: item.message,
                items: []
            };
        }
        metricGroups[item.metric].items.push(item);
    });
    
    // HTML生成
    const groupsHTML = Object.values(metricGroups).map(group => {
        const cardClass = group.items[0].priority === 1 ? 'critical' : 'warning';
        const metricDisplayName = getMetricDisplayName(group.metric);
        
        const itemsHTML = group.items.map(item => `
            <div class="check-item">
                <div class="check-item-header">
                    <div class="check-priority">優先度 ${item.priority}</div>
                    <div class="check-title">${item.title}</div>
                </div>
                ${item.description ? `
                    <div class="check-description">
                        ${item.description.split('\n').map(line => `<div>${line}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
        
        return `
            <div class="alert-card ${cardClass}">
                <div class="alert-card-header">
                    <div class="alert-type">
                        <span class="metric-label">${metricDisplayName}</span>
                        ${group.message}
                    </div>
                    <div class="alert-time">${new Date().toLocaleString('ja-JP')}</div>
                </div>
                
                <div class="alert-section-header">📋 確認事項</div>
                <div class="alert-check-items">
                    ${itemsHTML}
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = groupsHTML;
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

// 確認事項サマリー更新
function updateCheckItemsSummary(checkItems) {
    const activeCountElement = document.getElementById('active-count');
    const lastCheckElement = document.getElementById('last-check');
    
    // 重複除去（メトリック別にユニーク化）
    const uniqueMetrics = [...new Set(checkItems.map(item => item.metric))];
    
    activeCountElement.textContent = uniqueMetrics.length;
    lastCheckElement.textContent = new Date().toLocaleString('ja-JP');
}

// ローディング状態表示
function showLoadingState() {
    const container = document.getElementById('check-items-container');
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
    const container = document.getElementById('check-items-container');
    if (container) {
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
}