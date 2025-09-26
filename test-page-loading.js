// 詳細レポートページの読み込み確認スクリプト
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

// ページの読み込みを確認
async function checkPageLoading() {
    try {
        console.log('\n📄 詳細レポートページを取得中...');
        
        const response = await axios.get(`${BASE_URL}/detailed-reports`, {
            headers: { 
                Cookie: cookies,
                'Accept': 'text/html,application/xhtml+xml'
            }
        });
        
        const html = response.data;
        
        // JavaScriptエラーをチェック
        if (html.includes('Uncaught SyntaxError') || html.includes('Uncaught ReferenceError')) {
            console.log('❌ ページにJavaScriptエラーが含まれています');
        } else {
            console.log('✅ ページが正常に読み込まれました');
        }
        
        // 必要な要素の存在確認
        const hasCharts = html.includes('regionChart') && html.includes('deviceChart');
        const hasTables = html.includes('detailTableContainer');
        const hasFilters = html.includes('campaignFilter') && html.includes('breakdownType');
        
        console.log(`   チャート要素: ${hasCharts ? '✅' : '❌'}`);
        console.log(`   テーブル要素: ${hasTables ? '✅' : '❌'}`);
        console.log(`   フィルター要素: ${hasFilters ? '✅' : '❌'}`);
        
        // loadDetailedReport関数の確認
        const loadFuncCount = (html.match(/function loadDetailedReport/g) || []).length;
        console.log(`   loadDetailedReport関数の定義数: ${loadFuncCount}`);
        
        if (loadFuncCount > 1) {
            console.log('   ⚠️ 関数が重複定義されています');
        }
        
        return true;
    } catch (error) {
        console.error('❌ ページ読み込みエラー:', error.message);
        return false;
    }
}

// APIが正常に動作するか確認
async function checkAPI() {
    try {
        console.log('\n🔄 詳細レポートAPIをテスト中...');
        
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
            console.log('✅ APIが正常に応答しました');
            console.log(`   キャンペーン数: ${data.campaignsAnalyzed || 0}件`);
            console.log(`   総広告費: ¥${(data.statistics?.totalSpend || 0).toLocaleString()}`);
            console.log(`   データソース: ${data.dataSource || 'unknown'}`);
        } else {
            console.log('❌ APIがエラーを返しました:', data.error);
        }
        
        return data.success;
    } catch (error) {
        console.error('❌ API呼び出しエラー:', error.message);
        return false;
    }
}

// メイン実行
async function main() {
    console.log('=== 詳細レポートページ読み込み確認 ===\n');
    
    // ログイン
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ ログインに失敗したため、テストを中止します');
        process.exit(1);
    }
    
    // ページ読み込み確認
    await checkPageLoading();
    
    // API確認
    await checkAPI();
    
    console.log('\n========================================');
    console.log('診断結果:');
    console.log('========================================');
    console.log('\n📝 推奨事項:');
    console.log('1. ブラウザで http://localhost:3457/detailed-reports を開く');
    console.log('2. ブラウザのコンソール (F12) でエラーを確認');
    console.log('3. ネットワークタブでAPI呼び出しを確認');
    console.log('4. 「レポート生成」ボタンをクリックして動作確認');
}

main().catch(console.error);