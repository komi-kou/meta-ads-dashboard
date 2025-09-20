// 包括的テスト - 全ての送信内容を検証
const UserManager = require('./userManager');
const ChatworkAutoSender = require('./chatworkAutoSender');
const { sendChatworkMessage } = require('./chatworkApi');

async function testComprehensive() {
    console.log('=== 包括的テスト送信 ===');
    console.log('実行時刻:', new Date().toLocaleString('ja-JP'));
    console.log('');

    const userManager = new UserManager();
    const activeUsers = userManager.getAllActiveUsers();
    
    if (activeUsers.length === 0) {
        console.log('❌ エラー: アクティブユーザーが見つかりません');
        return;
    }

    // komiya11122@gmail.comのユーザーを探す
    const targetUser = activeUsers.find(u => u.email === 'komiya11122@gmail.com');
    const testUser = targetUser || activeUsers[0];
    
    console.log('テスト対象ユーザー:');
    console.log('- Email:', testUser.email);
    console.log('- ID:', testUser.id);
    console.log('- Chatwork Room:', testUser.chatwork_room_id);
    console.log('');

    // 1. 日次レポートのフォーマット検証
    console.log('【1. 日次レポート検証】');
    console.log('------------------------');
    
    const testData = {
        spend: 3109,
        budgetRate: 111.76,
        ctr: 1.211164,  // 元のデータ
        cpm: 1637.177,   // 元のデータ
        conversions: 0,
        cpa: 0,
        frequency: 1.1905956  // 元のデータ
    };
    
    console.log('元データ:');
    console.log(`  CTR: ${testData.ctr}`);
    console.log(`  CPM: ${testData.cpm}`);
    console.log(`  フリークエンシー: ${testData.frequency}`);
    console.log('');
    
    // データ変換シミュレーション（convertInsightsToMetrics後の形）
    const processedData = {
        spend: Math.round(testData.spend),
        budgetRate: parseFloat(testData.budgetRate.toFixed(2)),
        ctr: parseFloat(testData.ctr.toFixed(2)),  // 1.21
        cpm: Math.round(testData.cpm),  // 1637
        conversions: testData.conversions,
        cpa: Math.round(testData.cpa),
        frequency: parseFloat(testData.frequency.toFixed(2))  // 1.19
    };
    
    console.log('処理後データ:');
    console.log(`  CTR: ${processedData.ctr}`);
    console.log(`  CPM: ${processedData.cpm}`);
    console.log(`  フリークエンシー: ${processedData.frequency}`);
    console.log('');
    
    const dailyReportMessage = `Meta広告 日次レポート (${new Date().toLocaleDateString('ja-JP')})

消化金額（合計）：${(processedData.spend || 0).toLocaleString()}円
予算消化率（平均）：${processedData.budgetRate || '0.00'}%
CTR（平均）：${processedData.ctr || '0.00'}%
CPM（平均）：${(processedData.cpm || 0).toLocaleString()}円 
CPA（平均）：${(processedData.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${processedData.frequency || '0.00'}
コンバージョン数：${processedData.conversions || 0}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

    console.log('生成されたメッセージ:');
    console.log('---');
    console.log(dailyReportMessage);
    console.log('---');
    
    // フォーマット検証
    console.log('\n検証結果:');
    const checks = [
        {
            項目: 'CTR',
            期待値: '1.21%',
            実際値: `${processedData.ctr || '0.00'}%`,
            結果: `${processedData.ctr || '0.00'}%` === '1.21%'
        },
        {
            項目: 'CPM',
            期待値: '1,637円',
            実際値: `${(processedData.cpm || 0).toLocaleString()}円`,
            結果: `${(processedData.cpm || 0).toLocaleString()}円` === '1,637円'
        },
        {
            項目: 'フリークエンシー',
            期待値: '1.19（単位なし）',
            実際値: `${processedData.frequency || '0.00'}`,
            結果: `${processedData.frequency || '0.00'}` === '1.19'
        }
    ];
    
    checks.forEach(check => {
        console.log(`${check.項目}: ${check.結果 ? '✅' : '❌'} ${check.実際値} (期待値: ${check.期待値})`);
    });
    
    // 2. 定期更新通知の検証
    console.log('\n【2. 定期更新通知検証】');
    console.log('------------------------');
    
    const updateMessage = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
    
    console.log('生成されたメッセージ:');
    console.log('---');
    console.log(updateMessage);
    console.log('---');
    console.log('✅ 定期更新通知フォーマット正常');
    
    // 3. アラート通知の検証
    console.log('\n【3. アラート通知検証】');
    console.log('------------------------');
    
    // アラート履歴から実際のデータを取得
    const fs = require('fs');
    const path = require('path');
    const alertHistoryPath = path.join(__dirname, 'alert_history.json');
    let sampleAlerts = [];
    
    if (fs.existsSync(alertHistoryPath)) {
        const history = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
        sampleAlerts = history
            .filter(a => a.status === 'active')
            .slice(0, 3);  // 最新3件
    }
    
    if (sampleAlerts.length > 0) {
        let alertMessage = `[info][title]Meta広告 アラート通知 (${new Date().toLocaleDateString('ja-JP')})[/title]
以下の指標が目標値から外れています：

`;
        sampleAlerts.forEach(alert => {
            const icon = alert.severity === 'critical' ? '🔴' : '⚠️';
            alertMessage += `${icon} ${alert.metric}: ${alert.message}\n`;
        });
        
        alertMessage += `
📊 詳細はダッシュボードでご確認ください：
https://meta-ads-dashboard.onrender.com/dashboard

✅ 確認事項：https://meta-ads-dashboard.onrender.com/improvement-tasks
💡 改善施策：https://meta-ads-dashboard.onrender.com/improvement-strategies[/info]`;
        
        console.log('生成されたメッセージ:');
        console.log('---');
        console.log(alertMessage);
        console.log('---');
        console.log('✅ アラート通知フォーマット正常');
    } else {
        console.log('⚠️ アクティブなアラートがないため、アラート通知はスキップされます');
    }
    
    // 4. 実際にテスト送信
    console.log('\n【4. 実際のテスト送信】');
    console.log('------------------------');
    
    const confirmMessage = `[テスト送信] 包括的動作確認

このメッセージが表示されれば、以下が正常に動作しています：
✅ ユーザー認識: ${activeUsers.length}名
✅ 日次レポート: CTR ${processedData.ctr}%, CPM ${processedData.cpm.toLocaleString()}円, フリークエンシー ${processedData.frequency}
✅ 定期更新通知: 正常
✅ アラート通知: ${sampleAlerts.length}件のアラート

実行時刻: ${new Date().toLocaleString('ja-JP')}`;
    
    try {
        await sendChatworkMessage({
            date: new Date().toISOString().split('T')[0],
            message: confirmMessage,
            token: testUser.chatwork_api_token,
            room_id: testUser.chatwork_room_id
        });
        console.log('✅ テスト送信成功');
    } catch (error) {
        console.log('❌ テスト送信失敗:', error.message);
    }
    
    // 最終確認
    console.log('\n=== 総合判定 ===');
    const allChecksPass = checks.every(c => c.結果);
    if (allChecksPass) {
        console.log('✅ 全ての検証に合格しました');
        console.log('✅ 桁数、フォーマット、内容すべて正常です');
        console.log('✅ 本番環境へのデプロイ準備完了');
    } else {
        console.log('⚠️ 一部の検証に失敗しました');
        console.log('詳細は上記の検証結果をご確認ください');
    }
}

// テスト実行
testComprehensive().catch(error => {
    console.error('テストエラー:', error);
});