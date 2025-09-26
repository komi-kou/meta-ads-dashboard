// 最終目視確認スクリプト
const axios = require('axios');

const BASE_URL = 'http://localhost:3457';
const TEST_EMAIL = 'hangpingxiaogong@gmail.com';
const TEST_PASSWORD = 'kmykuhi1215K';

let cookies = '';

// カラー出力用
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
};

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
        
        console.log(`${colors.green}✅ ログイン成功${colors.reset}`);
        return true;
    } catch (error) {
        console.error(`${colors.red}❌ ログイン失敗: ${error.message}${colors.reset}`);
        return false;
    }
}

// ページアクセステスト
async function testPageAccess() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}1️⃣ ページアクセステスト${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    try {
        const response = await axios.get(`${BASE_URL}/detailed-reports`, {
            headers: { Cookie: cookies },
            maxRedirects: 5
        });
        
        if (response.status === 200) {
            console.log(`${colors.green}✅ 詳細レポートページにアクセス可能${colors.reset}`);
            
            // ページ内の要素確認
            const html = response.data;
            const hasLoadFunction = html.includes('loadDetailedReport');
            const hasChartElements = html.includes('regionChart');
            const hasFilters = html.includes('campaignFilter');
            
            console.log(`   JavaScript関数: ${hasLoadFunction ? '✅' : '❌'}`);
            console.log(`   チャート要素: ${hasChartElements ? '✅' : '❌'}`);
            console.log(`   フィルター要素: ${hasFilters ? '✅' : '❌'}`);
            
            return true;
        } else {
            console.log(`${colors.red}❌ ページアクセスエラー: ${response.status}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ ページアクセス失敗: ${error.message}${colors.reset}`);
        return false;
    }
}

// 初期データ読み込みテスト
async function testInitialDataLoad() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}2️⃣ 初期データ読み込みテスト${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    try {
        // すべてのキャンペーンで地域別データを取得
        const response = await axios.get(`${BASE_URL}/api/detailed-report`, {
            params: {
                campaign_id: 'all',
                period: 'last_7d',
                breakdown_type: 'region'
            },
            headers: { Cookie: cookies }
        });
        
        const data = response.data;
        
        if (data.success) {
            console.log(`${colors.green}✅ 初期データ読み込み成功${colors.reset}`);
            console.log(`   キャンペーン名: ${data.campaignName || 'すべて'}`);
            console.log(`   分析対象: ${data.campaignsAnalyzed}件`);
            console.log(`   総広告費: ¥${(data.statistics?.totalSpend || 0).toLocaleString()}`);
            console.log(`   データタイプ: ${data.dataSource}`);
            
            if (data.regionData && Object.keys(data.regionData).length > 0) {
                console.log(`   ${colors.green}✅ 地域データあり: ${Object.keys(data.regionData).join(', ')}${colors.reset}`);
            } else {
                console.log(`   ${colors.yellow}⚠️ 地域データなし${colors.reset}`);
            }
            
            return true;
        } else {
            console.log(`${colors.red}❌ データ読み込み失敗: ${data.error}${colors.reset}`);
            return false;
        }
    } catch (error) {
        console.log(`${colors.red}❌ API呼び出し失敗: ${error.message}${colors.reset}`);
        return false;
    }
}

// 個別キャンペーンテスト
async function testIndividualCampaign() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}3️⃣ 個別キャンペーンテスト${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    try {
        // まずキャンペーン一覧を取得
        const listResponse = await axios.get(`${BASE_URL}/api/campaigns/details`, {
            params: { period: 'last_7d' },
            headers: { Cookie: cookies }
        });
        
        if (listResponse.data.success && listResponse.data.campaigns.length > 0) {
            const firstCampaign = listResponse.data.campaigns[0];
            console.log(`   テスト対象: ${firstCampaign.name} (ID: ${firstCampaign.id})`);
            
            // デバイス別データを取得
            const response = await axios.get(`${BASE_URL}/api/detailed-report`, {
                params: {
                    campaign_id: firstCampaign.id,
                    period: 'last_7d',
                    breakdown_type: 'device_platform'
                },
                headers: { Cookie: cookies }
            });
            
            const data = response.data;
            
            if (data.success) {
                console.log(`${colors.green}✅ 個別キャンペーンデータ取得成功${colors.reset}`);
                console.log(`   キャンペーン名: ${data.campaignName}`);
                console.log(`   総広告費: ¥${(data.statistics?.totalSpend || 0).toLocaleString()}`);
                
                if (data.deviceData && Object.keys(data.deviceData).length > 0) {
                    console.log(`   ${colors.green}✅ デバイスデータあり:${colors.reset}`);
                    Object.entries(data.deviceData).slice(0, 3).forEach(([device, stats]) => {
                        console.log(`      ${device}: ¥${Math.round(stats.spend || 0).toLocaleString()}`);
                    });
                }
                
                return true;
            }
        }
        
        return false;
    } catch (error) {
        console.log(`${colors.red}❌ テスト失敗: ${error.message}${colors.reset}`);
        return false;
    }
}

// 表示確認チェックリスト
function showChecklist() {
    console.log(`\n${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.blue}📋 目視確認チェックリスト${colors.reset}`);
    console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    console.log('\n1. ブラウザで http://localhost:3457 にアクセス');
    console.log('2. ユーザー名: hangpingxiaogong@gmail.com');
    console.log('3. パスワード: kmykuhi1215K');
    console.log('4. ログイン後、サイドバーから「📈 詳細レポート」をクリック');
    console.log('\n確認項目:');
    console.log('□ ページが正常に表示される');
    console.log('□ 「データを読み込み中...」が消えて、実際のデータが表示される');
    console.log('□ グラフ（地域別・デバイス別）が表示される');
    console.log('□ 統計サマリー（総広告費、CV数、CPA、CTR）が表示される');
    console.log('□ 詳細データテーブルが表示される');
    console.log('□ キャンペーンドロップダウンに30件のキャンペーンが表示される');
    console.log('□ 「レポート生成」ボタンをクリックすると新しいデータが表示される');
    console.log('□ 個別キャンペーンを選択すると、そのキャンペーンのデータが表示される');
}

// メイン実行
async function main() {
    console.log(`${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}📈 詳細レポート最終動作確認${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}\n`);
    
    // ログイン
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log(`\n${colors.red}❌ ログインに失敗したため、テストを中止します${colors.reset}`);
        process.exit(1);
    }
    
    // 各種テスト実行
    const pageAccessOK = await testPageAccess();
    const initialDataOK = await testInitialDataLoad();
    const individualOK = await testIndividualCampaign();
    
    // 結果サマリー
    console.log(`\n${colors.blue}========================================${colors.reset}`);
    console.log(`${colors.blue}🎯 テスト結果サマリー${colors.reset}`);
    console.log(`${colors.blue}========================================${colors.reset}`);
    
    console.log(`\nページアクセス: ${pageAccessOK ? '✅ 正常' : '❌ エラー'}`);
    console.log(`初期データ読み込み: ${initialDataOK ? '✅ 正常' : '❌ エラー'}`);
    console.log(`個別キャンペーン: ${individualOK ? '✅ 正常' : '❌ エラー'}`);
    
    if (pageAccessOK && initialDataOK && individualOK) {
        console.log(`\n${colors.green}✨ すべてのテストが正常に完了しました！${colors.reset}`);
        console.log(`${colors.green}詳細レポート機能は正常に動作しています。${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️ 一部のテストで問題が検出されました${colors.reset}`);
    }
    
    // 目視確認チェックリスト表示
    showChecklist();
}

main().catch(console.error);