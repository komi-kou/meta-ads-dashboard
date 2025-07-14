// クイックテストスクリプト
// ブラウザの開発者ツールで実行するためのデバッグツール

console.log('=== クイックテスト開始 ===');

// 基本情報の確認
console.log('現在のURL:', window.location.href);
console.log('ページタイトル:', document.title);

// サイドバーの確認
const sidebar = document.querySelector('.sidebar');
console.log('サイドバー要素:', sidebar);
console.log('サイドバー表示状態:', sidebar ? '表示中' : '非表示');

// メインコンテンツの確認
const mainContent = document.querySelector('.main-content');
console.log('メインコンテンツ要素:', mainContent);

// コンテンツ要素の確認
const contentDiv = document.getElementById('content');
console.log('コンテンツ要素:', contentDiv);

if (contentDiv) {
    console.log('コンテンツHTML:', contentDiv.innerHTML.substring(0, 200) + '...');
}

// ページタイプの判定
const isImprovementTasks = window.location.pathname.includes('improvement-tasks');
const isImprovementStrategies = window.location.pathname.includes('improvement-strategies');

if (isImprovementTasks) {
    console.log('=== 確認事項ページのテスト ===');
    
    // テストアラートデータ
    const testAlerts = [
        {
            id: 1,
            metric: '予算消化率',
            message: '予算消化率が80%以下の65%が3日間続いています',
            level: 'medium',
            timestamp: new Date().toISOString()
        },
        {
            id: 2,
            metric: 'CTR',
            message: 'CTRが2%以下の1.5%が3日間続いています',
            level: 'medium',
            timestamp: new Date().toISOString()
        },
        {
            id: 3,
            metric: 'CV',
            message: 'CV数が1件以下の0件が続いています',
            level: 'high',
            timestamp: new Date().toISOString()
        },
        {
            id: 4,
            metric: 'CPA',
            message: 'CPAが10,000円以上の12,000円が続いています',
            level: 'high',
            timestamp: new Date().toISOString()
        }
    ];
    
    console.log('テストアラート:', testAlerts);
    
    // 確認事項の生成テスト
    const checklistRules = {
        '予算消化率': [
            { priority: 1, title: '配信されているか確認', description: '広告がアクティブになっているか' },
            { priority: 2, title: '配信するクリエイティブが枯れている', description: 'CV数が0もしくは目標CPAの到達しておらず予算も消化されていない' },
            { priority: 3, title: '配信するユーザー層が悪いのか', description: '配信するユーザー層が悪いと表示されないケースがある' }
        ],
        'CTR': [
            { priority: 1, title: '配信しているクリエイティブが刺さっていないor枯れている', description: 'ありきたりのクリエイティブでユーザーに見られていない\n7日間ベースでずっと配信していて、飽きられている' },
            { priority: 2, title: 'フリークエンシーが2.5%以上ある', description: '同じユーザーばかりに配信されていて、見飽きられている' },
            { priority: 3, title: '配信するユーザー層が見込み顧客ではない', description: 'サービスに合ったユーザー層に配信されていないので、スルーされている' }
        ]
    };
    
    // 確認事項の生成
    const generatedChecklist = [];
    testAlerts.forEach(alert => {
        const items = checklistRules[alert.metric];
        if (items) {
            generatedChecklist.push({
                metric: alert.metric,
                alertMessage: alert.message,
                alertLevel: alert.level,
                timestamp: alert.timestamp,
                items: items
            });
        }
    });
    
    console.log('生成された確認事項:', generatedChecklist);
    
} else if (isImprovementStrategies) {
    console.log('=== 改善施策ページのテスト ===');
    
    // テストアラートデータ
    const testAlerts = [
        {
            id: 1,
            metric: '予算消化率',
            message: '予算消化率が80%以下の65%が3日間続いています',
            level: 'medium',
            timestamp: new Date().toISOString()
        },
        {
            id: 2,
            metric: 'CTR',
            message: 'CTRが2%以下の1.5%が3日間続いています',
            level: 'medium',
            timestamp: new Date().toISOString()
        },
        {
            id: 3,
            metric: 'CV',
            message: 'CV数が1件以下の0件が続いています',
            level: 'high',
            timestamp: new Date().toISOString()
        },
        {
            id: 4,
            metric: 'CPA',
            message: 'CPAが10,000円以上の12,000円が続いています',
            level: 'high',
            timestamp: new Date().toISOString()
        }
    ];
    
    console.log('テストアラート:', testAlerts);
    
    // 改善施策の生成テスト
    const improvementRules = {
        '予算消化率': {
            '配信されているか確認': [
                '管理画面の上の運用しているキャンペーンが緑でアクティブになっているか、キャンペーンを確認する',
                '決済ができておらず配信エラーになっていないか、請求と支払いを確認する',
                'クリエイティブが審査落ちしていて配信エラーになっていないか、広告を確認する'
            ]
        },
        'CTR': {
            '配信しているクリエイティブが刺さっていないor枯れている': [
                '過去7日間ベースで予算が寄っておらずCVも取れていないクリエイティブを差し替える',
                '過去7日間ベースで予算は寄っているけど目標CPAに達しておらずクリック率も目標以下のクリエイティブは差し替える'
            ]
        }
    };
    
    const checklistItems = {
        '予算消化率': [
            { priority: 1, title: '配信されているか確認' },
            { priority: 2, title: '配信するクリエイティブが枯れている' }
        ],
        'CTR': [
            { priority: 1, title: '配信しているクリエイティブが刺さっていないor枯れている' }
        ]
    };
    
    // 改善施策の生成
    const generatedStrategies = [];
    testAlerts.forEach(alert => {
        const metric = alert.metric;
        const items = checklistItems[metric] || [];
        const improvements = improvementRules[metric] || {};
        
        items.forEach(item => {
            const actions = improvements[item.title] || [];
            if (actions.length > 0) {
                generatedStrategies.push({
                    metric: metric,
                    alertMessage: alert.message,
                    alertLevel: alert.level,
                    timestamp: alert.timestamp,
                    checklistTitle: item.title,
                    priority: item.priority,
                    actions: actions
                });
            }
        });
    });
    
    console.log('生成された改善施策:', generatedStrategies);
}

// エラーの確認
console.log('=== エラー確認 ===');
const errors = [];
window.addEventListener('error', function(e) {
    errors.push({
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno
    });
    console.error('JavaScriptエラー:', e.error);
});

// パフォーマンス確認
console.log('=== パフォーマンス確認 ===');
console.log('DOM読み込み完了時間:', performance.now());

// メモリ使用量（Chromeのみ）
if (performance.memory) {
    console.log('メモリ使用量:', {
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    });
}

// レスポンシブ確認
console.log('=== レスポンシブ確認 ===');
console.log('ビューポート幅:', window.innerWidth);
console.log('ビューポート高さ:', window.innerHeight);
console.log('デバイスピクセル比:', window.devicePixelRatio);

// サイドバーの表示状態確認
if (sidebar && mainContent) {
    console.log('サイドバー幅:', sidebar.offsetWidth);
    console.log('メインコンテンツ左マージン:', getComputedStyle(mainContent).marginLeft);
}

console.log('=== クイックテスト完了 ===');
console.log('エラー数:', errors.length);
if (errors.length > 0) {
    console.log('エラー詳細:', errors);
}

// 結果の要約
console.log('=== テスト結果要約 ===');
console.log('✅ サイドバー:', sidebar ? '表示中' : '❌ 非表示');
console.log('✅ メインコンテンツ:', mainContent ? '表示中' : '❌ 非表示');
console.log('✅ コンテンツ要素:', contentDiv ? '存在' : '❌ 不存在');
console.log('✅ エラー:', errors.length === 0 ? 'なし' : `❌ ${errors.length}件`);
console.log('✅ ページタイプ:', isImprovementTasks ? '確認事項ページ' : isImprovementStrategies ? '改善施策ページ' : 'その他'); 