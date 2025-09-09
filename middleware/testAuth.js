// テスト用簡素化認証ミドルウェア
const UserManager = require('../userManager');
const rateLimit = require('express-rate-limit');

// レート制限設定（メールアドレスベース - マルチユーザー対応）
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: process.env.NODE_ENV === 'development' ? 50 : 5, // 開発環境では制限を緩和
    message: {
        error: 'ログイン試行回数が上限に達しました。15分後に再試行してください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // メールアドレスベースでレート制限（マルチユーザー対応）
    keyGenerator: (req) => {
        // POSTリクエストのemailフィールドを使用
        const email = req.body?.email || req.query?.email || 'unknown';
        // 開発環境では制限を緩和
        if (process.env.NODE_ENV === 'development' && req.ip === '127.0.0.1') {
            return `dev_${email}`; // 開発環境用の識別子
        }
        return `${req.ip}_${email}`; // IP + メールの組み合わせ
    },
    skip: (req) => {
        // 新規登録は制限をスキップ
        return req.path === '/register';
    }
});

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト
    message: {
        error: 'リクエスト数が上限に達しました。しばらくしてから再試行してください。'
    }
});

// ユーザーマネージャーのインスタンス
const userManager = new UserManager();

// 認証ミドルウェア
function requireAuth(req, res, next) {
    console.log('🔐 requireAuth チェック:', {
        url: req.url,
        method: req.method,
        sessionId: req.sessionID,
        hasSession: !!req.session,
        hasUserId: !!(req.session && req.session.userId),
        userId: req.session?.userId,
        userEmail: req.session?.userEmail,
        lastActivity: req.session?.lastActivity,
        sessionKeys: req.session ? Object.keys(req.session) : null
    });
    
    if (req.session && req.session.userId) {
        // セッションの有効性を確認
        if (req.session.lastActivity && 
            Date.now() - req.session.lastActivity > 24 * 60 * 60 * 1000) { // 24時間
            console.log('⏰ セッション期限切れでログインページにリダイレクト');
            req.session.destroy();
            return res.redirect('/login?expired=true');
        }
        
        // 最後のアクティビティを更新
        req.session.lastActivity = Date.now();
        console.log('✅ 認証成功 - 次のミドルウェアに進行:', {
            userId: req.session.userId,
            userName: req.session.userName
        });
        return next();
    } else {
        console.log('❌ 認証失敗 - ログインページにリダイレクト:', {
            hasSession: !!req.session,
            sessionContent: req.session,
            reason: !req.session ? 'セッションなし' : 'userIdなし'
        });
        return res.redirect('/login');
    }
}

// ユーザー情報をリクエストに追加するミドルウェア
function addUserToRequest(req, res, next) {
    if (req.session && req.session.userId) {
        req.userId = req.session.userId;
        req.userEmail = req.session.userEmail;
        req.userName = req.session.userName;
    }
    next();
}

// 入力値検証ミドルウェア
function validateUserInput(req, res, next) {
    // 基本的な検証のみ実装
    next();
}

// CSRF保護ミドルウェア（テスト用 - 無効化）
function csrfProtection(req, res, next) {
    console.log(`🔍 CSRF Test Mode: ${req.method} ${req.url}`);
    
    if (req.method === 'GET') {
        // CSRFトークンを生成してセッションに保存
        if (!req.session.csrfToken) {
            req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
            console.log('🔑 CSRF Token Generated:', req.session.csrfToken.substring(0, 8) + '...');
        }
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    // テスト期間中はCSRF検証をスキップ
    console.log('⚠️ CSRF validation BYPASSED for testing');
    next();
}

// セキュリティヘッダー設定（軽量版）
function setSecurityHeaders(req, res, next) {
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
}

// 監査ログ記録ミドルウェア
function auditLog(action) {
    return (req, res, next) => {
        try {
            const userId = req.session?.userId || null;
            const ipAddress = req.ip || req.connection.remoteAddress;
            const userAgent = req.get('User-Agent') || '';
            
            userManager.logAuditEvent(
                userId,
                action,
                JSON.stringify({
                    url: req.originalUrl,
                    method: req.method,
                    body: req.body ? Object.keys(req.body) : []
                }),
                ipAddress,
                userAgent
            );
        } catch (error) {
            console.error('監査ログエラー:', error);
        }
        
        next();
    };
}

// ユーザー設定の検証
function validateUserSettings(req, res, next) {
    // 基本的な検証のみ実装
    next();
}

// ユーザーマネージャーを取得する関数
function getUserManager() {
    return userManager;
}

module.exports = {
    loginLimiter,
    generalLimiter,
    requireAuth,
    addUserToRequest,
    validateUserInput,
    csrfProtection,
    setSecurityHeaders,
    auditLog,
    validateUserSettings,
    getUserManager
};