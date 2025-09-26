// 詳細レポートページ最終修正スクリプト
const fs = require('fs');
const path = require('path');

console.log('=== 詳細レポートページ最終修正 ===\n');

// 詳細レポートページのJavaScriptを完全修正
function fixDetailedReportsPage() {
    console.log('詳細レポートページのJavaScriptを修正中...');
    
    const viewPath = path.join(__dirname, 'views', 'detailed-reports.ejs');
    let content = fs.readFileSync(viewPath, 'utf8');
    
    // <script>タグを探す
    const scriptStart = content.indexOf('<script>');
    const scriptEnd = content.lastIndexOf('</script>');
    
    if (scriptStart === -1 || scriptEnd === -1) {
        console.error('❌ スクリプトタグが見つかりません');
        return;
    }
    
    // 新しいスクリプト内容
    const newScript = `<script>
        let campaigns = [];
        let reportData = null;
        let charts = {};
        
        // ページ読み込み時の初期化
        document.addEventListener('DOMContentLoaded', async () => {
            await loadCampaigns();
            await loadDetailedReport();
        });
        
        // キャンペーン一覧を取得
        async function loadCampaigns() {
            try {
                const response = await fetch('/api/campaigns/details?period=last_7d');
                const data = await response.json();
                
                if (data.success) {
                    campaigns = data.campaigns;
                    const select = document.getElementById('campaignFilter');
                    
                    // すべてのキャンペーンオプションを保持
                    const currentValue = select.value;
                    const options = '<option value="all">すべてのキャンペーン</option>' + 
                        campaigns.map(c => 
                            \`<option value="\${c.id}">\${c.name}</option>\`
                        ).join('');
                    
                    select.innerHTML = options;
                    
                    // 以前の選択を復元
                    if (currentValue) {
                        select.value = currentValue;
                    }
                }
            } catch (error) {
                console.error('キャンペーン読み込みエラー:', error);
            }
        }
        
        // 詳細レポートを読み込み
        async function loadDetailedReport() {
            try {
                const campaignId = document.getElementById('campaignFilter').value || 'all';
                const period = document.getElementById('periodFilter').value || 'last_7d';
                
                console.log('詳細レポート取得:', { campaignId, period });
                
                // 実データを取得
                const response = await fetch(\`/api/detailed-report?campaign_id=\${campaignId}&period=\${period}\`);
                const data = await response.json();
                
                console.log('API応答:', data);
                
                if (data.success) {
                    reportData = data;
                    renderCharts();
                    updateStatistics();
                    renderDetailTable();
                } else {
                    console.error('APIエラー:', data.error);
                    // エラー時でも表示を更新
                    showNoDataMessage();
                }
            } catch (error) {
                console.error('レポート取得エラー:', error);
                showNoDataMessage();
            }
        }
        
        // チャートを描画
        function renderCharts() {
            if (!reportData) return;
            
            // 地域別チャート
            renderRegionChart();
            // デバイス別チャート
            renderDeviceChart();
            // 時間帯別チャート
            renderHourlyChart();
        }
        
        // 地域別チャート
        function renderRegionChart() {
            const ctx = document.getElementById('regionChart');
            if (!ctx) return;
            
            if (charts.region) charts.region.destroy();
            
            const data = reportData.regionData || {};
            const labels = Object.keys(data);
            const values = labels.map(label => data[label].impressions || 0);
            
            if (labels.length === 0) {
                // データがない場合のデフォルト表示
                labels.push('データなし');
                values.push(1);
            }
            
            charts.region = new Chart(ctx.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: [
                            '#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // デバイス別チャート
        function renderDeviceChart() {
            const ctx = document.getElementById('deviceChart');
            if (!ctx) return;
            
            if (charts.device) charts.device.destroy();
            
            const data = reportData.deviceData || {};
            const labels = Object.keys(data);
            const values = labels.map(label => data[label].impressions || 0);
            
            if (labels.length === 0) {
                labels.push('データなし');
                values.push(1);
            }
            
            charts.device = new Chart(ctx.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: labels,
                    datasets: [{
                        data: values,
                        backgroundColor: ['#667eea', '#764ba2', '#f093fb']
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        }
        
        // 時間帯別チャート
        function renderHourlyChart() {
            const ctx = document.getElementById('hourlyChart');
            if (!ctx) return;
            
            if (charts.hourly) charts.hourly.destroy();
            
            const hours = Array.from({length: 24}, (_, i) => \`\${i}時\`);
            const hourlyData = reportData.hourlyData || Array.from({length: 24}, () => 0);
            
            charts.hourly = new Chart(ctx.getContext('2d'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'クリック数',
                        data: hourlyData,
                        borderColor: '#667eea',
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        }
        
        // 統計情報を更新
        function updateStatistics() {
            if (!reportData || !reportData.statistics) {
                document.getElementById('totalSpend').textContent = '¥0';
                document.getElementById('totalConversions').textContent = '0';
                document.getElementById('avgCPA').textContent = '¥0';
                document.getElementById('avgCTR').textContent = '0%';
                return;
            }
            
            const stats = reportData.statistics;
            document.getElementById('totalSpend').textContent = '¥' + (stats.totalSpend || 0).toLocaleString();
            document.getElementById('totalConversions').textContent = stats.totalConversions || 0;
            document.getElementById('avgCPA').textContent = '¥' + (stats.avgCPA || 0).toLocaleString();
            document.getElementById('avgCTR').textContent = (stats.avgCTR || 0) + '%';
        }
        
        // 詳細テーブルを描画
        function renderDetailTable() {
            const container = document.getElementById('detailTableContainer');
            if (!container) return;
            
            if (!reportData || (!reportData.regionData && !reportData.deviceData)) {
                container.innerHTML = '<div class="loading">データがありません</div>';
                return;
            }
            
            let tableRows = [];
            
            // 地域データ
            if (reportData.regionData) {
                Object.entries(reportData.regionData).forEach(([region, data]) => {
                    tableRows.push({
                        category: '地域',
                        name: region,
                        impressions: data.impressions || 0,
                        clicks: data.clicks || 0,
                        spend: data.spend || 0,
                        ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 0
                    });
                });
            }
            
            // デバイスデータ
            if (reportData.deviceData) {
                Object.entries(reportData.deviceData).forEach(([device, data]) => {
                    tableRows.push({
                        category: 'デバイス',
                        name: device,
                        impressions: data.impressions || 0,
                        clicks: data.clicks || 0,
                        spend: data.spend || 0,
                        ctr: data.impressions > 0 ? ((data.clicks / data.impressions) * 100).toFixed(2) : 0
                    });
                });
            }
            
            if (tableRows.length === 0) {
                container.innerHTML = '<div class="loading">表示するデータがありません</div>';
                return;
            }
            
            const html = \`
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>カテゴリ</th>
                            <th>セグメント</th>
                            <th>インプレッション</th>
                            <th>クリック</th>
                            <th>消化額</th>
                            <th>CTR</th>
                        </tr>
                    </thead>
                    <tbody>
                        \${tableRows.map(row => \`
                            <tr>
                                <td>\${row.category}</td>
                                <td>\${row.name}</td>
                                <td>\${row.impressions.toLocaleString()}</td>
                                <td>\${row.clicks.toLocaleString()}</td>
                                <td>¥\${Math.round(row.spend).toLocaleString()}</td>
                                <td>\${row.ctr}%</td>
                            </tr>
                        \`).join('')}
                    </tbody>
                </table>
            \`;
            container.innerHTML = html;
        }
        
        // データなしメッセージを表示
        function showNoDataMessage() {
            // チャートを初期化
            renderCharts();
            updateStatistics();
            
            const container = document.getElementById('detailTableContainer');
            if (container) {
                container.innerHTML = '<div class="loading">データを取得できませんでした。キャンペーンを選択してレポート生成をクリックしてください。</div>';
            }
        }
        
        // CSV出力
        function exportCSV() {
            if (!reportData || Object.keys(reportData.regionData || {}).length === 0) {
                alert('レポートデータが読み込まれていません');
                return;
            }
            
            // CSVデータの作成
            let csvContent = 'カテゴリ,項目,インプレッション,クリック,消化額\\n';
            
            // 地域データ
            if (reportData.regionData) {
                Object.entries(reportData.regionData).forEach(([region, data]) => {
                    csvContent += \`地域,\${region},\${data.impressions},\${data.clicks},\${data.spend}\\n\`;
                });
            }
            
            // デバイスデータ
            if (reportData.deviceData) {
                Object.entries(reportData.deviceData).forEach(([device, data]) => {
                    csvContent += \`デバイス,\${device},\${data.impressions},\${data.clicks},\${data.spend}\\n\`;
                });
            }
            
            // 統計サマリー
            if (reportData.statistics) {
                csvContent += \`\\n統計サマリー\\n\`;
                csvContent += \`総広告費,\${reportData.statistics.totalSpend}\\n\`;
                csvContent += \`総コンバージョン,\${reportData.statistics.totalConversions}\\n\`;
                csvContent += \`平均CPA,\${reportData.statistics.avgCPA}\\n\`;
                csvContent += \`平均CTR,\${reportData.statistics.avgCTR}%\\n\`;
            }
            
            // BOMを追加（Excel文字化け対策）
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            const campaignName = document.getElementById('campaignFilter').selectedOptions[0].text;
            const period = document.getElementById('periodFilter').value;
            const fileName = \`詳細レポート_\${campaignName}_\${period}_\${new Date().toISOString().split('T')[0]}.csv\`;
            
            link.setAttribute('href', url);
            link.setAttribute('download', fileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // PDF出力
        function exportPDF() {
            if (!reportData || Object.keys(reportData.regionData || {}).length === 0) {
                alert('レポートデータが読み込まれていません');
                return;
            }
            
            // 印刷用スタイルを一時的に適用
            const printStyles = \`
                <style id="print-styles">
                    @media print {
                        body { margin: 0; padding: 20px; }
                        .sidebar { display: none !important; }
                        .export-buttons { display: none !important; }
                        .report-filters { display: none !important; }
                        .main-content { width: 100%; max-width: none; }
                        .report-card { page-break-inside: avoid; }
                        canvas { max-height: 300px !important; }
                    }
                </style>
            \`;
            
            // スタイルを追加
            document.head.insertAdjacentHTML('beforeend', printStyles);
            
            // タイトルを追加
            const campaignName = document.getElementById('campaignFilter').selectedOptions[0].text;
            const period = document.getElementById('periodFilter').selectedOptions[0].text;
            const title = document.createElement('h1');
            title.id = 'pdf-title';
            title.style.textAlign = 'center';
            title.innerHTML = \`Meta広告 詳細レポート<br>\${campaignName} - \${period}<br>\${new Date().toLocaleDateString('ja-JP')}\`;
            document.querySelector('.main-content').insertBefore(title, document.querySelector('.content-header'));
            
            // 印刷ダイアログを開く
            window.print();
            
            // クリーンアップ
            setTimeout(() => {
                document.getElementById('print-styles')?.remove();
                document.getElementById('pdf-title')?.remove();
            }, 1000);
        }
    </script>`;
    
    // スクリプト部分を置き換え
    content = content.substring(0, scriptStart) + newScript + content.substring(scriptEnd + 9);
    
    fs.writeFileSync(viewPath, content, 'utf8');
    console.log('✅ 詳細レポートページのJavaScriptを修正完了\n');
}

// メイン実行
function main() {
    try {
        fixDetailedReportsPage();
        
        console.log('========================================');
        console.log('✅ 詳細レポートページの修正完了！');
        console.log('========================================\n');
        
        console.log('修正内容:');
        console.log('1. ✅ 重複コードを削除');
        console.log('2. ✅ renderCharts関数を実装');
        console.log('3. ✅ updateStatistics関数を修正');
        console.log('4. ✅ renderDetailTable関数を実装');
        console.log('5. ✅ エラーハンドリングを強化');
        
        console.log('\n確認方法:');
        console.log('1. ブラウザで http://localhost:3457/detailed-reports を開く');
        console.log('2. 「レポート生成」ボタンをクリック');
        console.log('3. グラフと詳細データが表示されることを確認');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();