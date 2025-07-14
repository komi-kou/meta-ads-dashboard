const crypto = require('crypto');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

// パスワードハッシュ化
async function hashPassword(password) {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
}

// パスワード検証
async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// セッション管理
const sessions = new Map();

// セッション作成
function createSession(userId) {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const session = {
    userId: userId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    ip: null
  };
  sessions.set(sessionId, session);
  
  // 古いセッションをクリーンアップ（24時間以上前）
  const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
  for (const [id, session] of sessions.entries()) {
    if (session.lastActivity < oneDayAgo) {
      sessions.delete(id);
    }
  }
  
  return sessionId;
}

// セッション検証
function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  
  // セッションタイムアウト（8時間）
  const eightHoursAgo = Date.now() - (8 * 60 * 60 * 1000);
  if (session.lastActivity < eightHoursAgo) {
    sessions.delete(sessionId);
    return null;
  }
  
  session.lastActivity = Date.now();
  return session;
}

// セッション削除
function destroySession(sessionId) {
  sessions.delete(sessionId);
}

// レート制限設定
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 最大5回
  message: 'ログイン試行回数が上限に達しました。15分後に再試行してください。',
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100, // 最大100回
  message: 'リクエスト数が上限に達しました。',
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRFトークン生成
function generateCSRFToken() {
  return crypto.randomBytes(32).toString('hex');
}

// CSRFトークン検証
function validateCSRFToken(token, sessionToken) {
  if (!token || !sessionToken) return false;
  return token === sessionToken;
}

// 入力値サニタイゼーション
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  // XSS対策
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// 認証ミドルウェア
function requireAuth(req, res, next) {
  const sessionId = req.session.sessionId;
  
  if (!sessionId) {
    return res.redirect('/login?error=unauthorized');
  }
  
  const session = validateSession(sessionId);
  if (!session) {
    req.session.destroy();
    return res.redirect('/login?error=session_expired');
  }
  
  req.user = { id: session.userId };
  next();
}

// 管理者認証ミドルウェア
function requireAdmin(req, res, next) {
  const sessionId = req.session.sessionId;
  
  if (!sessionId) {
    return res.status(403).json({ error: '認証が必要です' });
  }
  
  const session = validateSession(sessionId);
  if (!session || session.userId !== 'admin') {
    return res.status(403).json({ error: '管理者権限が必要です' });
  }
  
  req.user = { id: session.userId };
  next();
}

// セキュリティヘッダー設定
function setSecurityHeaders(req, res, next) {
  // XSS保護
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // クリックジャッキング保護
  res.setHeader('X-Frame-Options', 'DENY');
  
  // MIME型スニッフィング保護
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // HTTPS強制（本番環境）
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  // リファラーポリシー
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
}

// ログイン試行ログ
const loginAttempts = new Map();

function logLoginAttempt(ip, success) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push({
    timestamp: Date.now(),
    success: success
  });
  
  // 古いログを削除（1時間以上前）
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const recentAttempts = attempts.filter(attempt => attempt.timestamp > oneHourAgo);
  
  loginAttempts.set(ip, recentAttempts);
  
  // 失敗回数が多い場合は警告
  const recentFailures = recentAttempts.filter(attempt => !attempt.success).length;
  if (recentFailures > 10) {
    console.warn(`警告: IP ${ip} からのログイン失敗が多発しています (${recentFailures}回)`);
  }
}

// セキュリティ監査ログ
function logSecurityEvent(event, details) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: event,
    details: details,
    ip: details.ip || 'unknown'
  };
  
  console.log('セキュリティイベント:', logEntry);
  
  // 重要なイベントはファイルにも記録
  if (['login_failure', 'unauthorized_access', 'suspicious_activity'].includes(event)) {
    const fs = require('fs');
    const logFile = 'security.log';
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  validateSession,
  destroySession,
  loginLimiter,
  apiLimiter,
  generateCSRFToken,
  validateCSRFToken,
  sanitizeInput,
  requireAuth,
  requireAdmin,
  setSecurityHeaders,
  logLoginAttempt,
  logSecurityEvent
}; 