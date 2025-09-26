// APIテスト用スクリプト
const http = require('http');

function testApi(endpoint, description) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: endpoint,
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    console.log(`\n=== ${description} ===`);
                    console.log('Status:', res.statusCode);
                    console.log('Success:', jsonData.success);
                    
                    if (endpoint === '/api/dashboard-data' && jsonData.success) {
                        console.log('Budget Rate:', jsonData.data.budgetRate);
                        console.log('Spend:', jsonData.data.spend);
                        console.log('Daily Budget:', jsonData.user?.targets?.dailyBudget);
                        console.log('Actual Budget Rate Calculation:', 
                            jsonData.data.spend && jsonData.user?.targets?.dailyBudget ? 
                            `${jsonData.data.spend} / ${jsonData.user.targets.dailyBudget} * 100 = ${(jsonData.data.spend / jsonData.user.targets.dailyBudget * 100).toFixed(2)}%` : 
                            'N/A');
                    }
                    
                    if (endpoint === '/api/alert-history' && jsonData.success) {
                        console.log('Alert History Count:', jsonData.history?.length || 0);
                        jsonData.history?.forEach((alert, index) => {
                            if (alert.metric === '予算消化率') {
                                console.log(`Alert ${index + 1}:`, alert.metric);
                                console.log('  Message:', alert.message);
                                console.log('  CheckItems Count:', alert.checkItems?.length || 0);
                            }
                        });
                    }
                    
                    resolve(jsonData);
                } catch (error) {
                    console.error('JSON Parse Error:', error);
                    console.log('Raw Response:', data);
                    reject(error);
                }
            });
        });

        req.on('error', (error) => {
            console.error(`Error testing ${endpoint}:`, error.message);
            reject(error);
        });

        req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.end();
    });
}

async function runTests() {
    console.log('=== API動作テスト開始 ===');
    
    try {
        // ダッシュボードAPIテスト
        await testApi('/api/dashboard-data', 'ダッシュボードAPI');
        
        // アラート履歴APIテスト
        await testApi('/api/alert-history', 'アラート履歴API');
        
        console.log('\n=== テスト完了 ===');
    } catch (error) {
        console.error('テストエラー:', error.message);
        console.log('\nサーバーが起動していることを確認してください: npm start');
    }
}

runTests();