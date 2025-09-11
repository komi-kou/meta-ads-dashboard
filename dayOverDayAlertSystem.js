// dayOverDayAlertSystem.js - 前日比アラートシステム
const fs = require('fs');
const path = require('path');

// メトリクスの方向性定義（高い方が良い/低い方が良い）
const METRIC_DIRECTIONS = {
    // 高い方が良い指標
    ctr: 'higher_better',
    cvr: 'higher_better',
    conversions: 'higher_better',
    budget_rate: 'higher_better',
    roas: 'higher_better',
    
    // 低い方が良い指標
    cpa: 'lower_better',
    cpm: 'lower_better',
    cpc: 'lower_better',
    frequency: 'lower_better'
};

// 前日比の閾値設定（デフォルト）
const DEFAULT_THRESHOLDS = {
    // 警告レベル（20%の変化）
    warning: 0.2,
    // 危険レベル（30%の変化）
    critical: 0.3
};

// メトリクス別の閾値設定（より細かい制御）
const METRIC_THRESHOLDS = {
    ctr: { warning: 0.2, critical: 0.3 },
    cpm: { warning: 0.15, critical: 0.25 },
    cpa: { warning: 0.2, critical: 0.3 },
    conversions: { warning: 0.3, critical: 0.5 },
    frequency: { warning: 0.3, critical: 0.5 },
    budget_rate: { warning: 0.2, critical: 0.3 }
};

/**
 * 前日比アラートをチェック
 * @param {Object} currentData - 当日のデータ
 * @param {Object} previousData - 前日のデータ
 * @param {String} userId - ユーザーID
 * @returns {Array} アラートの配列
 */
async function checkDayOverDayAlerts(currentData, previousData, userId = null) {
    console.log('=== 前日比アラートチェック開始 ===');
    
    const alerts = [];
    
    if (!currentData || !previousData) {
        console.log('⚠️ データが不足しているため前日比チェックをスキップ');
        return alerts;
    }
    
    // 各メトリクスをチェック
    const metricsToCheck = ['ctr', 'cpm', 'cpa', 'conversions', 'frequency', 'budget_rate'];
    
    for (const metric of metricsToCheck) {
        const alert = checkMetricDayOverDay(metric, currentData, previousData, userId);
        if (alert) {
            alerts.push(alert);
        }
    }
    
    console.log(`✅ 前日比アラートチェック完了: ${alerts.length}件のアラート`);
    return alerts;
}

/**
 * 個別メトリクスの前日比チェック
 */
function checkMetricDayOverDay(metric, currentData, previousData, userId) {
    const currentValue = getMetricValue(currentData, metric);
    const previousValue = getMetricValue(previousData, metric);
    
    // 前日データが0または存在しない場合はスキップ
    if (!previousValue || previousValue === 0) {
        console.log(`⚠️ ${metric}: 前日データなしのためスキップ`);
        return null;
    }
    
    // 変化率を計算
    const changeRate = (currentValue - previousValue) / previousValue;
    const changePercent = Math.round(changeRate * 100);
    
    // 閾値を取得
    const thresholds = METRIC_THRESHOLDS[metric] || DEFAULT_THRESHOLDS;
    const direction = METRIC_DIRECTIONS[metric] || 'higher_better';
    
    let alertTriggered = false;
    let severity = 'info';
    let alertMessage = '';
    
    // 方向性に応じた判定
    if (direction === 'higher_better') {
        // 高い方が良い指標（大幅な下落でアラート）
        if (changeRate < -thresholds.critical) {
            alertTriggered = true;
            severity = 'critical';
            alertMessage = `${getMetricDisplayName(metric)}が前日比${Math.abs(changePercent)}%下落`;
        } else if (changeRate < -thresholds.warning) {
            alertTriggered = true;
            severity = 'warning';
            alertMessage = `${getMetricDisplayName(metric)}が前日比${Math.abs(changePercent)}%下落`;
        }
    } else {
        // 低い方が良い指標（大幅な上昇でアラート）
        if (changeRate > thresholds.critical) {
            alertTriggered = true;
            severity = 'critical';
            alertMessage = `${getMetricDisplayName(metric)}が前日比${changePercent}%上昇`;
        } else if (changeRate > thresholds.warning) {
            alertTriggered = true;
            severity = 'warning';
            alertMessage = `${getMetricDisplayName(metric)}が前日比${changePercent}%上昇`;
        }
    }
    
    if (alertTriggered) {
        console.log(`🚨 ${metric}: 前日比アラート発生 - ${alertMessage}`);
        
        // 確認事項と改善施策を取得
        const { checkItems, improvements } = getCheckItemsAndImprovements(metric, changeRate, direction);
        
        return {
            id: `dod_${metric}_${Date.now()}`,
            userId: userId,
            metric: metric,
            type: 'day_over_day',
            message: `${alertMessage}（前日: ${formatValue(previousValue, metric)} → 当日: ${formatValue(currentValue, metric)}）`,
            previousValue: previousValue,
            currentValue: currentValue,
            changeRate: changeRate,
            changePercent: changePercent,
            severity: severity,
            timestamp: new Date().toISOString(),
            status: 'active',
            checkItems: checkItems,
            improvements: improvements
        };
    }
    
    return null;
}

/**
 * メトリクス値を取得
 */
function getMetricValue(data, metric) {
    // メトリクス名のマッピング
    const metricMap = {
        ctr: 'ctr',
        cpm: 'cpm',
        cpa: 'cpa',
        conversions: 'conversions',
        frequency: 'frequency',
        budget_rate: 'budgetRate'
    };
    
    const key = metricMap[metric] || metric;
    return parseFloat(data[key] || 0);
}

/**
 * メトリクスの表示名を取得
 */
function getMetricDisplayName(metric) {
    const displayNames = {
        ctr: 'CTR',
        cpm: 'CPM',
        cpa: 'CPA',
        conversions: 'コンバージョン数',
        frequency: 'フリークエンシー',
        budget_rate: '予算消化率'
    };
    return displayNames[metric] || metric;
}

/**
 * 値をフォーマット
 */
function formatValue(value, metric) {
    if (metric === 'ctr' || metric === 'budget_rate' || metric === 'frequency') {
        return `${value.toFixed(2)}%`;
    }
    if (metric === 'conversions') {
        return `${Math.round(value)}件`;
    }
    return `${Math.round(value).toLocaleString()}円`;
}

/**
 * 前日比アラート用の確認事項と改善施策を取得
 */
function getCheckItemsAndImprovements(metric, changeRate, direction) {
    const checkItems = [];
    const improvements = {};
    
    // 大幅な悪化の場合
    if ((direction === 'higher_better' && changeRate < -0.2) || 
        (direction === 'lower_better' && changeRate > 0.2)) {
        
        switch (metric) {
            case 'ctr':
                checkItems.push(
                    {
                        priority: 1,
                        title: 'クリエイティブの疲弊確認',
                        description: '同じクリエイティブを長期間配信していないか確認'
                    },
                    {
                        priority: 2,
                        title: '競合他社の動向確認',
                        description: '競合が新しいキャンペーンを開始していないか確認'
                    }
                );
                improvements['クリエイティブの疲弊確認'] = [
                    '新しいクリエイティブを追加する',
                    '既存クリエイティブをリフレッシュする'
                ];
                break;
                
            case 'cpm':
                checkItems.push(
                    {
                        priority: 1,
                        title: '競合の入札強化確認',
                        description: '同じターゲット層への競合が増えていないか確認'
                    },
                    {
                        priority: 2,
                        title: 'オーディエンスの質確認',
                        description: 'ターゲティング設定が適切か確認'
                    }
                );
                improvements['競合の入札強化確認'] = [
                    'ターゲティングを見直す',
                    '配信時間帯を調整する'
                ];
                break;
                
            case 'conversions':
                checkItems.push(
                    {
                        priority: 1,
                        title: 'LP/サイトの問題確認',
                        description: 'ランディングページやサイトに技術的問題がないか確認'
                    },
                    {
                        priority: 2,
                        title: '季節性・曜日要因の確認',
                        description: '曜日や季節による影響がないか確認'
                    }
                );
                improvements['LP/サイトの問題確認'] = [
                    'LPの読み込み速度を改善する',
                    'コンバージョンボタンの位置を最適化する'
                ];
                break;
                
            default:
                checkItems.push(
                    {
                        priority: 1,
                        title: '急激な変化の原因調査',
                        description: '前日から大きく変化した要因を特定する'
                    }
                );
                improvements['急激な変化の原因調査'] = [
                    '詳細なデータ分析を実施する',
                    '必要に応じて設定を調整する'
                ];
        }
    }
    
    return { checkItems, improvements };
}

/**
 * アラート履歴に保存
 */
async function saveAlertHistory(alerts) {
    if (!alerts || alerts.length === 0) return;
    
    try {
        const alertHistoryPath = path.join(__dirname, 'alert_history.json');
        let alertHistory = [];
        
        // 既存の履歴を読み込み
        if (fs.existsSync(alertHistoryPath)) {
            alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
        }
        
        // 新しいアラートを追加
        alertHistory.push(...alerts);
        
        // 最新1000件のみ保持（メモリ対策）
        if (alertHistory.length > 1000) {
            alertHistory = alertHistory.slice(-1000);
        }
        
        // 保存
        fs.writeFileSync(alertHistoryPath, JSON.stringify(alertHistory, null, 2));
        console.log(`✅ ${alerts.length}件のアラートを履歴に保存`);
        
    } catch (error) {
        console.error('❌ アラート履歴保存エラー:', error);
    }
}

module.exports = {
    checkDayOverDayAlerts,
    saveAlertHistory
};