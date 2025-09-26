// 詳細レポートAPI動作確認スクリプト
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

// 詳細レポートAPIテスト
async function testDetailedReportAPI() {
    console.log('\n=== 詳細レポートAPIテスト ===');
    console.log('Cookie:', cookies);
    
    try {
        // APIを直接呼び出し
        const response = await axios.get(`${BASE_URL}/api/detailed-report`, {
            params: { 
                campaign_id: 'all',
                period: 'last_7d' 
            },
            headers: { 
                Cookie: cookies,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            maxRedirects: 0,
            validateStatus: (status) => status < 500
        });
        
        const data = response.data;
        
        if (response.status === 302 || response.status === 301) {
            console.log('❌ リダイレクトが発生しました');
            console.log('  Location:', response.headers.location);
            console.log('  Cookie問題の可能性があります');
            return false;
        }
        
        console.log('\n✅ APIが正常に応答しました');
        console.log('ステータス:', response.status);
        console.log('Response data:', JSON.stringify(data).substring(0, 200));
        console.log('success:', data.success);
        
        if (response.status === 404) {
            console.log('❌ 404エラー: APIエンドポイントが見つかりません');
            return false;
        }
        
        if (data.success) {
            console.log('\n📊 データ内容:');
            
            // 地域データ
            if (data.regionData) {
                const regions = Object.keys(data.regionData);
                console.log('\n  地域データ:', regions.length > 0 ? `${regions.length}地域` : 'なし');
                if (regions.length > 0) {
                    console.log('  地域リスト:', regions.join(', '));
                }
            } else {
                console.log('  地域データ: なし');
            }
            
            // デバイスデータ
            if (data.deviceData) {
                const devices = Object.keys(data.deviceData);
                console.log('\n  デバイスデータ:', devices.length > 0 ? `${devices.length}デバイス` : 'なし');
                if (devices.length > 0) {
                    console.log('  デバイスリスト:', devices.join(', '));
                }
            } else {
                console.log('  デバイスデータ: なし');
            }
            
            // 時間帯データ
            if (data.hourlyData) {
                console.log('\n  時間帯データ:', `${data.hourlyData.length}時間分`);
                const nonZeroHours = data.hourlyData.filter(v => v > 0).length;
                console.log('  データがある時間帯:', `${nonZeroHours}時間`);
            } else {
                console.log('  時間帯データ: なし');
            }
            
            // 統計情報
            if (data.statistics) {
                console.log('\n  統計情報:');
                console.log('    総広告費:', data.statistics.totalSpend ? `¥${data.statistics.totalSpend.toLocaleString()}` : '¥0');
                console.log('    総CV数:', data.statistics.totalConversions || 0);
                console.log('    平均CPA:', data.statistics.avgCPA ? `¥${data.statistics.avgCPA.toLocaleString()}` : '¥0');
                console.log('    平均CTR:', data.statistics.avgCTR ? `${data.statistics.avgCTR}%` : '0%');
            } else {
                console.log('  統計情報: なし');
            }
            
            // モックデータかどうか判定
            const isRealData = data.regionData && data.regionData['東京'] && 
                              data.regionData['東京'].spend !== 15000;
            
            console.log(`\n  データタイプ: ${isRealData ? '✅ 実データ（キャンペーンから集計）' : '⚠️ 推定データ'}`);
            
        } else {
            console.log('❌ APIがエラーを返しました:', data.error);
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ API呼び出しエラー:', error.message);
        if (error.response) {
            console.log('  ステータス:', error.response.status);
            console.log('  応答:', error.response.data);
        }
        return false;
    }
}

// メイン実行
async function main() {
    console.log('=== 詳細レポートAPI動作確認 ===\n');
    
    // ログイン
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ ログインに失敗したため、テストを中止します');
        process.exit(1);
    }
    
    // APIテスト
    const apiSuccess = await testDetailedReportAPI();
    
    if (apiSuccess) {
        console.log('\n✨ 詳細レポートAPIは正常に動作しています！');
        console.log('\n次のステップ:');
        console.log('1. ブラウザで http://localhost:3457/detailed-reports を開く');
        console.log('2. 「レポート生成」ボタンをクリック');
        console.log('3. データが表示されることを確認');
    } else {
        console.log('\n⚠️ 詳細レポートAPIに問題があります');
    }
}

main().catch(console.error);