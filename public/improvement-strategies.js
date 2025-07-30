// 改善施策ページの初期化
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== 改善施策ページ初期化 ===');
    
    await loadImprovementStrategies();
    
    // 5分毎に改善施策を更新
    setInterval(loadImprovementStrategies, 5 * 60 * 1000);
});

// 改善施策データ読み込み
async function loadImprovementStrategies() {
    try {
        showLoadingState();
        
        const response = await fetch('/api/improvement-strategies');
        const data = await response.json();
        
        if (data.success) {
            updateImprovementStrategiesDisplay(data.improvements);
            updateStrategiesSummary(data.improvements);
        } else {
            showErrorMessage('改善施策データの取得に失敗しました');
        }
        
        hideLoadingState();
        
    } catch (error) {
        console.error('改善施策データ読み込みエラー:', error);
        hideLoadingState();
        showErrorMessage('改善施策データの読み込みに失敗しました');
    }
}

// 改善施策表示更新
function updateImprovementStrategiesDisplay(improvements) {
    const container = document.getElementById('improvement-strategies-container');
    
    if (!improvements || improvements.length === 0) {
        container.innerHTML = '<div class="no-improvements">📋 改善施策はありません</div>';
        return;
    }
    
    // メトリック別にグループ化
    const metricGroups = {};
    improvements.forEach(improvement => {
        if (!metricGroups[improvement.metric]) {
            metricGroups[improvement.metric] = {
                metric: improvement.metric,
                message: improvement.message,
                strategies: []
            };
        }
        metricGroups[improvement.metric].strategies = metricGroups[improvement.metric].strategies.concat(improvement.strategies);
    });
    
    // HTML生成
    const groupsHTML = Object.values(metricGroups).map(group => {
        const metricDisplayName = getMetricDisplayName(group.metric);
        
        const strategiesHTML = group.strategies.map((strategy, index) => `
            <div class="strategy-item">
                <div class="strategy-number">${index + 1}</div>
                <div class="strategy-content">${strategy}</div>
            </div>
        `).join('');
        
        return `
            <div class="improvement-card">
                <div class="improvement-header">
                    <div class="improvement-title">
                        <span class="metric-badge">${metricDisplayName}</span>
                        <span class="improvement-message">${group.message}</span>
                    </div>
                    <div class="improvement-count">${group.strategies.length}件の施策</div>
                </div>
                
                <div class="improvement-section">
                    <h4 class="section-title">📈 推奨する改善施策</h4>
                    <div class="strategies-list">
                        ${strategiesHTML}
                    </div>
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

// 施策サマリー更新
function updateStrategiesSummary(improvements) {
    const totalCountElement = document.getElementById('total-strategies');
    const metricsCountElement = document.getElementById('metrics-count');
    
    const totalStrategies = improvements.reduce((sum, imp) => sum + (imp.strategies ? imp.strategies.length : 0), 0);
    const uniqueMetrics = [...new Set(improvements.map(imp => imp.metric))].length;
    
    if (totalCountElement) totalCountElement.textContent = totalStrategies;
    if (metricsCountElement) metricsCountElement.textContent = uniqueMetrics;
}

// ローディング状態表示
function showLoadingState() {
    const container = document.getElementById('improvement-strategies-container');
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
    const container = document.getElementById('improvement-strategies-container');
    if (container) {
        container.innerHTML = `<div class="error-message">${message}</div>`;
    }
}