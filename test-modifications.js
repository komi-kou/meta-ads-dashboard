// 修正内容のテスト用スクリプト
const fs = require('fs');

console.log('=== 修正内容確認テスト ===\n');

// 1. alert_history.json の確認
console.log('1. アラート履歴ファイルの確認:');
try {
    const alertHistory = JSON.parse(fs.readFileSync('./alert_history.json', 'utf8'));
    const budgetAlert = alertHistory.find(alert => alert.metric === 'budget_rate');
    
    if (budgetAlert) {
        console.log('✅ 予算消化率アラート発見');
        console.log('   メッセージ:', budgetAlert.message);
        console.log('   checkItems数:', budgetAlert.checkItems?.length || 0);
        console.log('   improvements数:', Object.keys(budgetAlert.improvements || {}).length);
    } else {
        console.log('❌ 予算消化率アラートが見つからない');
    }
} catch (error) {
    console.log('❌ アラート履歴ファイル読み込みエラー:', error.message);
}

console.log('\n2. ユーザー設定の確認:');
try {
    const userSettings = JSON.parse(fs.readFileSync('./data/user_settings.json', 'utf8'));
    const user = userSettings[0];
    
    if (user) {
        console.log('✅ ユーザー設定発見');
        console.log('   日予算設定:', user.target_dailyBudget);
        console.log('   Meta Account ID:', user.meta_account_id);
        console.log('   Meta Access Token:', user.meta_access_token ? '存在' : '未設定');
    }
} catch (error) {
    console.log('❌ ユーザー設定ファイル読み込みエラー:', error.message);
}

console.log('\n3. 修正されたファイルの確認:');

// app.js の修正確認
console.log('   app.js:');
try {
    const appContent = fs.readFileSync('./app.js', 'utf8');
    
    // 重要な修正箇所を確認
    const hasNewFunction = appContent.includes('convertInsightsToMetricsWithActualBudget');
    const hasCampaignsFetch = appContent.includes('campaigns');
    const hasActualBudgetLog = appContent.includes('実際の日予算');
    
    console.log('     ✅ 新しい変換関数:', hasNewFunction ? '追加済み' : '未追加');
    console.log('     ✅ キャンペーン予算取得:', hasCampaignsFetch ? '実装済み' : '未実装');
    console.log('     ✅ 予算ログ:', hasActualBudgetLog ? '追加済み' : '未追加');
} catch (error) {
    console.log('     ❌ app.js確認エラー:', error.message);
}

// 確認事項ページの修正確認
console.log('   improvement-tasks.ejs:');
try {
    const tasksContent = fs.readFileSync('./views/improvement-tasks.ejs', 'utf8');
    
    const hasImprovedLogging = tasksContent.includes('checkItems配列確認');
    const hasConditionCheck = tasksContent.includes('条件判定');
    
    console.log('     ✅ 改善されたログ:', hasImprovedLogging ? '追加済み' : '未追加');
    console.log('     ✅ 条件判定チェック:', hasConditionCheck ? '追加済み' : '未追加');
} catch (error) {
    console.log('     ❌ improvement-tasks.ejs確認エラー:', error.message);
}

console.log('\n=== テスト完了 ===');
console.log('\n次のステップ:');
console.log('1. npm start でサーバーを起動');
console.log('2. ブラウザで各ページにアクセス');
console.log('3. ブラウザのコンソール(F12)でログを確認');
console.log('4. 予算消化率と確認事項の表示を確認');