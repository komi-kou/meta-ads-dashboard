/**
 * 共通のコンバージョン計測モジュール
 * ダッシュボードとチャットワーク通知で同じCV計測ロジックを使用するため
 * Created: 2025-01-22
 */

function getConversionsFromActions(actions) {
    if (!actions || !Array.isArray(actions)) return 0;
    
    let total = 0;
    let detectedEvents = [];
    
    // Meta標準コンバージョンイベント + カスタムコンバージョンイベント
    const conversionTypes = [
        // 標準イベント
        'purchase', 
        'lead', 
        'complete_registration', 
        'add_to_cart',
        'initiate_checkout',
        'add_payment_info',
        'subscribe',
        'start_trial',
        'submit_application',
        'schedule',
        'contact',
        'donate'
    ];
    
    // 全てのアクションタイプをログ出力（デバッグ用）
    console.log('取得したアクションタイプ一覧:', actions.map(a => a.action_type));
    
    // 重複カウント防止 - 同じ値の異なるアクションタイプは同一CVの可能性が高い
    const conversionsByValue = {};
    
    actions.forEach(action => {
        let shouldCount = false;
        let eventType = action.action_type;
        let priority = 0; // 優先度（高い方を採用）
        
        // 標準的なコンバージョンタイプをチェック
        if (conversionTypes.includes(action.action_type)) {
            shouldCount = true;
            priority = 10;
        }
        // offsite_conversion プレフィックスを持つアクション（ただしview_contentは除外）
        else if (action.action_type && action.action_type.startsWith('offsite_conversion.') &&
                 !action.action_type.includes('view_content')) {
            shouldCount = true;
            priority = 8;
            if (action.action_type === 'offsite_conversion.fb_pixel_custom') {
                eventType = 'カスタムCV';
            }
        }
        // onsite_conversion プレフィックスを持つすべてのアクション（管理画面と一致させるため削除）
        // else if (action.action_type && action.action_type.startsWith('onsite_conversion.')) {
        //     shouldCount = true;
        //     priority = 7;
        // }
        // Metaリード広告のコンバージョン（最優先）
        else if (action.action_type && action.action_type.includes('meta_leads')) {
            shouldCount = true;
            eventType = 'Metaリード';
            priority = 15; // 最優先
        }
        // offsite_content_view系のコンバージョン（リード広告など）
        else if (action.action_type && action.action_type.startsWith('offsite_content_view_add_')) {
            shouldCount = true;
            eventType = 'リード広告CV';
            priority = 12;
        }
        // omni プレフィックスを持つコンバージョン系アクション
        else if (action.action_type && action.action_type.startsWith('omni_') && 
                 ['purchase', 'lead', 'complete_registration', 'add_to_cart', 'initiated_checkout'].some(type => 
                    action.action_type.includes(type))) {
            shouldCount = true;
            priority = 6;
        }
        // その他のlead関連アクション
        else if (action.action_type && action.action_type.toLowerCase().includes('lead')) {
            shouldCount = true;
            priority = 5;
        }
        
        if (shouldCount) {
            const value = parseInt(action.value || 0);
            // 同じ値のコンバージョンは最も優先度の高いものだけカウント
            if (!conversionsByValue[value] || conversionsByValue[value].priority < priority) {
                conversionsByValue[value] = {
                    type: eventType,
                    priority: priority,
                    count: value
                };
            }
        }
    });
    
    // 最終的な集計
    const breakdown = [];
    Object.values(conversionsByValue).forEach(conv => {
        total += conv.count;
        detectedEvents.push(`${conv.type}: ${conv.count}`);
        breakdown.push({
            type: conv.type,
            count: conv.count
        });
    });
    
    if (detectedEvents.length > 0) {
        console.log('検出されたCV:', detectedEvents.join(', '));
    } else {
        console.log('コンバージョンなし');
    }
    
    // 内訳データと合計値を返却（互換性のため、数値としても使える形式）
    return {
        total: total,
        breakdown: breakdown,
        // 後方互換性：数値として扱われた場合は合計値を返す
        valueOf: () => total,
        toString: () => total.toString()
    };
}

// 詳細レポート用の関数（app.jsで使用）
function getConversionsFromDetailedActions(actions) {
    return getConversionsFromActions(actions);
}

module.exports = {
    getConversionsFromActions,
    getConversionsFromDetailedActions
};