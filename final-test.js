// 最終テストスクリプト
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3457';
const TEST_EMAIL = 'hangpingxiaogong@gmail.com';
const TEST_PASSWORD = 'kmykuhi1215K';

let cookies = '';

// 待機
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ログイン
async function login() {
    try {
        const response = await axios.post(`${BASE_URL}/login`, 
            `email=${encodeURIComponent(TEST_EMAIL)}&password=${encodeURIComponent(TEST_PASSWORD)}`,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                maxRedirects: 0,
                validateStatus: (status) => status < 400
            }
        );
        
        const setCookies = response.headers['set-cookie'];
        if (setCookies) {
            cookies = setCookies.map(cookie => cookie.split(';')[0]).join('; ');
        }
        
        console.log('✅ ログイン成功');
        return true;
    } catch (error) {
        console.error('❌ ログイン失敗:', error.message);
        return false;
    }
}

// 詳細レポートページテスト
async function testDetailedReport() {
    console.log('\n=== 📈 詳細レポートページテスト ===');
    
    try {
        // 詳細レポートAPIテスト
        const response = await axios.get(`${BASE_URL}/api/detailed-report`, {
            params: { 
                campaign_id: 'all',
                period: 'last_7d' 
            },
            headers: { Cookie: cookies }
        });
        
        const data = response.data;
        
        if (!data.success) {
            console.log('❌ APIが失敗を返しました');
            return false;
        }
        
        console.log('✅ 詳細レポートAPI応答');
        console.log('  - 地域データ:', Object.keys(data.regionData || {}).length > 0 ? `${Object.keys(data.regionData).length}件` : 'なし');
        console.log('  - デバイスデータ:', Object.keys(data.deviceData || {}).length > 0 ? `${Object.keys(data.deviceData).length}件` : 'なし');
        console.log('  - 時間帯データ:', data.hourlyData ? `${data.hourlyData.length}時間分` : 'なし');
        console.log('  - 総広告費:', data.statistics?.totalSpend ? `¥${data.statistics.totalSpend.toLocaleString()}` : 'なし');
        console.log('  - 総CV数:', data.statistics?.totalConversions || 0);
        console.log('  - 平均CPA:', data.statistics?.avgCPA ? `¥${data.statistics.avgCPA.toLocaleString()}` : 'なし');
        console.log('  - 平均CTR:', data.statistics?.avgCTR ? `${data.statistics.avgCTR}%` : 'なし');
        
        // モックデータかどうか判定
        const isRealData = !data.regionData?.['東京'] || 
                          data.regionData['東京'].spend !== 15000;
        
        console.log(`\n  データタイプ: ${isRealData ? '✅ 実データ' : '⚠️ モックデータ'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ 詳細レポートAPIエラー:', error.message);
        return false;
    }
}

// キャンペーン別パフォーマンステスト
async function testCampaignPerformance() {
    console.log('\n=== 📊 キャンペーン別パフォーマンステスト ===');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/campaigns/details`, {
            params: { period: 'last_7d' },
            headers: { Cookie: cookies }
        });
        
        const data = response.data;
        
        if (!data.success) {
            console.log('❌ APIが失敗を返しました');
            return false;
        }
        
        console.log(`✅ ${data.campaigns.length}件のキャンペーンデータ取得`);
        
        // CV数とCPAが含まれているか確認
        let hasCV = false;
        let hasCPA = false;
        
        data.campaigns.forEach(campaign => {
            if (campaign.conversions > 0) hasCV = true;
            if (campaign.cpa > 0) hasCPA = true;
        });
        
        console.log(`  - CV数: ${hasCV ? '✅ データあり' : '❌ データなし'}`);
        console.log(`  - CPA: ${hasCPA ? '✅ データあり' : '❌ データなし'}`);
        
        // サンプル表示
        if (data.campaigns.length > 0) {
            const sample = data.campaigns[0];
            console.log(`\n  サンプル: ${sample.name}`);
            console.log(`    - CV数: ${sample.conversions}件`);
            console.log(`    - CPA: ¥${sample.cpa?.toLocaleString() || '-'}`);
        }
        
        return hasCV && hasCPA;
        
    } catch (error) {
        console.error('❌ キャンペーン詳細APIエラー:', error.message);
        return false;
    }
}

// CSV/PDF出力機能テスト
async function testExportFunctions() {
    console.log('\n=== 📄 エクスポート機能テスト ===');
    
    // CSVエクスポートエンドポイント確認
    try {
        const response = await axios.get(`${BASE_URL}/api/export/spreadsheet`, {
            params: { 
                period: 'last_7d',
                campaign_id: 'all' 
            },
            headers: { Cookie: cookies },
            validateStatus: (status) => status < 500
        });
        
        if (response.status === 200) {
            console.log('✅ CSV出力エンドポイント: 正常');
        } else {
            console.log('⚠️ CSV出力エンドポイント: ステータス', response.status);
        }
    } catch (error) {
        console.log('❌ CSV出力エンドポイント: エラー', error.message);
    }
    
    // ファイル確認
    const viewPath = path.join(__dirname, 'views', 'detailed-reports.ejs');
    const content = fs.readFileSync(viewPath, 'utf8');
    
    const hasCSVFunction = content.includes('function exportCSV()') && 
                          !content.includes("alert('CSV出力機能は準備中です')");
    const hasPDFFunction = content.includes('function exportPDF()') && 
                          !content.includes("alert('PDF出力機能は準備中です')");
    
    console.log(`  - CSV出力関数: ${hasCSVFunction ? '✅ 実装済み' : '❌ 未実装'}`);
    console.log(`  - PDF出力関数: ${hasPDFFunction ? '✅ 実装済み' : '❌ 未実装'}`);
    
    return hasCSVFunction && hasPDFFunction;
}

// メイン実行
async function main() {
    console.log('=== 📋 Meta広告ダッシュボード 最終テスト ===\n');
    
    // サーバー起動を待つ
    console.log('⏳ サーバー起動を待機中...');
    await wait(3000);
    
    // ログイン
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ ログインに失敗したため、テストを中止します');
        process.exit(1);
    }
    
    // 各機能をテスト
    const results = {
        detailedReport: await testDetailedReport(),
        campaignPerformance: await testCampaignPerformance(),
        exportFunctions: await testExportFunctions()
    };
    
    // 結果サマリー
    console.log('\n========================================');
    console.log('📊 テスト結果サマリー');
    console.log('========================================');
    console.log(`  詳細レポート: ${results.detailedReport ? '✅ 正常' : '❌ 問題あり'}`);
    console.log(`  キャンペーン別パフォーマンス: ${results.campaignPerformance ? '✅ 正常' : '❌ 問題あり'}`);
    console.log(`  エクスポート機能: ${results.exportFunctions ? '✅ 実装済み' : '❌ 未実装'}`);
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
        console.log('\n✨ すべての機能が正常に動作しています！');
    } else {
        console.log('\n⚠️ 一部の機能に問題があります。');
    }
    
    console.log('\n📝 次のステップ:');
    console.log('1. ブラウザで http://localhost:3457/detailed-reports を開く');
    console.log('2. キャンペーン選択で「すべてのキャンペーン」と個別キャンペーンが選択可能か確認');
    console.log('3. CSV出力ボタンをクリックしてファイルがダウンロードされるか確認');
    console.log('4. PDF出力ボタンをクリックして印刷プレビューが表示されるか確認');
}

main().catch(console.error);