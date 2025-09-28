// test-notification-simple.js - 修正後の簡易動作確認
const fs = require('fs');
const path = require('path');

console.log('========================================');
console.log('修正後の動作確認');
console.log('========================================\n');

// 1. 修正内容の確認
console.log('【1. 修正内容の確認】');
console.log('----------------------------------------');

// app.jsの確認
const appContent = fs.readFileSync('app.js', 'utf8');
const schedulerRequired = appContent.includes("require('./scheduler');") && !appContent.includes("// require('./scheduler');");
console.log(`app.js - scheduler.js require: ${schedulerRequired ? '❌ 有効（問題）' : '✅ 無効化済み'}`);

// 設定ファイルの確認
const settings7fe = JSON.parse(fs.readFileSync('data/user_settings/7fe7e401-a67b-40fb-bdff-0b61b67dc116.json', 'utf8'));
console.log(`7fe7e401設定 - enable_scheduler: ${settings7fe.enable_scheduler ? '❌ 有効（問題）' : '✅ 無効化済み'}`);
console.log(`7fe7e401設定 - enable_chatwork: ${settings7fe.enable_chatwork ? '❌ 有効（問題）' : '✅ 無効化済み'}`);
console.log(`7fe7e401設定 - enable_alerts: ${settings7fe.enable_alerts ? '❌ 有効（問題）' : '✅ 無効化済み'}`);

// scheduler.jsの確認
const schedulerContent = fs.readFileSync('scheduler.js', 'utf8');
const checkAllAlertsActive = /^\s*const alerts = await checkAllAlerts\(\);/m.test(schedulerContent);
console.log(`scheduler.js - checkAllAlerts呼び出し: ${checkAllAlertsActive ? '❌ 有効（問題）' : '✅ コメントアウト済み'}`);

// 2. ユーザー設定の確認
console.log('\n【2. ユーザー設定の確認】');
console.log('----------------------------------------');

const userSettingsDir = 'data/user_settings';
const userFiles = fs.readdirSync(userSettingsDir).filter(f => f.endsWith('.json'));

const roomIdMap = {};
for (const file of userFiles) {
    const settings = JSON.parse(fs.readFileSync(path.join(userSettingsDir, file), 'utf8'));
    const userId = file.replace('.json', '');
    
    if (settings.enable_scheduler) {
        console.log(`\n${userId}:`);
        console.log(`  ルームID: ${settings.chatwork_room_id}`);
        console.log(`  有効状態: scheduler=${settings.enable_scheduler}, chatwork=${settings.enable_chatwork}, alerts=${settings.enable_alerts}`);
        
        if (settings.enable_chatwork) {
            if (!roomIdMap[settings.chatwork_room_id]) {
                roomIdMap[settings.chatwork_room_id] = [];
            }
            roomIdMap[settings.chatwork_room_id].push(userId);
        }
    }
}

// 3. ルームID重複チェック
console.log('\n【3. ルームID重複チェック】');
console.log('----------------------------------------');

let hasDuplication = false;
for (const [roomId, users] of Object.entries(roomIdMap)) {
    if (users.length > 1) {
        console.log(`⚠️ ルームID ${roomId}: ${users.join(', ')}（${users.length}ユーザーで共有）`);
        hasDuplication = true;
    } else {
        console.log(`✅ ルームID ${roomId}: ${users[0]}`);
    }
}

if (!hasDuplication) {
    console.log('✅ ルームIDの重複なし');
}

// 4. 実行中のプロセス確認
console.log('\n【4. プロセス確認】');
console.log('----------------------------------------');

const { execSync } = require('child_process');
try {
    const processes = execSync('ps aux | grep -E "node.*(app|scheduler)" | grep -v grep | grep -v test', { encoding: 'utf8' });
    const lines = processes.split('\n').filter(line => line);
    
    if (lines.length > 0) {
        console.log('実行中のNodeプロセス:');
        lines.forEach(line => {
            const parts = line.split(/\s+/);
            const pid = parts[1];
            const cmd = parts.slice(10).join(' ');
            console.log(`  PID ${pid}: ${cmd}`);
        });
    } else {
        console.log('実行中のプロセスなし');
    }
} catch (e) {
    console.log('プロセス確認エラー:', e.message);
}

// 5. 予想される結果
console.log('\n【5. 予想される結果】');
console.log('----------------------------------------');
console.log('9時の通知:');
console.log('  横濱コーポレーション（408053863）: 日次レポート1件、アラート1件');
console.log('  整足院（410870245）: 日次レポート1件、アラート1件');
console.log('\n12,15,17,19時の通知:');
console.log('  横濱コーポレーション: 更新通知1件、アラート1件');
console.log('  整足院: 更新通知1件、アラート1件');

// 6. 総合判定
console.log('\n【6. 総合判定】');
console.log('========================================');

const allFixed = !schedulerRequired && 
                 !settings7fe.enable_scheduler && 
                 !settings7fe.enable_chatwork && 
                 !settings7fe.enable_alerts && 
                 !checkAllAlertsActive && 
                 !hasDuplication;

if (allFixed) {
    console.log('✅ すべての修正が正常に適用されています');
    console.log('✅ 通知の重複問題は解決されました');
} else {
    console.log('⚠️ 一部の修正が未完了です。上記の詳細を確認してください。');
}

console.log('========================================');