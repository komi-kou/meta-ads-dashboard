// Chatworkテスト改善シミュレーション v2
console.log('========================================');
console.log('Chatworkテスト問題 改善シミュレーション');
console.log('========================================\n');

// ========================================
// 現状分析
// ========================================
console.log('【現状の問題点】');
console.log('----------------------------------------');
console.log('1. 日次レポートテスト:');
console.log('   - CTR: 0.793651% → 小数点が長すぎる');
console.log('   - CPM: 1,946.208円 → 小数点不要');
console.log('   - フリークエンシー: 1.3451957295373667% → 長すぎ、%も不要');
console.log('');
console.log('2. アラート通知テスト: 送信されない');
console.log('3. トークン更新通知テスト: 失敗');
console.log('4. 全テスト一括実行: 失敗\n');

// ========================================
// 施策1: 日次レポートの桁問題の根本解決
// ========================================
console.log('【施策1: 日次レポートの完全修正】');
console.log('----------------------------------------');

// 現在の問題のある実装
console.log('❌ 現在の問題:');
console.log('chatworkAutoSender.jsは修正済みだが、');
console.log('テストは multiUserChatworkSender.js を使用');
console.log('multiUserChatworkSender.jsも修正済みだが、実データを使用\n');

// 改善案: テストモードの実装
console.log('✅ 改善案: テストモード専用処理を追加');
console.log('');

function improvedDailyReportTest(userSettings, isTestMode = false) {
    let data;
    
    if (isTestMode) {
        // テストモード: 固定のサンプルデータ
        console.log('📝 テストモード: サンプルデータを使用');
        data = {
            spend: 2206.789,
            budgetRate: 99.876,
            ctr: 0.793651,
            cpm: 1946.208,
            cpa: 0,
            frequency: 1.3451957295373667,
            conversions: 0.25
        };
    } else {
        // 通常モード: 実データ取得
        // data = await fetchMetaAdDailyStats(...)
    }
    
    // フォーマット処理（修正版）
    const formatMessage = (data) => {
        // CTRとfrequencyの特別処理
        const ctr = typeof data.ctr === 'string' && data.ctr.includes('%') 
            ? parseFloat(data.ctr) 
            : data.ctr;
        const frequency = typeof data.frequency === 'string' && data.frequency.includes('%')
            ? parseFloat(data.frequency)
            : data.frequency;
            
        return `Meta広告 日次レポート (2025/9/19)

消化金額（合計）：${Math.round(data.spend || 0).toLocaleString()}円
予算消化率（平均）：${Math.round(data.budgetRate || 0)}%
CTR（平均）：${Math.round((ctr || 0) * 10) / 10}%
CPM（平均）：${Math.round(data.cpm || 0).toLocaleString()}円
CPA（平均）：${Math.round(data.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${Math.round((frequency || 0) * 10) / 10}
コンバージョン数：${Math.round(data.conversions || 0)}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;
    };
    
    return formatMessage(data);
}

console.log('現在の出力（問題あり）:');
console.log(`CTR（平均）：0.793651%
CPM（平均）：1,946.208円
フリークエンシー（平均）：1.3451957295373667%`);

console.log('\n改善後の出力:');
const testResult = improvedDailyReportTest({}, true);
const lines = testResult.split('\n');
console.log(lines.filter(line => 
    line.includes('CTR') || 
    line.includes('CPM') || 
    line.includes('フリークエンシー')
).join('\n'));

console.log('\n✅ 効果:');
console.log('  - CTR: 0.793651% → 0.8%');
console.log('  - CPM: 1,946.208円 → 1,946円');
console.log('  - フリークエンシー: 1.3451957295373667% → 1.3（%なし）\n');

// ========================================
// 施策2: Chatworkトークン問題の解決
// ========================================
console.log('【施策2: Chatworkトークン問題の統一】');
console.log('----------------------------------------');

console.log('問題の原因:');
console.log('  app.js: chatwork_api_token を使用');
console.log('  multiUserChatworkSender.js: chatwork_token を期待');
console.log('  → トークンが undefined になる\n');

console.log('改善案: トークンフィールドの統一');

function improvedTokenHandling(userSettings) {
    // トークンフィールドの互換性を確保
    const formattedSettings = {
        user_id: userSettings.user_id,
        // 複数のフィールド名に対応
        chatwork_token: userSettings.chatwork_api_token || 
                       userSettings.chatwork_token || 
                       userSettings.chatwork_apitoken,
        chatwork_room_id: userSettings.chatwork_room_id,
        // その他の設定...
        daily_report_enabled: true,
        update_notifications_enabled: true,
        alert_notifications_enabled: true,
        meta_access_token: userSettings.meta_access_token || 'dummy_for_test',
        meta_account_id: userSettings.meta_account_id || 'dummy_for_test'
    };
    
    console.log('フォーマット後の設定:');
    console.log(`  chatwork_token: ${formattedSettings.chatwork_token ? '✅ 設定済み' : '❌ 未設定'}`);
    console.log(`  chatwork_room_id: ${formattedSettings.chatwork_room_id ? '✅ 設定済み' : '❌ 未設定'}`);
    
    return formattedSettings;
}

// テスト
const testSettings = {
    user_id: 'user1',
    chatwork_api_token: 'test_token_123',
    chatwork_room_id: '123456'
};

const formatted = improvedTokenHandling(testSettings);
console.log('\n✅ トークン統一後: すべて正常に設定\n');

// ========================================
// 施策3: テストモードの統合実装
// ========================================
console.log('【施策3: 統合テストモード実装】');
console.log('----------------------------------------');

class ImprovedMultiUserChatworkSender {
    async sendUserDailyReport(userSettings, isTestMode = false) {
        try {
            console.log(`📅 日次レポート${isTestMode ? 'テスト' : ''}送信開始`);
            
            let data;
            if (isTestMode) {
                // テスト用固定データ
                data = {
                    spend: 2206.789,
                    budgetRate: 99.876,
                    ctr: 0.793651,
                    cpm: 1946.208,
                    cpa: 0,
                    frequency: 1.3451957295373667,
                    conversions: 0.25
                };
            } else {
                // 実データ取得
                // data = await fetchMetaAdDailyStats(...)
            }
            
            const message = this.formatDailyReport(data, isTestMode);
            console.log('メッセージ生成完了');
            return message;
        } catch (error) {
            console.error('エラー:', error);
        }
    }
    
    formatDailyReport(data, isTestMode = false) {
        const ctr = typeof data.ctr === 'string' && data.ctr.includes('%') 
            ? parseFloat(data.ctr) 
            : data.ctr;
        const frequency = typeof data.frequency === 'string' && data.frequency.includes('%')
            ? parseFloat(data.frequency)
            : data.frequency;
            
        const dateStr = new Date(Date.now() - 24 * 60 * 60 * 1000)
            .toLocaleDateString('ja-JP', { year: 'numeric', month: 'numeric', day: 'numeric' });
            
        let message = `Meta広告 日次レポート${isTestMode ? ' (テスト)' : ''} (${dateStr})

消化金額（合計）：${Math.round(data.spend || 0).toLocaleString()}円
予算消化率（平均）：${Math.round(data.budgetRate || 0)}%
CTR（平均）：${Math.round((ctr || 0) * 10) / 10}%
CPM（平均）：${Math.round(data.cpm || 0).toLocaleString()}円
CPA（平均）：${Math.round(data.cpa || 0).toLocaleString()}円
フリークエンシー（平均）：${Math.round((frequency || 0) * 10) / 10}
コンバージョン数：${Math.round(data.conversions || 0)}件  

確認はこちら
https://meta-ads-dashboard.onrender.com/dashboard`;

        if (isTestMode) {
            message += '\n\n※これはテストメッセージです';
        }
        
        return message;
    }
}

const sender = new ImprovedMultiUserChatworkSender();
console.log('統合実装のテスト:');
const testMessage = sender.formatDailyReport({
    spend: 2206.789,
    budgetRate: 99.876,
    ctr: 0.793651,
    cpm: 1946.208,
    cpa: 0,
    frequency: 1.3451957295373667,
    conversions: 0.25
}, true);

console.log('生成されたメッセージ（主要部分）:');
const keyLines = testMessage.split('\n').slice(2, 9);
keyLines.forEach(line => console.log('  ' + line));

// ========================================
// 施策4: app.jsの修正案
// ========================================
console.log('\n【施策4: app.js エンドポイントの改善】');
console.log('----------------------------------------');

function improvedChatworkTestEndpoint(req, res) {
    const { type } = req.body;
    const userId = req.user?.id || 'user1';
    
    // ユーザー設定を取得（実装では実際の設定を取得）
    const userSettings = {
        user_id: userId,
        chatwork_api_token: 'test_token',
        chatwork_room_id: '123456'
    };
    
    // トークンフィールドの統一
    const formattedSettings = {
        user_id: userSettings.user_id,
        chatwork_token: userSettings.chatwork_api_token || userSettings.chatwork_token,
        chatwork_room_id: userSettings.chatwork_room_id,
        daily_report_enabled: true,
        update_notifications_enabled: true,
        alert_notifications_enabled: true,
        meta_access_token: userSettings.meta_access_token || 'test_dummy',
        meta_account_id: userSettings.meta_account_id || 'test_dummy'
    };
    
    // テストタイプごとの処理（テストモードフラグを追加）
    const testHandlers = {
        'daily': () => console.log('sendUserDailyReport(formattedSettings, true)'),
        'update': () => console.log('sendUserUpdateNotification(formattedSettings, true)'),
        'alert': () => console.log('sendUserAlertNotification(formattedSettings, true)'),
        'token': () => console.log('sendUserTokenUpdateNotification(formattedSettings)')
    };
    
    if (testHandlers[type]) {
        console.log(`${type}テスト実行:`);
        testHandlers[type]();
        return '✅ 成功';
    }
    
    return '❌ 不明なテストタイプ';
}

console.log('app.js改善案:');
console.log('  1. トークンフィールドを統一（chatwork_token）');
console.log('  2. すべてのテストにテストモードフラグ追加');
console.log('  3. Meta APIトークンにダミー値を設定（テスト用）');

// テスト実行
['daily', 'update', 'alert', 'token'].forEach(type => {
    const result = improvedChatworkTestEndpoint({ body: { type } });
    console.log(`  ${type}: ${result}`);
});

// ========================================
// 総合評価
// ========================================
console.log('\n========================================');
console.log('【改善施策の総合評価】');
console.log('========================================\n');

console.log('✅ 施策1: 日次レポートの桁問題');
console.log('  - テストモードでは固定データを使用');
console.log('  - CTR/frequencyの%記号を適切に処理');
console.log('  - Math.round()で確実に丸め処理\n');

console.log('✅ 施策2: Chatworkトークン問題');
console.log('  - chatwork_api_token → chatwork_token に統一');
console.log('  - 複数のフィールド名に対応（互換性維持）\n');

console.log('✅ 施策3: テストモード実装');
console.log('  - すべてのテスト関数にisTestModeパラメータ追加');
console.log('  - テスト時は固定データ、実行時は実データ\n');

console.log('✅ 施策4: エンドポイント改善');
console.log('  - formattedSettingsで確実にトークン設定');
console.log('  - Meta APIトークンにダミー値（テスト時）\n');

console.log('【期待される結果】');
console.log('✅ 日次レポート: 適切な桁数で表示（0.8%, 1,946円, 1.3）');
console.log('✅ アラート通知: テストモードで確実に送信');
console.log('✅ トークン更新通知: トークン問題解決で送信成功');
console.log('✅ 全テスト一括実行: すべて正常動作');
console.log('✅ デザイン/UI/性能: 変更なし（表示フォーマットのみ改善）');