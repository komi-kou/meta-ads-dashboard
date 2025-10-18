/**
 * 全スケジュール通知テスト
 * 各時間帯で実際に送信される通知を全てテスト
 */

const fs = require('fs');
const path = require('path');

// ユーザー設定ファイルのパス
const userSettingsPath = path.join(__dirname, 'user_settings.json');
const backupPath = path.join(__dirname, 'user_settings.json.backup_test');

// テストルームID
const TEST_ROOM_ID = '404474083';

// ChatworkAutoSenderをインポート
const ChatworkAutoSender = require('./utils/chatworkAutoSender');

async function runScheduledNotificationTests() {
    let originalSettings = null;
    
    try {
        console.log('\n🕐 全スケジュール通知のテストを開始します...\n');
        console.log('📅 スケジュール:');
        console.log('  - 9時: 日次レポート + アラート通知');
        console.log('  - 12時: 定期更新通知 + アラート通知');
        console.log('  - 15時: 定期更新通知 + アラート通知');
        console.log('  - 17時: 定期更新通知 + アラート通知');
        console.log('  - 19時: 定期更新通知 + アラート通知\n');
        
        // 1. 元の設定をバックアップ
        console.log('📋 ステップ1: 元の設定をバックアップ');
        originalSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(originalSettings, null, 2));
        console.log(`✅ バックアップ完成\n`);
        
        // 2. テスト用にルームIDを変更
        console.log('📋 ステップ2: テスト用にルームIDを変更');
        const testSettings = JSON.parse(JSON.stringify(originalSettings));
        
        if (testSettings.length > 0) {
            const originalRoomId = testSettings[0].chatwork_room_id;
            testSettings[0].chatwork_room_id = TEST_ROOM_ID;
            fs.writeFileSync(userSettingsPath, JSON.stringify(testSettings, null, 2));
            console.log(`✅ ルームID変更: ${originalRoomId} → ${TEST_ROOM_ID}\n`);
        } else {
            throw new Error('ユーザー設定が見つかりません');
        }
        
        const sender = new ChatworkAutoSender();
        const userId = testSettings[0].user_id;
        
        // 3. 各時間帯の通知をテスト
        console.log('📋 ステップ3: 各時間帯の通知をテスト送信\n');
        console.log('═══════════════════════════════════════════════════\n');
        
        // ===== 9時の通知 =====
        console.log('🕘 【9時の通知】\n');
        
        console.log('📅 1/2: 日次レポート');
        await sender.sendDailyReportWithUser(userId);
        console.log('✅ 送信完了\n');
        await sleep(2000);
        
        console.log('🚨 2/2: アラート通知');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ 送信完了\n');
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 12時の通知 =====
        console.log('🕛 【12時の通知】\n');
        
        console.log('🔄 1/2: 定期更新通知');
        await sender.sendUpdateNotificationWithUser(userId);
        console.log('✅ 送信完了\n');
        await sleep(2000);
        
        console.log('🚨 2/2: アラート通知');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ 送信完了\n');
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 15時の通知 =====
        console.log('🕒 【15時の通知】\n');
        
        console.log('🔄 1/2: 定期更新通知');
        await sender.sendUpdateNotificationWithUser(userId);
        console.log('✅ 送信完了\n');
        await sleep(2000);
        
        console.log('🚨 2/2: アラート通知');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ 送信完了\n');
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 17時の通知 =====
        console.log('🕔 【17時の通知】\n');
        
        console.log('🔄 1/2: 定期更新通知');
        await sender.sendUpdateNotificationWithUser(userId);
        console.log('✅ 送信完了\n');
        await sleep(2000);
        
        console.log('🚨 2/2: アラート通知');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ 送信完了\n');
        
        console.log('═══════════════════════════════════════════════════\n');
        await sleep(2000);
        
        // ===== 19時の通知 =====
        console.log('🕖 【19時の通知】\n');
        
        console.log('🔄 1/2: 定期更新通知');
        await sender.sendUpdateNotificationWithUser(userId);
        console.log('✅ 送信完了\n');
        await sleep(2000);
        
        console.log('🚨 2/2: アラート通知');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ 送信完了\n');
        
        console.log('═══════════════════════════════════════════════════\n');
        
        // テスト完了サマリー
        console.log('\n✅ 全スケジュール通知のテストが完了しました！\n');
        console.log(`📱 チャットワークルームID ${TEST_ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信した通知の合計:');
        console.log('  📅 日次レポート: 1通 (9時)');
        console.log('  🔄 定期更新通知: 4通 (12時, 15時, 17時, 19時)');
        console.log('  🚨 アラート通知: 5通 (9時, 12時, 15時, 17時, 19時)');
        console.log('  ────────────────────────');
        console.log('  📩 合計: 10通\n');
        
        console.log('🔍 確認ポイント:');
        console.log('  ✓ 日次レポートにCV/CPA内訳が含まれている');
        console.log('  ✓ アラート通知にCV/CPA内訳が含まれている');
        console.log('  ✓ onsite_conversion.post_saveが除外されている');
        console.log('  ✓ CPA計算が「総消化金額÷CV数」方式になっている\n');
        
    } catch (error) {
        console.error('\n❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    } finally {
        // 4. 元の設定に復元
        console.log('📋 ステップ4: 元の設定に復元');
        if (originalSettings) {
            fs.writeFileSync(userSettingsPath, JSON.stringify(originalSettings, null, 2));
            console.log('✅ 元の設定に復元しました');
        }
        
        // バックアップファイルを削除
        if (fs.existsSync(backupPath)) {
            fs.unlinkSync(backupPath);
            console.log('✅ バックアップファイルを削除しました\n');
        }
        
        console.log('🔒 安全なテストが完了しました。設定は元に戻りました。\n');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// プロセス終了時の緊急復元
process.on('SIGINT', () => {
    console.log('\n\n⚠️ 中断されました。設定を復元します...');
    if (fs.existsSync(backupPath)) {
        const backup = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(userSettingsPath, backup);
        fs.unlinkSync(backupPath);
        console.log('✅ 設定を復元しました');
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('\n❌ 予期しないエラー:', error.message);
    if (fs.existsSync(backupPath)) {
        const backup = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(userSettingsPath, backup);
        fs.unlinkSync(backupPath);
        console.log('✅ 設定を復元しました');
    }
    process.exit(1);
});

// テスト実行
runScheduledNotificationTests().catch(error => {
    console.error('❌ テスト失敗:', error);
    
    // エラー時も復元
    if (fs.existsSync(backupPath)) {
        const backup = fs.readFileSync(backupPath, 'utf8');
        fs.writeFileSync(userSettingsPath, backup);
        fs.unlinkSync(backupPath);
        console.log('✅ 設定を復元しました');
    }
    
    process.exit(1);
});

