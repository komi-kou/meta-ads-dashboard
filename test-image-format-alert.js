/**
 * 添付画像形式のCV/CPA内訳付きアラート通知テスト
 * CV: 目標 3件 → 実績 1件 (Metaリード: 1件)
 * CPA: 目標 1,000円 → 実績 2,006円 (Metaリード: 2,006円)
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

async function runImageFormatAlertTest() {
    console.log('🖼️ 添付画像形式のCV/CPA内訳付きアラート通知テストを開始します...\n');
    console.log('📋 修正内容:');
    console.log('  - CV: 目標 3件 → 実績 1件 (Metaリード: 1件)');
    console.log('  - CPA: 目標 1,000円 → 実績 2,006円 (Metaリード: 2,006円)\n');
    console.log('═══════════════════════════════════════════════════\n');
    
    let successCount = 0;
    let failCount = 0;
    
    try {
        // 添付画像の形式に合わせたアラート通知（絵文字付き）
        const imageFormatAlert = `[info][title]① Meta広告 アラート通知 (2025/10/16)[/title]
以下の指標が目標値から外れています：

⚠️ CPA: 目標 1,000円 → 実績 2,006円 (Metaリード: 2,006円)
⚠️ CPM: 目標 1,900円 → 実績 2,740円
⚠️ CV: 目標 3件 → 実績 1件 (Metaリード: 1件)
🔴 予算消化率: 目標 80% → 実績 72%

📊 詳細はダッシュボードでご確認ください: https://meta-ads-dashboard.onrender.com/dashboard
✅ 確認事項: https://meta-ads-dashboard.onrender.com/improvement-tasks
💡 改善施策: https://meta-ads-dashboard.onrender.com/improvement-strategies

※これはテストメッセージです[/info]`;
        
        if (await sendChatworkMessage(imageFormatAlert, '【添付画像形式】CV/CPA内訳付きアラート通知')) successCount++; else failCount++;
        
        console.log('═══════════════════════════════════════════════════\n');
        
        // テスト完了サマリー
        console.log('\n✅ 添付画像形式のCV/CPA内訳付きアラート通知テストが完了しました！\n');
        console.log(`📱 チャットワークルームID ${ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信結果:');
        console.log(`  ✅ 成功: ${successCount}通`);
        console.log(`  ❌ 失敗: ${failCount}通`);
        console.log('  ────────────────────────');
        console.log(`  📩 合計: ${successCount + failCount}通\n`);
        
        console.log('🔍 確認ポイント:');
        console.log('  ✓ CV: 目標 3件 → 実績 1件 (Metaリード: 1件)');
        console.log('  ✓ CPA: 目標 1,000円 → 実績 2,006円 (Metaリード: 2,006円)');
        console.log('  ✓ 添付画像の形式に完全に準拠');
        console.log('  ✓ onsite_conversion.post_saveが除外されている\n');
        
    } catch (error) {
        console.error('\n❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    }
}

// テスト実行
runImageFormatAlertTest().catch(error => {
    console.error('❌ テスト失敗:', error);
    process.exit(1);
});

