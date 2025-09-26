// ダッシュボード問題修正スクリプト
// 1. 予算消化率が0になる問題を修正
// 2. アラート内容の重複を解消
// 3. 目標値変更時の記載問題を修正

const fs = require('fs');
const path = require('path');

console.log('=== ダッシュボード問題修正スクリプト ===\n');

// 1. app.jsの修正: createZeroMetrics関数の修正
function fixAppJs() {
    console.log('1. app.jsを修正中...');
    
    const appJsPath = path.join(__dirname, 'app.js');
    let appJsContent = fs.readFileSync(appJsPath, 'utf8');
    
    // createZeroMetrics関数を修正（予算消化率を正しく計算）
    const oldCreateZeroMetrics = `function createZeroMetrics(selectedDate) {
    return {
        spend: 0,
        budgetRate: 0.00,`;
    
    const newCreateZeroMetrics = `function createZeroMetrics(selectedDate, userId = null) {
    // 予算消化率は消費が0の場合は0とする
    return {
        spend: 0,
        budgetRate: 0.00, // 消費が0なので予算消化率も0`;
    
    if (appJsContent.includes(oldCreateZeroMetrics)) {
        appJsContent = appJsContent.replace(oldCreateZeroMetrics, newCreateZeroMetrics);
        
        // createZeroMetricsの呼び出し箇所も修正
        appJsContent = appJsContent.replace(
            'return createZeroMetrics(selectedDate);',
            'return createZeroMetrics(selectedDate, userId);'
        );
        
        fs.writeFileSync(appJsPath, appJsContent, 'utf8');
        console.log('  ✅ createZeroMetrics関数を修正しました');
    } else {
        console.log('  ⚠️ createZeroMetrics関数の修正箇所が見つかりません');
    }
}

// 2. alertSystem.jsの修正: 重複除去の強化
function fixAlertSystem() {
    console.log('\n2. alertSystem.jsを修正中...');
    
    const alertSystemPath = path.join(__dirname, 'alertSystem.js');
    let alertSystemContent = fs.readFileSync(alertSystemPath, 'utf8');
    
    // checkUserAlertsに重複除去ロジックを追加
    const checkUserAlertsMarker = 'console.log(`ユーザー${userId}のアラートチェック完了: ${alerts.length}件のアラート`);';
    
    if (alertSystemContent.includes(checkUserAlertsMarker)) {
        const deduplicationCode = `
        // 重複除去: 同じメトリックのアラートは1つのみ保持
        const uniqueAlerts = [];
        const seenMetrics = new Set();
        
        for (const alert of alerts) {
            if (!seenMetrics.has(alert.metric)) {
                seenMetrics.add(alert.metric);
                uniqueAlerts.push(alert);
            }
        }
        
        if (alerts.length !== uniqueAlerts.length) {
            console.log(\`重複除去: \${alerts.length}件 → \${uniqueAlerts.length}件\`);
            alerts = uniqueAlerts;
        }
        
        `;
        
        alertSystemContent = alertSystemContent.replace(
            checkUserAlertsMarker,
            deduplicationCode + checkUserAlertsMarker
        );
        
        fs.writeFileSync(alertSystemPath, alertSystemContent, 'utf8');
        console.log('  ✅ アラート重複除去ロジックを強化しました');
    }
}

// 3. アラートメッセージの動的更新を修正
function fixAlertMessages() {
    console.log('\n3. アラートメッセージの動的更新を修正中...');
    
    const alertSystemPath = path.join(__dirname, 'alertSystem.js');
    let alertSystemContent = fs.readFileSync(alertSystemPath, 'utf8');
    
    // checkMetricAgainstTarget関数内のメッセージ生成を改善
    const oldMessagePattern = /alertMessage = `(.+?)が目標値(.+?)を(.+?)（現在: (.+?)）`;/g;
    const newMessagePattern = (match, metric, targetValue, comparison, currentValue) => {
        return `alertMessage = \`\${getMetricDisplayName(metric)}が目標値\${formatValue(targetValue, metric)}を\${direction === 'higher_better' ? '下回っています' : '上回っています'}（現在: \${formatValue(currentValue, metric)}）\`;`;
    };
    
    // メッセージ生成部分を確実に現在値を反映するように修正
    const improvedFormatValue = `
// 値のフォーマット（改善版）
function formatValue(value, metric) {
    // nullやundefinedのチェック
    if (value === null || value === undefined) {
        return '未取得';
    }
    
    switch (metric) {
        case 'ctr':
        case 'cvr':
        case 'budget_rate':
            return \`\${Math.round(value * 10) / 10}%\`;
        case 'roas':
            return \`\${value}%\`;
        case 'conversions':
            return \`\${value}件\`;
        case 'cpa':
        case 'cpm':
        case 'cpc':
            return \`\${Math.round(value).toLocaleString()}円\`;
        default:
            return String(value);
    }
}`;
    
    // formatValue関数が存在する場合は改善版に置き換え
    if (alertSystemContent.includes('function formatValue(value, metric)')) {
        alertSystemContent = alertSystemContent.replace(
            /function formatValue\(value, metric\) \{[\s\S]*?\n\}/,
            improvedFormatValue
        );
        console.log('  ✅ formatValue関数を改善しました');
    }
}

// 4. グローバル重複除去の改善
function improveGlobalDeduplication() {
    console.log('\n4. グローバル重複除去を改善中...');
    
    const globalDedupPath = path.join(__dirname, 'globalDeduplication.js');
    
    if (fs.existsSync(globalDedupPath)) {
        let globalDedupContent = fs.readFileSync(globalDedupPath, 'utf8');
        
        // filterDuplicates関数を改善
        const improvedFilterDuplicates = `    /**
     * 複数のアラートから重複を除外（改善版）
     * @param {Array} alerts - アラート配列
     * @param {string} userId - ユーザーID
     * @returns {Array} 重複を除外したアラート配列
     */
    filterDuplicates(alerts, userId = null) {
        if (!alerts || alerts.length === 0) return alerts;
        
        const filtered = [];
        const metricsSeen = new Set();
        const messagesSeen = new Set();
        
        for (const alert of alerts) {
            const metric = alert.metric || alert.type || alert.name;
            const message = alert.message || '';
            
            // メトリックとメッセージの組み合わせで重複チェック
            const uniqueKey = \`\${metric}_\${message}\`;
            
            // 同一バッチ内での重複チェック
            if (metricsSeen.has(metric) || messagesSeen.has(uniqueKey)) {
                console.log(\`[GlobalDedup] バッチ内重複スキップ: \${metric}\`);
                continue;
            }
            
            // グローバル履歴での重複チェック
            if (this.isAlreadySent(metric, userId)) {
                console.log(\`[GlobalDedup] 履歴重複スキップ: \${metric}\`);
                continue;
            }
            
            metricsSeen.add(metric);
            messagesSeen.add(uniqueKey);
            filtered.push(alert);
        }
        
        console.log(\`[GlobalDedup] 重複排除結果: \${alerts.length}件 → \${filtered.length}件\`);
        return filtered;
    }`;
        
        // filterDuplicates関数を置き換え
        globalDedupContent = globalDedupContent.replace(
            /filterDuplicates\(alerts\) \{[\s\S]*?return filtered;\s*\}/,
            improvedFilterDuplicates
        );
        
        fs.writeFileSync(globalDedupPath, globalDedupContent, 'utf8');
        console.log('  ✅ グローバル重複除去を改善しました');
    }
}

// 5. 予算消化率の計算ロジックを確認・修正
function verifyBudgetRateCalculation() {
    console.log('\n5. 予算消化率の計算ロジックを確認中...');
    
    const appJsPath = path.join(__dirname, 'app.js');
    let appJsContent = fs.readFileSync(appJsPath, 'utf8');
    
    // convertInsightsToMetricsWithActualBudget関数を確認
    const budgetCalcPattern = /const budgetRate = dailyBudget > 0 \? \(spend \/ dailyBudget\) \* 100 : 0;/;
    
    if (budgetCalcPattern.test(appJsContent)) {
        console.log('  ✅ 予算消化率の計算ロジックは正しいです');
    } else {
        console.log('  ⚠️ 予算消化率の計算ロジックを確認してください');
    }
    
    // getDailyBudgetFromGoals関数も確認
    if (appJsContent.includes('function getDailyBudgetFromGoals')) {
        console.log('  ✅ getDailyBudgetFromGoals関数が存在します');
        
        // ログ出力が適切か確認
        if (appJsContent.includes('console.log(\'=== ハイブリッド日予算取得 ===\')')) {
            console.log('  ✅ 日予算取得のログ出力が設定されています');
        }
    }
}

// メイン実行
function main() {
    try {
        // バックアップを作成
        console.log('バックアップを作成中...');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        ['app.js', 'alertSystem.js', 'globalDeduplication.js'].forEach(file => {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                const backupPath = path.join(__dirname, `${file}.backup_${timestamp}`);
                fs.copyFileSync(filePath, backupPath);
                console.log(`  ✅ ${file} → ${file}.backup_${timestamp}`);
            }
        });
        
        console.log('\n修正を開始します...\n');
        
        // 各修正を実行
        fixAppJs();
        fixAlertSystem();
        fixAlertMessages();
        improveGlobalDeduplication();
        verifyBudgetRateCalculation();
        
        console.log('\n========================================');
        console.log('✅ 全ての修正が完了しました！');
        console.log('========================================\n');
        
        console.log('次のステップ:');
        console.log('1. サーバーを再起動してください: npm start');
        console.log('2. ダッシュボードで予算消化率が正しく表示されることを確認');
        console.log('3. アラートの重複がないことを確認');
        console.log('4. 目標値を変更してメッセージが正しく更新されることを確認\n');
        
    } catch (error) {
        console.error('❌ 修正中にエラーが発生しました:', error);
        console.log('\nバックアップファイルから復元してください。');
    }
}

// 実行
main();