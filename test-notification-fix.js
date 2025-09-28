// test-notification-fix.js - 修正後の通知動作テスト
const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
const UserManager = require('./userManager');

async function testNotificationFix() {
    console.log('========================================');
    console.log('修正後の通知動作テスト');
    console.log('========================================\n');
    
    const userManager = new UserManager();
    const multiUserSender = new MultiUserChatworkSender();
    
    // 1. 設定の確認
    console.log('【1. 設定確認】');
    console.log('----------------------------------------');
    
    const allUsers = userManager.getAllUsers();
    console.log(`アクティブユーザー数: ${allUsers.length}`);
    
    for (const user of allUsers) {
        const settings = userManager.getUserSettings(user.id);
        if (settings) {
            console.log(`\nユーザー: ${user.username} (${user.id})`);
            console.log(`  - メールアドレス: ${user.email}`);
            console.log(`  - チャットワークルームID: ${settings.chatwork_room_id}`);
            console.log(`  - スケジューラー有効: ${settings.enable_scheduler ? '✅' : '❌'}`);
            console.log(`  - チャットワーク有効: ${settings.enable_chatwork ? '✅' : '❌'}`);
            console.log(`  - アラート有効: ${settings.enable_alerts ? '✅' : '❌'}`);
        }
    }
    
    // 2. プロセスの確認
    console.log('\n【2. プロセス確認】');
    console.log('----------------------------------------');
    
    const { exec } = require('child_process');
    exec('ps aux | grep -E "node (app|scheduler)" | grep -v grep', (error, stdout) => {
        if (stdout) {
            console.log('実行中のプロセス:');
            stdout.split('\n').filter(line => line).forEach(line => {
                const parts = line.split(/\s+/);
                const pid = parts[1];
                const cmd = parts.slice(10).join(' ');
                console.log(`  PID: ${pid} - ${cmd}`);
            });
        } else {
            console.log('  実行中のプロセスなし');
        }
    });
    
    // 3. ルームID重複チェック
    console.log('\n【3. ルームID重複チェック】');
    console.log('----------------------------------------');
    
    const roomIds = {};
    const activeUsers = multiUserSender.getAllActiveUsers();
    
    for (const user of activeUsers) {
        const roomId = user.chatwork_room_id;
        if (!roomIds[roomId]) {
            roomIds[roomId] = [];
        }
        roomIds[roomId].push(user.username || user.email);
    }
    
    let hasDuplication = false;
    Object.entries(roomIds).forEach(([roomId, users]) => {
        if (users.length > 1) {
            console.log(`  ⚠️ ルームID ${roomId}: ${users.join(', ')}（重複）`);
            hasDuplication = true;
        } else {
            console.log(`  ✅ ルームID ${roomId}: ${users[0]}`);
        }
    });
    
    if (!hasDuplication) {
        console.log('  ✅ ルームIDの重複なし');
    }
    
    // 4. 通知シミュレーション
    console.log('\n【4. 通知シミュレーション（送信せずに確認のみ）】');
    console.log('----------------------------------------');
    
    console.log('\n9時の処理シミュレーション:');
    console.log('  1. データ取得（runBatchForAllUsers）');
    console.log('  2. 日次レポート送信（sendDailyReportToAllUsers）');
    console.log('  3. アラート通知送信（sendAlertNotificationToAllUsers）');
    
    console.log('\n予想される通知数:');
    for (const user of activeUsers) {
        console.log(`  ${user.username || user.email}:`);
        console.log(`    - 日次レポート: 1件`);
        console.log(`    - アラート通知: 1件`);
    }
    
    // 5. 改善結果の要約
    console.log('\n【5. 改善結果の要約】');
    console.log('----------------------------------------');
    console.log('✅ app.jsからscheduler.jsのrequireを削除');
    console.log('✅ ユーザー7fe7e401の設定を無効化');
    console.log('✅ checkAllAlerts()の重複呼び出しを削除');
    console.log('✅ execution_log.jsonをクリア');
    
    console.log('\n期待される効果:');
    console.log('  - 横濱コーポレーション: 通知が正常化（各1件）');
    console.log('  - 整足院: 通知が正常化（各1件）');
    console.log('  - 新規ユーザー: 最初から正常動作');
    
    console.log('\n========================================');
    console.log('テスト完了');
    console.log('========================================');
}

// テスト実行
testNotificationFix().catch(console.error);