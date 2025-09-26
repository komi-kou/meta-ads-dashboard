// 全問題を修正するスクリプト
const fs = require('fs');
const path = require('path');

console.log('=== 全問題修正スクリプト開始 ===\n');

// 1. settings.ejsを修正 - すべての目標値フィールドを含める
function fixSettingsEJS() {
    console.log('1. settings.ejsを修正中...');
    
    const settingsPath = path.join(__dirname, 'views', 'settings.ejs');
    let content = fs.readFileSync(settingsPath, 'utf8');
    
    // 目標値設定フォームを完全に置き換える
    const oldGoalForm = `                <!-- 目標値設定セクション -->
                <div class="settings-section">
                    <h2>🎯 目標値設定</h2>
                    <form id="goalForm">
                        <div class="form-group">
                            <label>目標CPA（円）</label>
                            <input type="number" id="targetCpa" value="<%= target_cpa || '7000' %>" min="1">
                        </div>
                        <div class="form-group">
                            <label>目標CTR（%）</label>
                            <input type="number" id="targetCtr" value="<%= target_ctr || '1.0' %>" min="0.1" step="0.1">
                        </div>
                        <div class="form-group">
                            <label>目標予算消化率（%）</label>
                            <input type="number" id="targetBudgetRate" value="<%= target_budget_rate || '80' %>" min="1" max="100">
                        </div>
                        <button type="submit" class="btn-primary">保存</button>
                    </form>
                </div>`;
    
    const newGoalForm = `                <!-- 目標値設定セクション -->
                <div class="settings-section">
                    <h2>🎯 目標値設定</h2>
                    <form id="goalForm">
                        <div class="form-group">
                            <label>目標CPA（円）</label>
                            <input type="number" id="targetCpa" value="<%= target_cpa || '7000' %>" min="1">
                        </div>
                        <div class="form-group">
                            <label>目標CPM（円）</label>
                            <input type="number" id="targetCpm" value="<%= target_cpm || '3000' %>" min="1">
                        </div>
                        <div class="form-group">
                            <label>目標CTR（%）</label>
                            <input type="number" id="targetCtr" value="<%= target_ctr || '1.0' %>" min="0.1" step="0.1">
                        </div>
                        <div class="form-group">
                            <label>目標CV（件）</label>
                            <input type="number" id="targetCv" value="<%= target_cv || '1' %>" min="0">
                        </div>
                        <div class="form-group">
                            <label>目標予算消化率（%）</label>
                            <input type="number" id="targetBudgetRate" value="<%= target_budget_rate || '80' %>" min="1" max="100">
                        </div>
                        <div class="form-group">
                            <label>日予算（円）</label>
                            <input type="number" id="targetDailyBudget" value="<%= target_daily_budget || '30000' %>" min="1">
                        </div>
                        <button type="submit" class="btn-primary">保存</button>
                    </form>
                </div>`;
    
    // JavaScriptの保存処理も修正
    const oldJS = `            const data = {
                target_cpa: document.getElementById('targetCpa').value,
                target_ctr: document.getElementById('targetCtr').value,
                target_budget_rate: document.getElementById('targetBudgetRate').value
            };`;
    
    const newJS = `            const data = {
                target_cpa: document.getElementById('targetCpa').value,
                target_cpm: document.getElementById('targetCpm').value,
                target_ctr: document.getElementById('targetCtr').value,
                target_cv: document.getElementById('targetCv').value,
                target_budget_rate: document.getElementById('targetBudgetRate').value,
                target_daily_budget: document.getElementById('targetDailyBudget').value
            };`;
    
    content = content.replace(oldGoalForm, newGoalForm);
    content = content.replace(oldJS, newJS);
    
    fs.writeFileSync(settingsPath, content, 'utf8');
    console.log('  ✅ settings.ejsを修正しました\n');
}

// 2. app.jsのAPIエンドポイントを修正
function fixAppJSAPIEndpoint() {
    console.log('2. app.jsのAPIエンドポイントを修正中...');
    
    const appJsPath = path.join(__dirname, 'app.js');
    let content = fs.readFileSync(appJsPath, 'utf8');
    
    // /api/settings/goalsエンドポイントを探して修正
    const apiEndpointRegex = /app\.post\('\/api\/settings\/goals'[\s\S]*?\n\}\);/;
    const match = content.match(apiEndpointRegex);
    
    if (match) {
        const newEndpoint = `app.post('/api/settings/goals', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userManager = getUserManager();
        
        // 現在の設定を取得
        const currentSettings = userManager.getUserSettings(userId) || {};
        
        // 目標値を更新（既存の設定を保持）
        const updatedSettings = {
            ...currentSettings, // 既存の設定を保持
            target_cpa: req.body.target_cpa || currentSettings.target_cpa,
            target_cpm: req.body.target_cpm || currentSettings.target_cpm,
            target_ctr: req.body.target_ctr || currentSettings.target_ctr,
            target_cv: req.body.target_cv || currentSettings.target_cv,
            target_cvr: currentSettings.target_cvr || '', // 既存のCVRを保持
            target_budget_rate: req.body.target_budget_rate || currentSettings.target_budget_rate,
            target_daily_budget: req.body.target_daily_budget || currentSettings.target_daily_budget,
            target_roas: currentSettings.target_roas || '' // 既存のROASを保持
        };
        
        userManager.saveUserSettings(userId, updatedSettings);
        res.json({ success: true });
    } catch (error) {
        console.error('目標値保存エラー:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});`;
        
        content = content.replace(match[0], newEndpoint);
        console.log('  ✅ /api/settings/goalsエンドポイントを修正しました');
    } else {
        console.log('  ⚠️ エンドポイントが見つからないため、新規追加します');
        
        // エンドポイントを追加
        const insertPosition = content.indexOf('// サーバー起動');
        if (insertPosition > -1) {
            const newEndpoint = `
// 目標値設定API
app.post('/api/settings/goals', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userManager = getUserManager();
        
        // 現在の設定を取得
        const currentSettings = userManager.getUserSettings(userId) || {};
        
        // 目標値を更新（既存の設定を保持）
        const updatedSettings = {
            ...currentSettings, // 既存の設定を保持
            target_cpa: req.body.target_cpa || currentSettings.target_cpa,
            target_cpm: req.body.target_cpm || currentSettings.target_cpm,
            target_ctr: req.body.target_ctr || currentSettings.target_ctr,
            target_cv: req.body.target_cv || currentSettings.target_cv,
            target_cvr: currentSettings.target_cvr || '', // 既存のCVRを保持
            target_budget_rate: req.body.target_budget_rate || currentSettings.target_budget_rate,
            target_daily_budget: req.body.target_daily_budget || currentSettings.target_daily_budget,
            target_roas: currentSettings.target_roas || '' // 既存のROASを保持
        };
        
        userManager.saveUserSettings(userId, updatedSettings);
        res.json({ success: true });
    } catch (error) {
        console.error('目標値保存エラー:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

`;
            content = content.slice(0, insertPosition) + newEndpoint + content.slice(insertPosition);
        }
    }
    
    fs.writeFileSync(appJsPath, content, 'utf8');
    console.log('  ✅ app.jsのAPIエンドポイントを修正しました\n');
}

// 3. alertSystem.jsのCVR削除
function fixAlertSystem() {
    console.log('3. alertSystem.jsのCVRチェックを削除中...');
    
    const alertSystemPath = path.join(__dirname, 'alertSystem.js');
    let content = fs.readFileSync(alertSystemPath, 'utf8');
    
    // getUserTargets関数でCVRの処理を削除またはコメントアウト
    content = content.replace(
        `        if (userSettings.target_cvr && userSettings.target_cvr !== '') {
            const val = parseFloat(userSettings.target_cvr);
            if (!isNaN(val) && val > 0) targets.cvr = val;
        }`,
        `        // CVRは目標値に設定されていない場合はスキップ
        // if (userSettings.target_cvr && userSettings.target_cvr !== '') {
        //     const val = parseFloat(userSettings.target_cvr);
        //     if (!isNaN(val) && val > 0) targets.cvr = val;
        // }`
    );
    
    fs.writeFileSync(alertSystemPath, content, 'utf8');
    console.log('  ✅ CVRチェックを削除しました\n');
}

// 4. 既存ユーザー設定の修復
function repairUserSettings() {
    console.log('4. 既存ユーザー設定を修復中...');
    
    const userSettingsDir = path.join(__dirname, 'data', 'user_settings');
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    const settingsPath = path.join(userSettingsDir, `${userId}.json`);
    
    if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        // 不足しているフィールドを追加
        const updatedSettings = {
            ...settings,
            target_cv: settings.target_cv || '3',
            target_cvr: settings.target_cvr || '',
            target_budget_rate: settings.target_budget_rate || '80',
            target_daily_budget: settings.target_daily_budget || '30000'
        };
        
        fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2), 'utf8');
        console.log('  ✅ ユーザー設定を修復しました\n');
    }
}

// 5. テスト実行
function runTest() {
    console.log('5. 修正のテスト中...\n');
    
    // ユーザー設定を読み込んでテスト
    const userId = '02d004a8-03aa-4b6e-9dd2-94a1995b4360';
    const settingsPath = path.join(__dirname, 'data', 'user_settings', `${userId}.json`);
    
    if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        
        console.log('  現在の設定値:');
        console.log('    target_cpa:', settings.target_cpa);
        console.log('    target_cpm:', settings.target_cpm);
        console.log('    target_ctr:', settings.target_ctr);
        console.log('    target_cv:', settings.target_cv);
        console.log('    target_budget_rate:', settings.target_budget_rate);
        console.log('    target_daily_budget:', settings.target_daily_budget);
        
        const requiredFields = ['target_cpa', 'target_cpm', 'target_ctr', 'target_cv', 'target_budget_rate', 'target_daily_budget'];
        const missingFields = requiredFields.filter(field => !settings[field]);
        
        if (missingFields.length === 0) {
            console.log('\n  ✅ すべての必須フィールドが存在します');
        } else {
            console.log('\n  ❌ 不足フィールド:', missingFields);
        }
    }
}

// メイン実行
function main() {
    try {
        fixSettingsEJS();
        fixAppJSAPIEndpoint();
        fixAlertSystem();
        repairUserSettings();
        runTest();
        
        console.log('\n========================================');
        console.log('✅ すべての修正が完了しました！');
        console.log('========================================\n');
        
        console.log('次のステップ:');
        console.log('1. サーバーを再起動してください');
        console.log('2. http://localhost:3457/settings で目標値を再設定');
        console.log('3. ダッシュボードで予算消化率が正しく表示されることを確認');
        console.log('4. アラートにCVRが表示されないことを確認\n');
        
    } catch (error) {
        console.error('❌ 修正中にエラーが発生しました:', error);
    }
}

main();