// 既存ユーザー設定の修復スクリプト
const fs = require('fs');
const path = require('path');

function fixExistingUserSettings() {
    const userSettingsDir = path.join(__dirname, 'data', 'user_settings');
    
    if (!fs.existsSync(userSettingsDir)) {
        console.log('❌ user_settingsディレクトリが存在しません');
        return;
    }
    
    const files = fs.readdirSync(userSettingsDir).filter(f => f.endsWith('.json'));
    
    console.log(`📁 ${files.length}個のユーザー設定ファイルを確認中...`);
    
    files.forEach(file => {
        const filePath = path.join(userSettingsDir, file);
        const userId = file.replace('.json', '');
        
        try {
            const settings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            let updated = false;
            
            // 通知フラグが未定義の場合、デフォルトtrueを設定
            if (settings.daily_report_enabled === undefined) {
                settings.daily_report_enabled = true;
                updated = true;
            }
            
            if (settings.update_notifications_enabled === undefined) {
                settings.update_notifications_enabled = true;
                updated = true;
            }
            
            if (settings.alert_notifications_enabled === undefined) {
                settings.alert_notifications_enabled = true;
                updated = true;
            }
            
            // Room IDの検証（既知の無効なRoom IDをマイチャットに変更）
            const invalidRoomIds = ['405874412', '408053863', '410870245'];
            if (invalidRoomIds.includes(settings.chatwork_room_id)) {
                console.log(`⚠️  ユーザー ${userId}: 無効なRoom ID ${settings.chatwork_room_id} を検出`);
                // 修正はユーザーの判断に任せる（自動変更しない）
                console.log(`   → 有効なRoom IDに変更してください（例: マイチャット 228333524）`);
            }
            
            if (updated) {
                // バックアップを作成
                const backupPath = filePath + `.backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
                fs.copyFileSync(filePath, backupPath);
                
                // 更新された設定を保存
                fs.writeFileSync(filePath, JSON.stringify(settings, null, 2));
                console.log(`✅ ユーザー ${userId}: 通知フラグを追加しました`);
                console.log(`   - daily_report_enabled: ${settings.daily_report_enabled}`);
                console.log(`   - update_notifications_enabled: ${settings.update_notifications_enabled}`);
                console.log(`   - alert_notifications_enabled: ${settings.alert_notifications_enabled}`);
            } else {
                console.log(`✓  ユーザー ${userId}: 設定は正常です`);
            }
            
        } catch (error) {
            console.error(`❌ ユーザー ${userId}: エラー - ${error.message}`);
        }
    });
    
    console.log('\n📋 修復完了');
    console.log('注意: Room IDの権限は手動で確認してください');
    console.log('利用可能なRoom IDを確認するには、check-chatwork-rooms.jsを実行してください');
}

// 実行
fixExistingUserSettings();