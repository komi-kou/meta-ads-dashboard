/**
 * Meta API トークン設定ヘルパー
 * 実際のMeta APIトークンをユーザー設定に保存するためのスクリプト
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('========================================');
console.log('🔑 Meta API トークン設定');
console.log('========================================\n');

console.log('Meta APIの実データを取得するには、有効なアクセストークンが必要です。\n');
console.log('取得方法:');
console.log('1. Facebook開発者ツールにアクセス: https://developers.facebook.com/tools/explorer/');
console.log('2. アプリを選択（または新規作成）');
console.log('3. 必要な権限を選択:');
console.log('   - ads_read');
console.log('   - ads_management');
console.log('   - business_management');
console.log('4. アクセストークンを生成\n');

function question(prompt) {
    return new Promise(resolve => {
        rl.question(prompt, resolve);
    });
}

async function setupToken() {
    try {
        // ユーザーIDを入力
        const userId = await question('ユーザーID（例: 7fe7e401-a67b-40fb-bdff-0b61b67dc116）: ');
        
        if (!userId) {
            console.log('❌ ユーザーIDが必要です');
            rl.close();
            return;
        }
        
        // ユーザー設定ファイルのパス
        const userSettingsPath = path.join(__dirname, 'data', 'user_settings', `${userId}.json`);
        
        // 既存の設定を読み込む
        let settings = {};
        if (fs.existsSync(userSettingsPath)) {
            settings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
            console.log('\n既存の設定を読み込みました');
        } else {
            console.log('\n新規ユーザー設定を作成します');
        }
        
        // Meta API設定を入力
        console.log('\n以下の情報を入力してください（Enterでスキップ）:\n');
        
        const accessToken = await question('Meta アクセストークン: ');
        const accountId = await question('Meta 広告アカウントID (act_xxxxx形式): ');
        const appId = await question('Meta App ID（オプション）: ');
        
        // 設定を更新
        if (accessToken) settings.meta_access_token = accessToken;
        if (accountId) settings.meta_account_id = accountId;
        if (appId) settings.meta_app_id = appId;
        
        // その他のデフォルト設定
        if (!settings.user_id) settings.user_id = userId;
        if (!settings.target_daily_budget) settings.target_daily_budget = 10000;
        if (!settings.target_cpa) settings.target_cpa = 1000;
        if (!settings.target_ctr) settings.target_ctr = 1.0;
        if (!settings.target_cpm) settings.target_cpm = 500;
        
        // ファイルに保存
        const dir = path.dirname(userSettingsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
        
        console.log('\n✅ 設定を保存しました:', userSettingsPath);
        
        // トークンの有効性をテスト
        if (accessToken && accountId) {
            console.log('\n🔍 トークンの有効性をテスト中...');
            
            const metaApi = require('./metaApi');
            const testApi = new metaApi.metaApi(userId);
            
            try {
                const result = await testApi.getAccountInfo(accountId, accessToken);
                console.log('✅ トークンは有効です！');
                console.log('アカウント名:', result.name || 'Unknown');
                console.log('通貨:', result.currency || 'JPY');
            } catch (error) {
                console.log('⚠️ トークンテストに失敗しました:', error.message);
                console.log('トークンの有効期限が切れている可能性があります');
            }
        }
        
        console.log('\n📝 設定完了後の確認事項:');
        console.log('1. サーバーを再起動してください');
        console.log('2. ログインして新機能にアクセス');
        console.log('3. 広告パフォーマンスやオーディエンス分析で実データが表示されます');
        
    } catch (error) {
        console.error('エラー:', error);
    } finally {
        rl.close();
    }
}

setupToken();