// 修正内容の検証スクリプト
const axios = require('axios');

const BASE_URL = 'http://localhost:3457';
const TEST_EMAIL = 'hangpingxiaogong@gmail.com';
const TEST_PASSWORD = 'kmykuhi1215K';

let cookies = '';

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

// キャンペーン詳細API確認
async function testCampaignDetailsAPI() {
    console.log('\n=== /api/campaigns/details テスト ===');
    
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
        
        if (!data.campaigns || !Array.isArray(data.campaigns)) {
            console.log('❌ キャンペーンデータが存在しません');
            return false;
        }
        
        console.log(`✅ ${data.campaigns.length}件のキャンペーンデータ取得成功`);
        
        // 最初の3件を詳細表示
        data.campaigns.slice(0, 3).forEach((campaign, index) => {
            console.log(`\n  キャンペーン${index + 1}: ${campaign.name}`);
            console.log(`    - 広告費: ¥${campaign.spend?.toLocaleString() || 0}`);
            console.log(`    - CV数: ${campaign.conversions || 0}件`);
            console.log(`    - CPA: ${campaign.conversions > 0 ? `¥${campaign.cpa?.toLocaleString()}` : '-'}`);
            console.log(`    - CTR: ${campaign.ctr?.toFixed(2) || 0}%`);
            console.log(`    - CPM: ¥${campaign.cpm?.toLocaleString() || 0}`);
        });
        
        // CV数とCPAの検証
        let hasConversions = false;
        let hasCPA = false;
        
        data.campaigns.forEach(campaign => {
            if (campaign.conversions && campaign.conversions > 0) {
                hasConversions = true;
            }
            if (campaign.cpa && campaign.cpa > 0) {
                hasCPA = true;
            }
        });
        
        console.log('\n  検証結果:');
        console.log(`    - CV数データ: ${hasConversions ? '✅ あり' : '⚠️ なし'}`);
        console.log(`    - CPAデータ: ${hasCPA ? '✅ あり' : '⚠️ なし'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ API呼び出しエラー:', error.message);
        if (error.response) {
            console.log('  応答:', error.response.data);
        }
        return false;
    }
}

// 詳細レポートAPI確認
async function testDetailedReportAPI() {
    console.log('\n=== /api/detailed-report テスト ===');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/detailed-report`, {
            params: { period: 'last_7d' },
            headers: { Cookie: cookies }
        });
        
        const data = response.data;
        
        if (!data.success) {
            console.log('❌ APIが失敗を返しました');
            return false;
        }
        
        console.log('✅ 詳細レポートAPI応答確認');
        console.log('  - 地域データ:', data.regionData ? '✅' : '❌');
        console.log('  - デバイスデータ:', data.deviceData ? '✅' : '❌');
        console.log('  - 時間帯別データ:', data.hourlyData ? '✅' : '❌');
        console.log('  - 統計情報:', data.statistics ? '✅' : '❌');
        
        return true;
        
    } catch (error) {
        console.error('❌ API呼び出しエラー:', error.message);
        return false;
    }
}

// ダッシュボードデータAPI確認
async function testDashboardDataAPI() {
    console.log('\n=== /api/dashboard-data テスト ===');
    
    try {
        const response = await axios.get(`${BASE_URL}/api/dashboard-data`, {
            headers: { Cookie: cookies }
        });
        
        const data = response.data;
        
        if (!data.success) {
            console.log('❌ APIが失敗を返しました');
            return false;
        }
        
        console.log('✅ ダッシュボードAPI応答確認');
        console.log('  - キャンペーンデータ:', data.campaigns ? `${data.campaigns.length}件` : 'なし');
        console.log('  - 消化金額:', data.data?.spend ? `¥${data.data.spend.toLocaleString()}` : 'なし');
        console.log('  - CV数:', data.data?.conversions || 0);
        console.log('  - CPA:', data.data?.cpa ? `¥${data.data.cpa.toLocaleString()}` : 'なし');
        
        return true;
        
    } catch (error) {
        console.error('❌ API呼び出しエラー:', error.message);
        return false;
    }
}

// メイン実行
async function main() {
    console.log('=== Meta広告ダッシュボード修正検証 ===\n');
    
    // ログイン
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ ログインに失敗したため、検証を中止します');
        process.exit(1);
    }
    
    // 各APIテスト
    const results = {
        campaigns: await testCampaignDetailsAPI(),
        dashboard: await testDashboardDataAPI(),
        detailed: await testDetailedReportAPI()
    };
    
    // 結果サマリー
    console.log('\n========================================');
    console.log('📊 検証結果サマリー');
    console.log('========================================');
    console.log(`  キャンペーン詳細API: ${results.campaigns ? '✅ 正常' : '❌ エラー'}`);
    console.log(`  ダッシュボードAPI: ${results.dashboard ? '✅ 正常' : '❌ エラー'}`);
    console.log(`  詳細レポートAPI: ${results.detailed ? '✅ 正常' : '❌ エラー'}`);
    
    const allPassed = Object.values(results).every(r => r);
    
    if (allPassed) {
        console.log('\n✨ すべての修正が正常に動作しています！');
    } else {
        console.log('\n⚠️ 一部の機能に問題があります。');
    }
    
    console.log('\n📝 推奨事項:');
    console.log('  1. ブラウザで http://localhost:3457/dashboard を開く');
    console.log('  2. キャンペーン別パフォーマンスセクションでCV数とCPAを確認');
    console.log('  3. キャンペーン管理ページ（/campaigns）でCV数とCPAを確認');
    console.log('  4. 詳細レポートページ（/detailed-reports）の動作を確認');
}

main().catch(console.error);