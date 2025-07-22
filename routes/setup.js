// マルチユーザー対応セットアップ保存処理
const express = require('express');
const { requireAuth, validateUserSettings, auditLog, getUserManager } = require('../middleware/testAuth');

const router = express.Router();
const userManager = getUserManager();

// セットアップ保存処理（マルチユーザー対応）
router.post('/save-setup', requireAuth, auditLog('setup_save'), async (req, res) => {
    try {
        console.log('=== マルチユーザーセットアップ保存開始 ===');
        console.log('User ID:', req.session.userId);
        console.log('Session:', req.session);
        console.log('CSRF Token in body:', req.body.csrfToken);
        console.log('CSRF Token in session:', req.session.csrfToken);
        console.log('Received data:', req.body);
        
        const userId = req.session.userId;
        const {
            csrfToken,
            metaAccessToken,
            metaAccountId,
            chatworkApiToken,
            chatworkRoomId,
            goal_type,
            target_cpa,
            target_cpm,
            target_ctr
        } = req.body;
        
        // データマッピング（フロントエンドからのデータ形式に合わせる）
        const meta_access_token = metaAccessToken;
        const meta_account_id = metaAccountId;
        const meta_app_id = req.body.meta_app_id || '';
        const chatwork_token = chatworkApiToken;
        const chatwork_room_id = chatworkRoomId;
        const service_goal = goal_type;
        
        // 必須項目チェック
        if (!meta_access_token || !meta_account_id || !chatwork_token || !chatwork_room_id) {
            console.error('必須項目エラー:', {
                meta_access_token: !!meta_access_token,
                meta_account_id: !!meta_account_id,
                chatwork_token: !!chatwork_token,
                chatwork_room_id: !!chatwork_room_id
            });
            return res.status(400).json({
                success: false,
                error: 'Meta API設定とChatwork設定は必須です'
            });
        }
        
        // ユーザー設定を保存
        const settingsData = {
            meta_access_token,
            meta_account_id,
            meta_app_id: meta_app_id || '',
            chatwork_token,
            chatwork_room_id,
            service_goal: service_goal || '',
            target_cpa: parseFloat(target_cpa) || 0,
            target_cpm: parseFloat(target_cpm) || 0,
            target_ctr: parseFloat(target_ctr) || 0,
            notifications_enabled: true,
            daily_report_enabled: true,
            update_notifications_enabled: true,
            alert_notifications_enabled: true
        };
        
        userManager.saveUserSettings(userId, settingsData);
        
        console.log('✅ ユーザー設定保存完了');
        
        res.json({
            success: true,
            message: 'セットアップが完了しました',
            redirectUrl: '/dashboard'
        });
        
    } catch (error) {
        console.error('❌ セットアップ保存エラー:', error);
        res.status(500).json({
            success: false,
            error: 'セットアップ保存に失敗しました: ' + error.message
        });
    }
});

module.exports = router;