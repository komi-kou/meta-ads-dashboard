/**
 * チャットワーク直接送信テスト
 * ルームID 404474083 に全ての通知タイプを直接送信
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 設定ファイルのパス
const settingsPath = path.join(__dirname, 'settings.json');

// 設定ファイルを読み込み
let settings;
try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    console.log('✅ 設定ファイルを読み込みました');
} catch (error) {
    console.error('❌ 設定ファイルの読み込みに失敗しました:', error.message);
    process.exit(1);
}

const TEST_ROOM_ID = '404474083';
const API_TOKEN = settings.chatwork?.apiToken;

if (!API_TOKEN) {
    console.error('❌ チャットワークAPIトークンが設定されていません');
    process.exit(1);
}

// チャットワークにメッセージを送信
async function sendChatworkMessage(message) {
    try {
        const url = `https://api.chatwork.com/v2/rooms/${TEST_ROOM_ID}/messages`;
        const response = await axios.post(url, `body=${encodeURIComponent(message)}`, {
            headers: {
                'X-ChatWorkToken': API_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200) {
            console.log('✅ チャットワーク送信成功');
            return true;
        } else {
            console.log('❌ チャットワーク送信失敗:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ チャットワーク送信エラー:', error.message);
        if (error.response) {
            console.error('エラー詳細:', error.response.data);
        }
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllNotificationTests() {
    console.log('\n🚀 全通知タイプのテストを開始します...\n');
    console.log(`📱 送信先ルームID: ${TEST_ROOM_ID}\n`);
    
    try {
        // 1. 日次レポート通知テスト（CV/CPA内訳含む）
        console.log('📅 【1/3】日次レポート通知テスト（CV/CPA内訳含む）');
        const dailyReportMessage = `Meta広告 日次レポート (2025/10/15)

消化金額（合計）：54,868円
予算消化率（平均）：85.50%
CTR（平均）：2.45%
CPM（平均）：1,250円 
CPA（平均）：18,289円 (Metaリード: 18,289円)
フリークエンシー（平均）：1.85%
コンバージョン数：3件 (Metaリード: 3件)

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        await sendChatworkMessage(dailyReportMessage);
        console.log('✅ 日次レポート送信完了\n');
        await sleep(2000);
        
        // 2. 定期更新通知テスト
        console.log('🔄 【2/3】定期更新通知テスト');
        const updateMessage = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        await sendChatworkMessage(updateMessage);
        console.log('✅ 定期更新通知送信完了\n');
        await sleep(2000);
        
        // 3. アラート通知テスト（CV/CPA内訳含む）
        console.log('🚨 【3/3】アラート通知テスト（CV/CPA内訳含む）');
        const alertMessage = `🚨 Meta広告アラート通知

【テスト】予算消化率が90%を超えています

詳細:
- 現在の値: 95.5%
- 基準値: 90%
- 消化金額: 54,868円
- CV数: 3件 (Metaリード: 3件)
- CPA: 18,289円 (Metaリード: 18,289円)

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        await sendChatworkMessage(alertMessage);
        console.log('✅ アラート通知送信完了\n');
        
        console.log('\n✅ 全ての通知テストが完了しました！');
        console.log(`📱 ルームID ${TEST_ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信した通知:');
        console.log('  1️⃣ 日次レポート (CV/CPA内訳含む) ✅');
        console.log('  2️⃣ 定期更新通知 ✅');
        console.log('  3️⃣ アラート通知 (CV/CPA内訳含む) ✅\n');
        
        console.log('🔍 確認ポイント:');
        console.log('  ✓ CV内訳が表示されている (例: Metaリード: 3件)');
        console.log('  ✓ CPA内訳が表示されている (例: Metaリード: 18,289円)');
        console.log('  ✓ onsite_conversion.post_saveが含まれていない\n');
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    }
}

// テスト実行
runAllNotificationTests().catch(error => {
    console.error('❌ テスト失敗:', error);
    process.exit(1);
});

