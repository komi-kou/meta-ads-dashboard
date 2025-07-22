const UserManager = require('../userManager');
const rateLimit = require('express-rate-limit');
const validator = require('validator');

// レート制限設定
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 最大5回の試行
    message: {
        error: 'ログイン試行回数が上限に達しました。15分後に再試行してください。'
    },
    standardHeaders: true,
    legacyHeaders: false,
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
    if (req.session && req.session.userId) {
        // セッションの有効性を確認
        if (req.session.lastActivity && 
            Date.now() - req.session.lastActivity > 24 * 60 * 60 * 1000) { // 24時間
            req.session.destroy();
            return res.redirect('/login?expired=true');
        }
        
        // 最後のアクティビティを更新
        req.session.lastActivity = Date.now();
        return next();
    } else {
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
    const { email, password, username } = req.body;
    const errors = [];

    // メールアドレス検証
    if (email && !validator.isEmail(email)) {
        errors.push('有効なメールアドレスを入力してください');
    }

    // パスワード検証
    if (password) {
        if (password.length < 8) {
            errors.push('パスワードは8文字以上である必要があります');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
            errors.push('パスワードは大文字、小文字、数字を含む必要があります');
        }
    }

    // ユーザー名検証
    if (username && (username.length < 2 || username.length > 50)) {
        errors.push('ユーザー名は2文字以上50文字以下である必要があります');
    }

    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }

    // 入力値をサニタイズ
    if (email) req.body.email = validator.normalizeEmail(email);
    if (username) req.body.username = validator.escape(username);

    next();
}

// CSRF保護ミドルウェア（簡易版）
function csrfProtection(req, res, next) {
    if (req.method === 'GET') {
        // CSRFトークンを生成してセッションに保存
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        res.locals.csrfToken = req.session.csrfToken;
        return next();
    }

    // APIエンドポイントはCSRFチェックをスキップ
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // POST/PUT/DELETEリクエストでトークンを確認
    const token = req.body.csrfToken || req.headers['x-csrf-token'];
    
    // CSRFトークンがない、またはマッチしない場合
    if (!token || !req.session.csrfToken || token !== req.session.csrfToken) {
        console.error('CSRF token mismatch:', {
            sessionToken: req.session.csrfToken,
            bodyToken: req.body.csrfToken,
            headerToken: req.headers['x-csrf-token'],
            url: req.url,
            method: req.method,
            hasSession: !!req.session,
            sessionId: req.sessionID
        });
        
        // デバッグ: セッションがない場合はログインにリダイレクト
        if (!req.session.csrfToken) {
            return res.status(403).json({ 
                error: 'CSRF token mismatch',
                detail: 'Session missing CSRF token',
                redirectUrl: '/login'
            });
        }
        
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    next();
}

// セキュリティヘッダー設定（軽量版）
function setSecurityHeaders(req, res, next) {
    // XSS保護
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // コンテンツタイプ保護
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // フレーム保護
    res.setHeader('X-Frame-Options', 'DENY');
    
    // リファラー制御
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
    const settings = req.body;
    const errors = [];

    // Meta API設定の検証
    if (settings.meta_access_token && settings.meta_access_token.length < 10) {
        errors.push('Meta APIアクセストークンが無効です');
    }

    if (settings.meta_account_id && !/^\d+$/.test(settings.meta_account_id)) {
        errors.push('Meta アカウントIDは数字である必要があります');
    }

    // Chatwork設定の検証
    if (settings.chatwork_token && settings.chatwork_token.length < 10) {
        errors.push('Chatwork APIトークンが無効です');
    }

    if (settings.chatwork_room_id && !/^\d+$/.test(settings.chatwork_room_id)) {
        errors.push('Chatwork ルームIDは数字である必要があります');
    }

    // 数値設定の検証
    const numericFields = ['target_cpa', 'target_cpm', 'target_ctr'];
    numericFields.forEach(field => {
        if (settings[field] !== undefined && 
            (isNaN(settings[field]) || settings[field] < 0)) {
            errors.push(`${field}は0以上の数値である必要があります`);
        }
    });

    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }

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