// 管理者用ユーザー管理機能
const express = require('express');
const { requireAuth, auditLog, getUserManager } = require('../middleware/testAuth');

const router = express.Router();
const userManager = getUserManager();

// 管理者権限チェック（特定のメールアドレス）
function requireAdmin(req, res, next) {
    const adminEmails = [
        'komiya@example.com', // 管理者のメールアドレス
        'admin@meta-ads-dashboard.com'
    ];
    
    if (!req.session.userEmail || !adminEmails.includes(req.session.userEmail.toLowerCase())) {
        return res.status(403).json({ error: '管理者権限が必要です' });
    }
    next();
}

// ユーザー一覧表示（管理者用）
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
    try {
        const users = userManager.readJsonFile(userManager.usersFile);
        const settings = userManager.readJsonFile(userManager.settingsFile);
        
        const userList = users.map(user => {
            const userSettings = settings.find(s => s.user_id === user.id);
            return {
                id: user.id,
                email: user.email,
                username: user.username,
                is_active: user.is_active,
                created_at: user.created_at,
                last_login: user.last_login,
                has_settings: !!userSettings,
                login_attempts: user.login_attempts
            };
        });
        
        res.render('admin/users', {
            title: 'ユーザー管理',
            users: userList,
            admin: {
                email: req.session.userEmail,
                name: req.session.userName
            }
        });
    } catch (error) {
        console.error('ユーザー一覧取得エラー:', error);
        res.status(500).render('error', { error: 'ユーザー一覧の取得に失敗しました' });
    }
});

// ユーザー停止（解約処理）
router.post('/admin/users/:userId/deactivate', requireAuth, requireAdmin, auditLog('user_deactivate'), (req, res) => {
    try {
        const userId = req.params.userId;
        const reason = req.body.reason || 'サブスク解約';
        
        const users = userManager.readJsonFile(userManager.usersFile);
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        
        // ユーザーを非アクティブ化
        users[userIndex].is_active = false;
        users[userIndex].deactivated_at = new Date().toISOString();
        users[userIndex].deactivated_by = req.session.userId;
        users[userIndex].deactivated_reason = reason;
        
        userManager.writeJsonFile(userManager.usersFile, users);
        
        // 監査ログに記録
        userManager.logAuditEvent(
            req.session.userId,
            'user_deactivated',
            `User ${users[userIndex].email} deactivated. Reason: ${reason}`,
            req.ip,
            req.get('User-Agent')
        );
        
        console.log(`✅ ユーザー停止完了: ${users[userIndex].email}`);
        
        res.json({
            success: true,
            message: 'ユーザーを停止しました',
            user: {
                email: users[userIndex].email,
                username: users[userIndex].username
            }
        });
        
    } catch (error) {
        console.error('ユーザー停止エラー:', error);
        res.status(500).json({ error: 'ユーザー停止に失敗しました' });
    }
});

// ユーザー復活（再アクティブ化）
router.post('/admin/users/:userId/activate', requireAuth, requireAdmin, auditLog('user_activate'), (req, res) => {
    try {
        const userId = req.params.userId;
        
        const users = userManager.readJsonFile(userManager.usersFile);
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        
        // ユーザーを再アクティブ化
        users[userIndex].is_active = true;
        users[userIndex].reactivated_at = new Date().toISOString();
        users[userIndex].reactivated_by = req.session.userId;
        delete users[userIndex].deactivated_at;
        delete users[userIndex].deactivated_by;
        delete users[userIndex].deactivated_reason;
        
        userManager.writeJsonFile(userManager.usersFile, users);
        
        // 監査ログに記録
        userManager.logAuditEvent(
            req.session.userId,
            'user_reactivated',
            `User ${users[userIndex].email} reactivated`,
            req.ip,
            req.get('User-Agent')
        );
        
        console.log(`✅ ユーザー復活完了: ${users[userIndex].email}`);
        
        res.json({
            success: true,
            message: 'ユーザーを復活させました',
            user: {
                email: users[userIndex].email,
                username: users[userIndex].username
            }
        });
        
    } catch (error) {
        console.error('ユーザー復活エラー:', error);
        res.status(500).json({ error: 'ユーザー復活に失敗しました' });
    }
});

// 特定メールアドレスでの停止（バルク処理）
router.post('/admin/users/bulk-deactivate', requireAuth, requireAdmin, auditLog('bulk_deactivate'), (req, res) => {
    try {
        const { emails, reason } = req.body;
        
        if (!emails || !Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({ error: 'メールアドレスリストが必要です' });
        }
        
        const users = userManager.readJsonFile(userManager.usersFile);
        const deactivatedUsers = [];
        
        emails.forEach(email => {
            const userIndex = users.findIndex(u => u.email.toLowerCase() === email.toLowerCase() && u.is_active);
            if (userIndex !== -1) {
                users[userIndex].is_active = false;
                users[userIndex].deactivated_at = new Date().toISOString();
                users[userIndex].deactivated_by = req.session.userId;
                users[userIndex].deactivated_reason = reason || 'サブスク一括解約';
                
                deactivatedUsers.push({
                    email: users[userIndex].email,
                    username: users[userIndex].username
                });
            }
        });
        
        userManager.writeJsonFile(userManager.usersFile, users);
        
        // 監査ログに記録
        userManager.logAuditEvent(
            req.session.userId,
            'bulk_user_deactivated',
            `Bulk deactivated ${deactivatedUsers.length} users. Emails: ${emails.join(', ')}`,
            req.ip,
            req.get('User-Agent')
        );
        
        console.log(`✅ 一括ユーザー停止完了: ${deactivatedUsers.length}人`);
        
        res.json({
            success: true,
            message: `${deactivatedUsers.length}人のユーザーを停止しました`,
            deactivatedUsers: deactivatedUsers
        });
        
    } catch (error) {
        console.error('一括ユーザー停止エラー:', error);
        res.status(500).json({ error: '一括ユーザー停止に失敗しました' });
    }
});

module.exports = router;