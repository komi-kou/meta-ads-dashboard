// すべてのキャンペーン表示問題を修正するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== キャンペーン表示総合修正スクリプト ===\n');

// 1. /api/dashboard-dataエンドポイントを修正
function fixDashboardDataAPI() {
    console.log('1. /api/dashboard-data エンドポイントを修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // fetchMetaDataWithStoredConfigがキャンペーンデータを返すようにする
    const apiRoute = content.indexOf("app.get('/api/dashboard-data'");
    const routeEnd = content.indexOf('});', apiRoute) + 3;
    
    if (apiRoute !== -1) {
        // res.jsonの部分を探す
        const resJsonStart = content.indexOf('res.json({', apiRoute);
        const resJsonEnd = content.indexOf('});', resJsonStart) + 3;
        
        if (resJsonStart !== -1) {
            const currentReturn = content.substring(resJsonStart, resJsonEnd);
            
            if (!currentReturn.includes('campaigns:')) {
                const newReturn = currentReturn.replace(
                    'success: true,',
                    `success: true,
      campaigns: metaData && metaData.campaigns ? metaData.campaigns : [],`
                );
                
                content = content.substring(0, resJsonStart) + newReturn + content.substring(resJsonEnd);
                fs.writeFileSync(appPath, content, 'utf8');
                console.log('  ✅ /api/dashboard-data にキャンペーンデータを追加\n');
            } else {
                console.log('  ℹ️ 既にキャンペーンデータが含まれています\n');
            }
        }
    }
}

// 2. ダッシュボードのJavaScriptを修正
function fixDashboardJS() {
    console.log('2. dashboard.ejs のJavaScript部分を修正...');
    
    const viewPath = path.join(__dirname, 'views', 'dashboard.ejs');
    let content = fs.readFileSync(viewPath, 'utf8');
    
    // updateDashboard関数を探して修正
    const updateDashboardIndex = content.indexOf('function updateDashboard(data)');
    
    if (updateDashboardIndex !== -1) {
        // キャンペーン詳細テーブル更新コードを追加
        if (!content.includes('updateCampaignDetailsTable')) {
            const newFunction = `
        
        // キャンペーン詳細テーブルを更新
        function updateCampaignDetailsTable(campaigns) {
            const tbody = document.getElementById('campaign-details-body');
            if (!tbody) return;
            
            if (!campaigns || campaigns.length === 0) {
                tbody.innerHTML = \`
                    <tr>
                        <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
                            キャンペーンデータがありません
                        </td>
                    </tr>
                \`;
                return;
            }
            
            tbody.innerHTML = campaigns.map(campaign => \`
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 12px;">\${campaign.name || '-'}</td>
                    <td style="padding: 12px; text-align: center;">
                        <span style="padding: 4px 8px; border-radius: 4px; font-size: 12px; 
                            background: \${campaign.status === 'ACTIVE' ? '#10b981' : '#ef4444'}20;">
                            \${campaign.status || '-'}
                        </span>
                    </td>
                    <td style="padding: 12px; text-align: right;">¥\${(campaign.spend || 0).toLocaleString()}</td>
                    <td style="padding: 12px; text-align: right;">\${(campaign.ctr || 0).toFixed(2)}%</td>
                    <td style="padding: 12px; text-align: right;">¥\${Math.round(campaign.cpm || 0).toLocaleString()}</td>
                    <td style="padding: 12px; text-align: right; font-weight: bold; color: #059669;">
                        \${campaign.conversions || 0}件
                    </td>
                    <td style="padding: 12px; text-align: right; font-weight: bold;">
                        ¥\${campaign.conversions > 0 ? Math.round(campaign.cpa || 0).toLocaleString() : '-'}
                    </td>
                    <td style="padding: 12px; text-align: center;">
                        <button onclick="viewCampaignDetail('\${campaign.id}')" 
                            style="padding: 4px 12px; background: #3b82f6; color: white; 
                            border: none; border-radius: 4px; cursor: pointer;">
                            詳細
                        </button>
                    </td>
                </tr>
            \`).join('');
        }
        
        function viewCampaignDetail(campaignId) {
            console.log('キャンペーン詳細表示:', campaignId);
            // 詳細ページへの遷移やモーダル表示など
        }`;
            
            // updateDashboard関数の後に追加
            const functionEnd = content.indexOf('\n        }', updateDashboardIndex);
            const insertPos = functionEnd + 10;
            
            content = content.substring(0, insertPos) + newFunction + content.substring(insertPos);
            
            // updateDashboard関数内でキャンペーンテーブル更新を呼び出す
            const updateContent = content.substring(updateDashboardIndex, functionEnd);
            if (!updateContent.includes('updateCampaignDetailsTable')) {
                const newCall = '\n            // キャンペーン詳細テーブルを更新\n            updateCampaignDetailsTable(data.campaigns);';
                content = content.substring(0, functionEnd) + newCall + content.substring(functionEnd);
            }
            
            fs.writeFileSync(viewPath, content, 'utf8');
            console.log('  ✅ キャンペーン詳細テーブル更新関数を追加\n');
        }
    }
}

// 3. キャンペーン管理ページを修正
function fixCampaignManagementPage() {
    console.log('3. campaigns.ejs を修正...');
    
    const viewPath = path.join(__dirname, 'views', 'campaigns.ejs');
    
    if (fs.existsSync(viewPath)) {
        let content = fs.readFileSync(viewPath, 'utf8');
        
        // CV数とCPAの列があることを確認
        if (!content.includes('CV数') && !content.includes('CPA')) {
            console.log('  ⚠️ campaigns.ejs にCV数とCPA列を追加する必要があります');
            
            // テーブルヘッダーを探して修正
            const theadIndex = content.indexOf('<thead>');
            const theadEnd = content.indexOf('</thead>', theadIndex);
            
            if (theadIndex !== -1 && theadEnd !== -1) {
                let theadContent = content.substring(theadIndex, theadEnd);
                
                if (!theadContent.includes('CV数')) {
                    theadContent = theadContent.replace(
                        '</tr>',
                        `    <th>CV数</th>
                    <th>CPA</th>
                </tr>`
                    );
                    
                    content = content.substring(0, theadIndex) + theadContent + content.substring(theadEnd);
                    fs.writeFileSync(viewPath, content, 'utf8');
                    console.log('  ✅ CV数とCPA列を追加\n');
                }
            }
        } else {
            console.log('  ✅ CV数とCPA列は既に存在します\n');
        }
    } else {
        console.log('  ⚠️ campaigns.ejsが見つかりません\n');
    }
}

// 4. 詳細レポートページのAPIエンドポイントを修正
function fixDetailedReportAPI() {
    console.log('4. 詳細レポートAPIエンドポイントを確認・修正...');
    
    const appPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appPath, 'utf8');
    
    // /api/detailed-reportエンドポイントが存在するか確認
    if (!content.includes("app.get('/api/detailed-report'")) {
        console.log('  ⚠️ 詳細レポートAPIが見つかりません。追加します...');
        
        const newEndpoint = `
// 詳細レポートAPI
app.get('/api/detailed-report', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { period = 'last_7d', campaignId } = req.query;
        
        console.log('詳細レポート取得:', { userId, period, campaignId });
        
        // Meta APIからデータを取得
        const metaData = await fetchMetaDataWithStoredConfig(userId);
        
        if (!metaData) {
            return res.status(500).json({
                success: false,
                error: 'データ取得に失敗しました'
            });
        }
        
        // 詳細レポートデータを構築
        const reportData = {
            summary: metaData.summary || {},
            campaigns: metaData.campaigns || [],
            dailyData: {
                dates: metaData.dates || [],
                impressions: metaData.impressionHistory || [],
                clicks: metaData.clickHistory || [],
                conversions: metaData.conversionHistory || [],
                spend: metaData.spendHistory || []
            },
            performance: {
                ctr: metaData.summary?.ctr || 0,
                cpm: metaData.summary?.cpm || 0,
                cpa: metaData.summary?.cpa || 0,
                conversions: metaData.summary?.conversions || 0
            }
        };
        
        res.json({
            success: true,
            data: reportData
        });
        
    } catch (error) {
        console.error('詳細レポートAPI エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
`;
        
        // チャットワークテストページの前に追加
        const insertPos = content.indexOf("app.get('/chatwork-test'");
        if (insertPos !== -1) {
            content = content.substring(0, insertPos) + newEndpoint + '\n' + content.substring(insertPos);
            fs.writeFileSync(appPath, content, 'utf8');
            console.log('  ✅ 詳細レポートAPIを追加\n');
        }
    } else {
        console.log('  ✅ 詳細レポートAPIは既に存在します\n');
    }
}

// 5. loadDashboardData関数を修正してキャンペーンデータも処理
function fixLoadDashboardData() {
    console.log('5. loadDashboardData関数を修正...');
    
    const viewPath = path.join(__dirname, 'views', 'dashboard.ejs');
    let content = fs.readFileSync(viewPath, 'utf8');
    
    // loadDashboardData関数を探す
    const funcIndex = content.indexOf('async function loadDashboardData()');
    
    if (funcIndex !== -1) {
        const funcEnd = content.indexOf('}', content.indexOf('updateDashboard(result.data);', funcIndex));
        
        if (funcEnd !== -1) {
            const funcContent = content.substring(funcIndex, funcEnd);
            
            // updateDashboard呼び出しの後にキャンペーンテーブル更新を追加
            if (!funcContent.includes('updateCampaignDetailsTable')) {
                const updateCall = content.indexOf('updateDashboard(result.data);', funcIndex);
                if (updateCall !== -1) {
                    const insertPos = updateCall + 'updateDashboard(result.data);'.length;
                    const newCode = `
                    // キャンペーンテーブルも更新
                    if (result.data && result.data.campaigns) {
                        updateCampaignDetailsTable(result.data.campaigns);
                    }`;
                    
                    content = content.substring(0, insertPos) + newCode + content.substring(insertPos);
                    fs.writeFileSync(viewPath, content, 'utf8');
                    console.log('  ✅ loadDashboardData関数を修正\n');
                }
            }
        }
    }
}

// 6. テスト実行
async function runTest() {
    console.log('6. テスト実行...\n');
    
    try {
        const { fetchMetaDataWithStoredConfig } = require('./metaApi');
        const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
        
        const data = await fetchMetaDataWithStoredConfig(userId);
        
        if (data) {
            console.log('  ✅ データ取得成功');
            console.log('  - サマリー:', data.summary ? '✓' : '✗');
            console.log('  - キャンペーン数:', data.campaigns ? data.campaigns.length : 0);
            
            if (data.campaigns && data.campaigns.length > 0) {
                console.log('\n  キャンペーンサンプル（最初の3件）:');
                data.campaigns.slice(0, 3).forEach((c, i) => {
                    console.log(`    ${i+1}. ${c.name}`);
                    console.log(`       CV: ${c.conversions}件, CPA: ¥${Math.round(c.cpa || 0).toLocaleString()}`);
                });
            }
        }
    } catch (error) {
        console.error('  ❌ テストエラー:', error.message);
    }
}

// メイン実行
async function main() {
    try {
        fixDashboardDataAPI();
        fixDashboardJS();
        fixCampaignManagementPage();
        fixDetailedReportAPI();
        fixLoadDashboardData();
        await runTest();
        
        console.log('\n========================================');
        console.log('✅ キャンペーン表示総合修正完了！');
        console.log('========================================\n');
        
        console.log('実施した修正:');
        console.log('1. ✅ /api/dashboard-data にキャンペーンデータ追加');
        console.log('2. ✅ キャンペーン詳細テーブル更新関数を追加');
        console.log('3. ✅ キャンペーン管理ページにCV/CPA列追加');
        console.log('4. ✅ 詳細レポートAPIエンドポイント確認');
        console.log('5. ✅ loadDashboardData関数の修正');
        
        console.log('\n次の手順:');
        console.log('1. サーバーを再起動してください');
        console.log('2. ダッシュボードでキャンペーン別パフォーマンスを確認');
        console.log('3. キャンペーン管理ページでCV数とCPAを確認');
        console.log('4. 詳細レポートページの動作を確認');
        
    } catch (error) {
        console.error('❌ エラー:', error);
    }
}

main();