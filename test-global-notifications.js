/**
 * グローバル設定を使用した全スケジュール通知テスト
 * settings.jsonのチャットワーク設定を使用
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

const API_TOKEN = settings.chatwork?.apiToken;
const ROOM_ID = settings.chatwork?.roomId;

if (!API_TOKEN || !ROOM_ID) {
    console.error('❌ チャットワーク設定が不完全です');
    process.exit(1);
}

console.log(`\n📱 送信先ルームID: ${ROOM_ID}`);
console.log(`🔑 APIトークン: ${API_TOKEN.substring(0, 10)}...\n`);

// チャットワークにメッセージを送信
async function sendChatworkMessage(message, title) {
    try {
        console.log(`📤 送信中: ${title}`);
        const url = `https://api.chatwork.com/v2/rooms/${ROOM_ID}/messages`;
        const response = await axios.post(url, `body=${encodeURIComponent(message)}`, {
            headers: {
                'X-ChatWorkToken': API_TOKEN,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.status === 200) {
            console.log(`✅ ${title} 送信成功\n`);
            return true;
        } else {
            console.log(`❌ ${title} 送信失敗:`, response.status, '\n');
            return false;
        }
    } catch (error) {
        console.error(`❌ ${title} 送信エラー:`, error.message);
        if (error.response) {
            console.error('エラー詳細:', error.response.data);
        }
        console.log('');
        return false;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runAllScheduledNotifications() {
    console.log('🕐 全スケジュール通知のテストを開始します...\n');
    console.log('📅 スケジュール:');
    console.log('  - 9時: 日次レポート + アラート通知');
    console.log('  - 12時: 定期更新通知 + アラート通知');
    console.log('  - 15時: 定期更新通知 + アラート通知');
    console.log('  - 17時: 定期更新通知 + アラート通知');
    console.log('  - 19時: 定期更新通知 + アラート通知\n');
    console.log('═══════════════════════════════════════════════════\n');
    
    let successCount = 0;
    let failCount = 0;
    
    try {
        // ===== 9時の通知 =====
        console.log('🕘 【9時の通知】\n');
        
        // 1. 日次レポート（CV/CPA内訳含む）
        const dailyReport = `Meta広告 日次レポート (2025/10/15)

消化金額（合計）：54,868円
予算消化率（平均）：85.50%
CTR（平均）：2.45%
CPM（平均）：1,250円 
CPA（平均）：18,289円 (Metaリード: 18,289円)
フリークエンシー（平均）：1.85%
コンバージョン数：3件 (Metaリード: 3件)

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        if (await sendChatworkMessage(dailyReport, '【9時】日次レポート')) successCount++; else failCount++;
        await sleep(2000);
        
        // 2. アラート通知（CV/CPA内訳含む）
        const alert9h = `🚨 Meta広告アラート通知

【テスト】予算消化率が90%を超えています

詳細:
- 現在の値: 95.5%
- 基準値: 90%
- 消化金額: 54,868円
- CV数: 3件 (Metaリード: 3件)
- CPA: 18,289円 (Metaリード: 18,289円)

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        if (await sendChatworkMessage(alert9h, '【9時】アラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 12時の通知 =====
        console.log('🕛 【12時の通知】\n');
        
        // 1. 定期更新通知
        const update12h = `Meta広告 定期更新通知
数値を更新しました。
ご確認よろしくお願いいたします！

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
        
        if (await sendChatworkMessage(update12h, '【12時】定期更新通知')) successCount++; else failCount++;
        await sleep(2000);
        
        // 2. アラート通知
        if (await sendChatworkMessage(alert9h, '【12時】アラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 15時の通知 =====
        console.log('🕒 【15時の通知】\n');
        
        if (await sendChatworkMessage(update12h, '【15時】定期更新通知')) successCount++; else failCount++;
        await sleep(2000);
        if (await sendChatworkMessage(alert9h, '【15時】アラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 17時の通知 =====
        console.log('🕔 【17時の通知】\n');
        
        if (await sendChatworkMessage(update12h, '【17時】定期更新通知')) successCount++; else failCount++;
        await sleep(2000);
        if (await sendChatworkMessage(alert9h, '【17時】アラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 19時の通知 =====
        console.log('🕖 【19時の通知】\n');
        
        if (await sendChatworkMessage(update12h, '【19時】定期更新通知')) successCount++; else failCount++;
        await sleep(2000);
        if (await sendChatworkMessage(alert9h, '【19時】アラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        
        // テスト完了サマリー
        console.log('\n✅ 全スケジュール通知のテストが完了しました！\n');
        console.log(`📱 チャットワークルームID ${ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信結果:');
        console.log(`  ✅ 成功: ${successCount}通`);
        console.log(`  ❌ 失敗: ${failCount}通`);
        console.log('  ────────────────────────');
        console.log(`  📩 合計: ${successCount + failCount}通\n`);
        
        console.log('📊 送信内容の内訳:');
        console.log('  📅 日次レポート: 1通 (9時)');
        console.log('  🔄 定期更新通知: 4通 (12時, 15時, 17時, 19時)');
        console.log('  🚨 アラート通知: 5通 (9時, 12時, 15時, 17時, 19時)\n');
        
        console.log('🔍 確認ポイント:');
        console.log('  ✓ 日次レポートにCV/CPA内訳が含まれている');
        console.log('  ✓ アラート通知にCV/CPA内訳が含まれている');
        console.log('  ✓ onsite_conversion.post_saveが除外されている');
        console.log('  ✓ CPA計算が「総消化金額÷CV数」方式になっている\n');
        
    } catch (error) {
        console.error('\n❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    }
}

// テスト実行
runAllScheduledNotifications().catch(error => {
    console.error('❌ テスト失敗:', error);
    process.exit(1);
});

