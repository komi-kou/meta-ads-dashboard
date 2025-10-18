/**
 * チャットワーク全通知テストスクリプト
 * ルームID 404474083 に全ての通知タイプをテスト送信
 */

const path = require('path');
const fs = require('fs');

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

// ChatworkAutoSenderをインポート
const ChatworkAutoSender = require('./utils/chatworkAutoSender');
const sender = new ChatworkAutoSender();

// テストルームIDを設定
const TEST_ROOM_ID = '404474083';

// 元の設定を保存
const originalRoomId = settings.chatwork?.roomId;

// テスト用にルームIDを一時的に変更
if (settings.chatwork) {
    settings.chatwork.roomId = TEST_ROOM_ID;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    console.log(`📝 テスト用ルームIDに変更: ${TEST_ROOM_ID}`);
}

// 設定を再読み込み
sender.reloadSettings();

async function runAllNotificationTests() {
    console.log('\n🚀 全通知タイプのテストを開始します...\n');
    
    try {
        // 1. 日次レポート通知テスト
        console.log('📅 【1/3】日次レポート通知テスト');
        await sender.sendDailyReportWithUser('test-user');
        console.log('✅ 日次レポート送信完了\n');
        await sleep(2000);
        
        // 2. 定期更新通知テスト
        console.log('🔄 【2/3】定期更新通知テスト');
        await sender.sendUpdateNotificationWithUser('test-user');
        console.log('✅ 定期更新通知送信完了\n');
        await sleep(2000);
        
        // 3. アラート通知テスト
        console.log('🚨 【3/3】アラート通知テスト');
        
        // テスト用のアラートデータを作成
        const testAlert = {
            type: 'budget_rate',
            metric: '予算消化率',
            message: '【テスト】予算消化率が90%を超えています',
            value: 95.5,
            threshold: 90,
            timestamp: new Date().toISOString(),
            data: {
                spend: 54868,
                conversions: {
                    total: 3,
                    breakdown: [
                        { type: 'Metaリード', count: 3 }
                    ]
                },
                cpa: 18289,
                cost_per_action_type: []
            }
        };
        
        // アラート履歴に追加
        const alertHistoryPath = path.join(__dirname, 'alert_history.json');
        let alertHistory = [];
        
        if (fs.existsSync(alertHistoryPath)) {
            try {
                alertHistory = JSON.parse(fs.readFileSync(alertHistoryPath, 'utf8'));
            } catch (error) {
                console.log('⚠️ アラート履歴の読み込みに失敗しました、新規作成します');
            }
        }
        
        // 今日の日付でテストアラートを追加
        const today = new Date().toISOString().split('T')[0];
        testAlert.timestamp = new Date().toISOString();
        alertHistory.push(testAlert);
        
        // アラート履歴を保存
        fs.writeFileSync(alertHistoryPath, JSON.stringify(alertHistory, null, 2));
        console.log('📝 テストアラートを履歴に追加しました');
        
        // アラート通知を送信
        await sender.sendAlertNotificationWithUser('test-user', true);
        console.log('✅ アラート通知送信完了\n');
        
        console.log('\n✅ 全ての通知テストが完了しました！');
        console.log(`📱 ルームID ${TEST_ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信した通知:');
        console.log('  1️⃣ 日次レポート (CV/CPA内訳含む)');
        console.log('  2️⃣ 定期更新通知');
        console.log('  3️⃣ アラート通知 (CV/CPA内訳含む)\n');
        
    } catch (error) {
        console.error('❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    } finally {
        // 元の設定に戻す
        if (originalRoomId && settings.chatwork) {
            settings.chatwork.roomId = originalRoomId;
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
            console.log(`📝 元のルームIDに戻しました: ${originalRoomId}`);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// テスト実行
runAllNotificationTests().catch(error => {
    console.error('❌ テスト失敗:', error);
    
    // エラー時も元の設定に戻す
    if (originalRoomId && settings.chatwork) {
        settings.chatwork.roomId = originalRoomId;
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log(`📝 元のルームIDに戻しました: ${originalRoomId}`);
    }
    
    process.exit(1);
});

