/**
 * 安全なチャットワーク通知テスト
 * - 既存のユーザー設定を一時的にバックアップ
 * - テストルームIDに変更してテスト実行
 * - テスト完了後、元の設定に復元
 */

const fs = require('fs');
const path = require('path');

// ユーザー設定ファイルのパス
const userSettingsPath = path.join(__dirname, 'user_settings.json');

// バックアップファイルのパス
const backupPath = path.join(__dirname, 'user_settings.json.backup_test');

// テストルームID
const TEST_ROOM_ID = '404474083';

// ChatworkAutoSenderをインポート
const ChatworkAutoSender = require('./utils/chatworkAutoSender');

async function runSafeTest() {
    let originalSettings = null;
    
    try {
        console.log('\n🔒 安全なテスト送信を開始します...\n');
        
        // 1. 元の設定をバックアップ
        console.log('📋 ステップ1: 元の設定をバックアップ');
        originalSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
        fs.writeFileSync(backupPath, JSON.stringify(originalSettings, null, 2));
        console.log(`✅ バックアップ完成: ${backupPath}\n`);
        
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
        
        // 3. テスト実行
        console.log('📋 ステップ3: テスト通知を送信\n');
        console.log('🚀 テスト送信開始...\n');
        
        const sender = new ChatworkAutoSender();
        const userId = testSettings[0].user_id;
        
        // 3-1. 日次レポートテスト
        console.log('📅 【1/3】日次レポート通知テスト');
        console.log('   (データがない場合はフォールバックメッセージが送信されます)');
        await sender.sendDailyReportWithUser(userId);
        console.log('✅ 日次レポート送信完了\n');
        await sleep(2000);
        
        // 3-2. 定期更新通知テスト
        console.log('🔄 【2/3】定期更新通知テスト');
        await sender.sendUpdateNotificationWithUser(userId);
        console.log('✅ 定期更新通知送信完了\n');
        await sleep(2000);
        
        // 3-3. アラート通知テスト
        console.log('🚨 【3/3】アラート通知テスト');
        console.log('   (アラート履歴がある場合のみ送信されます)');
        await sender.sendAlertNotificationWithUser(userId, true);
        console.log('✅ アラート通知送信完了\n');
        
        console.log('\n✅ テスト送信が完了しました！\n');
        console.log(`📱 チャットワークルームID ${TEST_ROOM_ID} をご確認ください。\n`);
        
        console.log('📊 送信予定の通知:');
        console.log('  1️⃣ 日次レポート (データがあればCV/CPA内訳含む)');
        console.log('  2️⃣ 定期更新通知');
        console.log('  3️⃣ アラート通知 (アラートがあればCV/CPA内訳含む)\n');
        
    } catch (error) {
        console.error('\n❌ テスト実行エラー:', error.message);
        console.error(error.stack);
    } finally {
        // 4. 元の設定に復元
        console.log('\n📋 ステップ4: 元の設定に復元');
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
runSafeTest().catch(error => {
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

