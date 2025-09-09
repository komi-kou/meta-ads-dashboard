// dotenvによる環境変数読み込み
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');

// テスト用軽量版マルチユーザー対応
const {
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
} = require('./middleware/testAuth');

// セットアップルーター
const setupRouter = require('./routes/setup');
const adminRouter = require('./routes/admin');

// 環境変数確認ログ
console.log('=== 環境変数確認 ===');
console.log('META_ACCESS_TOKEN:', process.env.META_ACCESS_TOKEN ? '設定済み' : '未設定');
console.log('META_ACCOUNT_ID:', process.env.META_ACCOUNT_ID ? '設定済み' : '未設定');
console.log('META_APP_ID:', process.env.META_APP_ID ? '設定済み' : '未設定');

const app = express();

// ユーザーマネージャー初期化
const userManager = getUserManager();

// テスト用ユーザー自動作成
async function createTestUserIfNeeded() {
    try {
        const users = userManager.readJsonFile(userManager.usersFile);
        console.log('📊 既存ユーザー数:', users.length);
        
        // テストユーザーが存在しない場合は作成
        const testEmail = 'test@example.com';
        const existingTest = users.find(u => u.email && u.email.toLowerCase() === testEmail);
        
        if (!existingTest) {
            console.log('👤 テストユーザーを作成中...');
            const testUserId = await userManager.createUser(testEmail, 'password123', 'テストユーザー');
            console.log('✅ テストユーザー作成完了:', testUserId);
            console.log('📧 ログイン情報: email=test@example.com, password=password123');
        } else {
            console.log('👤 テストユーザーは既に存在します');
        }
    } catch (error) {
        console.error('❌ テストユーザー作成エラー:', error);
    }
}

// アプリケーション起動時にテストユーザーを作成
createTestUserIfNeeded();

// ファイルサイズチェック機能
function checkFileSize(filePath, minSize = 100) {
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < minSize) {
      console.error(`⚠️ 警告: ${filePath} のファイルサイズが異常に小さいです (${stats.size} バイト)`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`❌ エラー: ${filePath} のファイルサイズチェックに失敗:`, error.message);
    return false;
  }
}

// セキュリティヘッダー（軽量版）
app.use(setSecurityHeaders);

// レート制限
app.use(generalLimiter);

// 基本設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// プロダクション環境でのプロキシ信頼設定（重要）
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // 1番目のプロキシを信頼
    console.log('✅ Trust proxy enabled for production');
} else {
    console.log('ℹ️ Trust proxy disabled for development');
}

// セッション設定（Render.com対応版 + ファイルストア）
const sessionConfig = {
    secret: process.env.SESSION_SECRET || 'multi-user-meta-ads-dashboard-secret-2024',
    name: 'metaads.sessionid',
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24時間
        httpOnly: true,
        sameSite: 'lax'
    }
};

// ファイルベースのセッションストア（永続化のため）
try {
    const FileStore = require('session-file-store')(session);
    sessionConfig.store = new FileStore({
        path: './data/sessions',
        ttl: 24 * 60 * 60, // 24時間（秒）
        reapInterval: 60 * 60, // 1時間ごとにクリーンアップ
        logFn: function() {} // ログを無効化
    });
    console.log('✅ File-based session store initialized');
} catch (error) {
    console.log('⚠️ File store not available, using memory store:', error.message);
    // メモリストアを使用（デフォルト）
}

// プロダクション環境でのCookie設定
if (process.env.NODE_ENV === 'production') {
    sessionConfig.cookie.secure = true; // HTTPS必須
    console.log('✅ Secure cookies enabled for production');
} else {
    sessionConfig.cookie.secure = false; // 開発環境ではHTTP許可
    console.log('ℹ️ Secure cookies disabled for development');
}

console.log('📋 Session config:', {
    secure: sessionConfig.cookie.secure,
    sameSite: sessionConfig.cookie.sameSite,
    maxAge: sessionConfig.cookie.maxAge,
    trustProxy: process.env.NODE_ENV === 'production'
});

app.use(session(sessionConfig));


// セッションデバッグミドルウェア（強化版）
app.use((req, res, next) => {
    if (req.url.includes('/login') || req.url.includes('/setup') || req.url.includes('/register')) {
        console.log('🔍 Session Debug:', {
            url: req.url,
            method: req.method,
            sessionID: req.sessionID,
            hasSession: !!req.session,
            sessionKeys: req.session ? Object.keys(req.session) : null,
            userId: req.session?.userId,
            cookies: req.headers.cookie ? 'present' : 'missing',
            protocol: req.protocol,
            secure: req.secure,
            trustProxy: app.get('trust proxy')
        });
    }
    next();
});

// ユーザー情報をリクエストに追加
app.use(addUserToRequest);

// CSRF保護
app.use(csrfProtection);

// セットアップルーターを使用
app.use('/', setupRouter);
// 管理者ルーターを使用
app.use('/', adminRouter);

// ========================
// 認証ルート（マルチユーザー対応）
// ========================

// ユーザー登録ページ
app.get('/register', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    
    // CSRFトークンを強制的に生成と保存
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        console.log('🔑 Register: CSRF token generated:', req.session.csrfToken.substring(0, 8) + '...');
    }
    
    console.log('📋 Register page render - Session ID:', req.sessionID);
    console.log('🔑 CSRF token available:', !!req.session.csrfToken);
    
    res.render('register', { 
        csrfToken: req.session.csrfToken,
        sessionId: req.sessionID // デバッグ用
    });
});

// ユーザー登録処理
app.post('/register', loginLimiter, validateUserInput, auditLog('user_register'), async (req, res) => {
    try {
        const { email, password, username } = req.body;
        
        const userId = await userManager.createUser(email, password, username);
        
        userManager.logAuditEvent(userId, 'user_registered', 'New user registration', 
            req.ip, req.get('User-Agent'));
        
        // ユーザー登録後はログインページにリダイレクト（メールアドレスを記憶）
        res.redirect(`/login?registered=true&email=${encodeURIComponent(email)}`);
    } catch (error) {
        console.error('Registration error:', error);
        res.render('register', { 
            error: error.message,
            formData: { email: req.body.email, username: req.body.username }
        });
    }
});

// ログインページ
app.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/dashboard');
    }
    
    // CSRFトークンを強制的に生成と保存
    if (!req.session.csrfToken) {
        req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
        console.log('🔑 Login: CSRF token generated:', req.session.csrfToken.substring(0, 8) + '...');
    }
    
    // 登録完了メッセージを表示
    let successMessage = null;
    if (req.query.registered === 'true') {
        successMessage = 'ユーザー登録が完了しました。ログインしてください。';
    }
    
    console.log('📋 Login page render - Session ID:', req.sessionID);
    console.log('🔑 CSRF token available:', !!req.session.csrfToken);
    
    res.render('user-login', { 
        query: req.query,
        successMessage: successMessage,
        error: req.query.error,
        csrfToken: req.session.csrfToken,
        sessionId: req.sessionID // デバッグ用
    });
});

// ログイン処理
app.post('/login', loginLimiter, validateUserInput, auditLog('user_login'), async (req, res) => {
    console.log('==================================================');
    console.log('📝 POST /login リクエスト受信 - 開始時刻:', new Date().toISOString());
    console.log('Session ID:', req.sessionID);
    console.log('Request headers:', {
        'user-agent': req.get('User-Agent'),
        'content-type': req.get('Content-Type'),
        'accept': req.get('Accept'),
        'referer': req.get('Referer')
    });
    console.log('Request body:', { email: req.body.email, hasPassword: !!req.body.password });
    
    
    try {
        console.log('📋 req.body詳細:', req.body);
        console.log('📋 req.body type:', typeof req.body);
        console.log('📋 req.body keys:', req.body ? Object.keys(req.body) : 'req.body is null/undefined');
        
        const { email, password } = req.body || {};
        
        console.log('📧 抽出されたemail:', email, 'type:', typeof email);
        console.log('🔑 抽出されたpassword:', password ? '存在します' : '存在しません', 'type:', typeof password);
        
        // バリデーション強化
        if (!email || typeof email !== 'string' || email.trim() === '') {
            console.log('❌ email バリデーション失敗:', { email, type: typeof email });
            throw new Error('メールアドレスが正しく入力されていません');
        }
        
        if (!password || typeof password !== 'string' || password.trim() === '') {
            console.log('❌ password バリデーション失敗:', { hasPassword: !!password, type: typeof password });
            throw new Error('パスワードが正しく入力されていません');
        }
        
        const trimmedEmail = email.trim();
        const trimmedPassword = password.trim();
        
        console.log('🔐 ユーザー認証開始:', trimmedEmail);
        const userId = await userManager.authenticateUser(trimmedEmail, trimmedPassword);
        console.log('🔐 認証結果:', userId ? '成功' : '失敗');
        
        if (userId) {
            console.log('✅ ログイン成功 - ユーザーID:', userId);
            
            const user = userManager.getUserById(userId);
            console.log('📝 ユーザー情報:', { id: userId, email: trimmedEmail, username: user?.username });
            
            req.session.userId = userId;
            req.session.userEmail = trimmedEmail;
            req.session.userName = user?.username;
            req.session.lastActivity = Date.now();
            
            console.log('💾 セッション保存を明示的に実行中...');
            
            // セッションを明示的に保存してからリダイレクト
            console.log('💾 セッション保存開始:', {
                sessionID: req.sessionID,
                userId: req.session.userId,
                beforeSave: true
            });
            
            req.session.save((err) => {
                if (err) {
                    console.error('❌ セッション保存エラー:', err);
                    console.error('❌ エラー詳細:', err.stack);
                    return res.status(500).render('user-login', { 
                        error: 'ログイン処理中にセッション保存エラーが発生しました',
                        formData: { email: req.body.email },
                        csrfToken: req.session.csrfToken
                    });
                }
                
                console.log('✅ セッション保存完了 - リダイレクト準備中');
                console.log('📋 最終セッション状態:', {
                    userId: req.session.userId,
                    userEmail: req.session.userEmail,
                    userName: req.session.userName,
                    sessionID: req.sessionID,
                    lastActivity: req.session.lastActivity
                });
                
                userManager.logAuditEvent(userId, 'login_success', 'User logged in', 
                    req.ip, req.get('User-Agent'));
                
                // ユーザー設定をチェックして適切にリダイレクト
                const userSettings = userManager.getUserSettings(userId);
                console.log('⚙️ ユーザー設定状態:', {
                    userId: userId,
                    hasSettings: !!userSettings,
                    settingsContent: userSettings,
                    hasMetaToken: !!(userSettings?.meta_access_token),
                    hasChatworkToken: !!(userSettings?.chatwork_token)
                });
                
                const needsSetup = !userSettings || !userSettings.meta_access_token || !userSettings.chatwork_token;
                const redirectUrl = needsSetup ? '/setup' : '/dashboard';
                
                console.log('🔄 リダイレクト判定:', {
                    needsSetup: needsSetup,
                    redirectUrl: redirectUrl,
                    reason: needsSetup ? 'セットアップが必要' : 'セットアップ完了済み'
                });
                
                // 標準リダイレクト実行（セッション保存完了後）
                console.log('🔄 リダイレクト実行:', redirectUrl);
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
                res.setHeader('Pragma', 'no-cache');
                res.setHeader('Expires', '0');
                
                // 確実なサーバーサイドリダイレクト
                console.log('🔄 セッション保存完了後のリダイレクト実行:', redirectUrl);
                return res.redirect(redirectUrl);
            });
        } else {
            console.log('❌ ログイン失敗 - 無効なメール/パスワード:', email);
            
            userManager.logAuditEvent(null, 'login_failed', `Failed login attempt for ${trimmedEmail}`, 
                req.ip, req.get('User-Agent'));
            
            return res.render('user-login', { 
                error: 'メールアドレスまたはパスワードが正しくありません',
                formData: { email: trimmedEmail },
                csrfToken: req.session.csrfToken
            });
        }
    } catch (error) {
        console.error('❌ ログイン処理エラー:', error);
        console.error('エラースタック:', error.stack);
        console.error('エラー発生時刻:', new Date().toISOString());
        
        return res.status(500).render('user-login', { 
            error: 'ログイン処理中にエラーが発生しました: ' + error.message,
            formData: { email: req.body?.email || '' },
            csrfToken: req.session.csrfToken
        });
    }
    
    console.log('==================================================');
    console.log('📝 POST /login リクエスト完了 - 終了時刻:', new Date().toISOString());
});

// ログアウト処理
app.post('/logout', requireAuth, auditLog('user_logout'), async (req, res) => {
    const userId = req.session.userId;
    
    if (userId) {
        userManager.logAuditEvent(userId, 'logout', 'User logged out', 
            req.ip, req.get('User-Agent'));
    }
    
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destroy error:', err);
        }
        res.redirect('/login');
    });
});

// ユーザー設定保存
app.post('/api/user-settings', requireAuth, validateUserSettings, auditLog('settings_update'), async (req, res) => {
    try {
        const userId = req.session.userId;
        const settings = req.body;
        
        userManager.saveUserSettings(userId, settings);
        
        res.json({ success: true, message: '設定を保存しました' });
    } catch (error) {
        console.error('Settings save error:', error);
        res.status(500).json({ error: '設定の保存に失敗しました' });
    }
});

// ========================
// 既存ルートのマルチユーザー対応
// ========================

// ルートページ（認証チェック追加）
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.redirect('/dashboard');
    } else {
        res.redirect('/login');
    }
});

// 安全な依存関係読み込み（無効化）
/*
let AlertManager, SettingsManager;
let alertManager, settingsManager;

try {
  AlertManager = require('./alertManager');
  alertManager = new AlertManager();
  console.log('✅ AlertManager読み込み成功');
} catch (error) {
  console.log('⚠️ AlertManager読み込みエラー:', error.message);
  alertManager = {
    checkAlerts: () => [],
    getCurrentGoal: () => {
      // 設定ファイルから正しいゴールタイプを読み込み
      try {
        // 優先順位1: ユーザー設定から読み込み
        const userSettingsPath = path.join(__dirname, 'data', 'user_settings.json');
        if (fs.existsSync(userSettingsPath)) {
          const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
          if (Array.isArray(userSettings) && userSettings.length > 0) {
            const latestUserSetting = userSettings[userSettings.length - 1];
            if (latestUserSetting.service_goal || latestUserSetting.goal_type) {
              const goalType = latestUserSetting.service_goal || latestUserSetting.goal_type;
              return { 
                key: goalType,
                name: getGoalName(goalType)
              };
            }
          }
        }

        // 優先順位2: setup.jsonから読み込み
        const setupPath = path.join(__dirname, 'config', 'setup.json');
        if (fs.existsSync(setupPath)) {
          const setupData = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
          if (setupData.goal && setupData.goal.type) {
            return { 
              key: setupData.goal.type,
              name: getGoalName(setupData.goal.type)
            };
          }
        }
      } catch (err) {
        console.error('設定読み込みエラー:', err.message);
      }
      // フォールバック
      return { key: 'toC_newsletter', name: 'toC（メルマガ登録）' };
    },
    getAllGoals: () => [
      { key: 'toC_newsletter', name: 'toC（メルマガ登録）' },
      { key: 'toC_line', name: 'toC（LINE登録）' },
      { key: 'toC_phone', name: 'toC（電話ボタン）' },
      { key: 'toC_purchase', name: 'toC（購入）' },
      { key: 'toB_newsletter', name: 'toB（メルマガ登録）' },
      { key: 'toB_line', name: 'toB（LINE登録）' },
      { key: 'toB_phone', name: 'toB（電話ボタン）' },
      { key: 'toB_purchase', name: 'toB（購入）' }
    ]
  };
}

try {
  SettingsManager = require('./settingsManager');
  settingsManager = new SettingsManager();
  console.log('✅ SettingsManager読み込み成功');
} catch (error) {
  console.log('⚠️ SettingsManager読み込みエラー:', error.message);
  settingsManager = {
    isFullyConfigured: () => false,
    getSettings: () => ({}),
    saveSettings: () => true
  };
}
*/

// 古いrequireAuth関数削除済み - middleware/simpleAuth.jsから使用

// 設定完了判定機能（改善版）
function checkSetupCompletion() {
  try {
    // config/setup.jsonから設定を読み込み
    if (fs.existsSync('./config/setup.json')) {
      const setupData = JSON.parse(fs.readFileSync('./config/setup.json', 'utf8'));
      
      // 必須設定項目の確認
      const hasMetaAPI = !!(setupData.meta?.accessToken && setupData.meta?.accountId);
      const hasChatwork = !!(setupData.chatwork?.apiToken && setupData.chatwork?.roomId);
      const hasGoal = !!(setupData.goal?.type);
      const isConfigured = setupData.isConfigured === true;
      
      console.log('設定完了チェック:', {
        hasMetaAPI,
        hasChatwork,
        hasGoal,
        isConfigured
      });
      
      return hasMetaAPI && hasChatwork && hasGoal && isConfigured;
    }
    
    // 従来のsettings.jsonもチェック（後方互換性）
    if (fs.existsSync('./settings.json')) {
      const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
      
      const hasMetaAPI = !!(settings.meta?.accessToken && settings.meta?.accountId);
      const hasChatwork = !!(settings.chatwork?.apiToken && settings.chatwork?.roomId);
      const hasGoal = !!(settings.goal?.type);
      const isConfigured = settings.isConfigured === true;
      
      return hasMetaAPI && hasChatwork && hasGoal && isConfigured;
    }
    
    return false;
  } catch (error) {
    console.error('設定完了チェックエラー:', error);
    return false;
  }
}

// 設定完了状態をマーク
function markSetupAsComplete() {
  try {
    if (fs.existsSync('./settings.json')) {
      const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
      settings.isConfigured = true;
      settings.setupCompletedAt = new Date().toISOString();
      fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
      console.log('✅ 設定完了状態をマークしました');
    }
  } catch (error) {
    console.error('設定完了マークエラー:', error);
  }
}

// 設定チェックミドルウェア
function requireSetup(req, res, next) {
  if (checkSetupCompletion()) {
    return next();
  } else {
    return res.redirect('/setup');
  }
}

// デバッグ用ミドルウェア（全ルートの前）
app.use((req, res, next) => {
  console.log('=== 全リクエストデバッグ ===');
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  next();
});

// ルートアクセス（設定完了状態に応じて遷移）
app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  if (!req.session.metaAccessToken || !req.session.chatworkApiToken) {
    return res.redirect('/setup');
  }
  res.redirect('/dashboard');
});

// ログインページ
app.get('/auth/login', (req, res) => {
  console.log('ログインページアクセス');
  res.render('login', { 
    title: 'ログイン',
    error: req.query.error
  });
});

app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

// ログイン処理（設定完了状態に応じて遷移）
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('=== ログイン処理開始 ===');
    console.log('ユーザー名:', username);
    
    if (username === 'komiya' && (password === 'komiya' || password === 'password')) {
      req.session.authenticated = true;
      req.session.user = username;
      console.log('認証成功');
      
      // 既存設定をセッションに読み込み
      try {
        const settingsPath = path.join(__dirname, 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
          if (settings.meta?.accessToken) {
            req.session.metaAccessToken = settings.meta.accessToken;
            req.session.metaAccountId = settings.meta.accountId;
          }
          if (settings.chatwork?.apiToken) {
            req.session.chatworkApiToken = settings.chatwork.apiToken;
            req.session.chatworkRoomId = settings.chatwork.roomId;
          }
          console.log('✅ 既存設定をセッションに読み込み完了');
        }
      } catch (error) {
        console.error('⚠️ 設定読み込みエラー:', error);
      }
      
      console.log('セッション状態:', req.session);
      
      // 設定完了状態をチェック（セッションベース）
      if (req.session.setupCompleted) {
        console.log('セッション: 設定完了済み → ダッシュボードにリダイレクト');
        res.redirect('/dashboard');
      } else {
        console.log('セッション: 設定未完了 → 設定画面にリダイレクト');
        res.redirect('/setup');
      }
    } else {
      console.log('認証失敗');
      res.redirect('/auth/login?error=invalid');
    }
  } catch (error) {
    console.error('ログイン処理エラー:', error);
    res.redirect('/auth/login?error=system');
  }
});

// 初期設定ページ（マルチユーザー対応）
app.get('/setup', requireAuth, (req, res) => {
  try {
    // CSRFトークンを強制的に生成と保存
    if (!req.session.csrfToken) {
      req.session.csrfToken = require('crypto').randomBytes(32).toString('hex');
      req.session.save((err) => {
        if (err) console.error('Session save error:', err);
      });
    }
    
    // ユーザーの既存設定を取得
    const userSettings = userManager.getUserSettings(req.session.userId) || {};
    
    console.log('Setup page - CSRF token:', req.session.csrfToken ? 'Available' : 'Missing');
    
    res.render('setup', {
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
      },
      currentConfig: {
        metaAccessToken: userSettings.meta_access_token || '',
        metaAccountId: userSettings.meta_account_id || '',
        chatworkApiToken: userSettings.chatwork_api_token || '',
        chatworkRoomId: userSettings.chatwork_room_id || '',
        serviceGoal: userSettings.service_goal || '',
        targetCpa: userSettings.target_cpa || '',
        targetCpm: userSettings.target_cpm || '',
        targetCtr: userSettings.target_ctr || ''
      },
      csrfToken: req.session.csrfToken
    });
  } catch (error) {
    console.error('Setup page error:', error);
    res.status(500).render('error', { error: '設定ページエラー' });
  }
});

// 設定保存エンドポイント
app.post('/setup', requireAuth, async (req, res) => {
  try {
    const {
      metaAccessToken,
      metaAccountId,
      chatworkApiToken,
      chatworkRoomId,
      goal_type,
      target_cpa,
      target_cpm,
      target_ctr,
      target_budget_rate,
      target_daily_budget,
      target_cv
    } = req.body;

    // ユーザーが入力した値を優先して保存（入力されていない場合のみデフォルト値は使用しない）
    const settings = {
      meta_access_token: metaAccessToken,
      meta_account_id: metaAccountId,
      chatwork_api_token: chatworkApiToken,
      chatwork_room_id: chatworkRoomId,
      service_goal: goal_type,
      target_cpa: target_cpa || '',
      target_cpm: target_cpm || '',
      target_ctr: target_ctr || '',
      target_cv: target_cv || '',
      target_budget_rate: target_budget_rate || '',
      target_daily_budget: target_daily_budget || '',
      enable_scheduler: true,
      schedule_hours: [9, 12, 15, 17, 19],
      enable_chatwork: true,
      enable_alerts: true
    };

    // 設定ファイルに保存
    const settingsPath = path.join(__dirname, 'data', 'user_settings', `${req.session.userId}.json`);
    const settingsDir = path.dirname(settingsPath);
    
    // ディレクトリが存在しない場合は作成
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
    
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    console.log('User settings saved:', req.session.userId);
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Setup save error:', error);
    res.status(500).render('error', { error: '設定保存エラー' });
  }
});

// ダッシュボード（マルチユーザー対応）
app.get('/dashboard', requireAuth, async (req, res) => {
  try {
    console.log('Dashboard route accessed for user:', req.session.userId);
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(req.session.userId);
    
    if (!userSettings || !userSettings.meta_access_token || !userSettings.chatwork_api_token) {
      console.log('Missing user settings, redirecting to setup');
      return res.redirect('/setup');
    }
    
    // ユーザーの広告データを取得
    const userAdData = userManager.getUserAdData(req.session.userId, 30); // 最新30件
    
    console.log('Rendering dashboard for user:', req.session.userEmail);
    res.render('dashboard', {
      user: {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
      },
      userSettings: userSettings,
      adData: userAdData
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', { error: 'ダッシュボード読み込みエラー' });
  }
});

// 古い重複エンドポイントを削除済み

// ゴール名取得ヘルパー関数
function getGoalName(goalType) {
  const goalNames = {
    'toC_newsletter': 'toC（メルマガ登録）',
    'toC_line': 'toC（LINE登録）',
    'toC_phone': 'toC（電話ボタン）',
    'toC_purchase': 'toC（購入）',
    'toB_newsletter': 'toB（メルマガ登録）',
    'toB_line': 'toB（LINE登録）',
    'toB_phone': 'toB（電話ボタン）',
    'toB_purchase': 'toB（購入）'
  };
  return goalNames[goalType] || goalType;
}

// メトリクス表示名取得ヘルパー関数
function getMetricDisplayName(metric) {
    switch (metric) {
        case 'budget_rate':
            return '予算消化率';
        case 'daily_budget':
            return '日予算';
        case 'ctr':
            return 'CTR';
        case 'conversions':
            return 'CV';
        case 'cpm':
        case 'cpm_increase':
            return 'CPM';
        case 'cpa':
        case 'cpa_rate':
            return 'CPA';
        default:
            return metric;
    }
}

// 古いセットアップルートを削除済み - routes/setup.jsを使用

// キャンペーンリスト取得API
app.get('/api/campaigns', requireAuth, async (req, res) => {
  try {
    console.log('=== キャンペーンリスト取得開始 ===');
    console.log('🔍 ユーザーID:', req.session.userId);
    
    const config = getMetaApiConfigFromSetup(req.session.userId);
    if (!config || !config.accessToken || !config.accountId) {
      return res.status(400).json({
        success: false,
        error: 'Meta API設定が見つかりません'
      });
    }
    
    const { accessToken, accountId } = config;
    const baseUrl = 'https://graph.facebook.com/v18.0';
    const endpoint = `${baseUrl}/${accountId}/campaigns`;
    
    const params = new URLSearchParams({
      access_token: accessToken,
      fields: 'id,name,status,objective,created_time,updated_time',
      limit: '100'
    });
    
    console.log('Meta API呼び出し:', `${endpoint}?${params}`);
    
    const response = await axios.get(`${endpoint}?${params}`, {
      timeout: 30000
    });
    
    if (response.data && response.data.data) {
      const campaigns = response.data.data.map(campaign => ({
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        created_time: campaign.created_time,
        updated_time: campaign.updated_time
      }));
      
      console.log(`✅ キャンペーンリスト取得成功: ${campaigns.length}件`);
      res.json({
        success: true,
        campaigns: campaigns,
        total: campaigns.length
      });
    } else {
      throw new Error('Invalid API response format');
    }
    
  } catch (error) {
    console.error('❌ キャンペーンリスト取得失敗:', error.message);
    res.status(500).json({
      success: false,
      error: 'キャンペーンリストの取得に失敗しました',
      details: error.message
    });
  }
});

// Phase 1: セッション設定用の簡易ルート追加（既存ルーティングは削除しない）
app.post('/temp-api-setup', (req, res) => {
  // テスト用：セッションに一時保存
  if (req.body.metaAccessToken) {
    req.session.metaAccessToken = req.body.metaAccessToken;
  }
  if (req.body.chatworkApiToken) {
    req.session.chatworkApiToken = req.body.chatworkApiToken;
  }
  res.redirect('/dashboard');
});

app.get('/save-setup-get', (req, res) => {
  console.log('=== GET SETUP BACKUP ===');
  console.log('Query params:', req.query);
  if (!req.session.user) {
    return res.redirect('/login');
  }
  try {
    req.session.metaAccessToken = req.query.metaAccessToken;
    req.session.metaAccountId = req.query.metaAccountId;
    req.session.chatworkApiToken = req.query.chatworkApiToken;
    req.session.chatworkRoomId = req.query.chatworkRoomId;
    console.log('GET session saved, redirecting to dashboard');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('GET setup error:', error);
    res.status(500).send('GET setup failed');
  }
});

// アラートシステムのインポート
const { checkAllAlerts, getAlertHistory, getAlertSettings } = require('./alertSystem');

// アラート関連のルートを app.js に追加

// アラート内容ページ
app.get('/alerts', requireAuth, async (req, res) => {
    try {
        console.log('=== /alerts ルート開始 ===');
        console.log('アラートページにアクセス - ユーザー:', req.session.userId);
        
        const userId = req.session.userId;
        const { checkUserAlerts, getCurrentGoalType, getAlertHistory } = require('./alertSystem');
        
        // 現在のゴールタイプを取得（ユーザー固有）
        const currentGoalType = getCurrentGoalType(userId);
        console.log('現在のゴールタイプ:', currentGoalType, 'for user:', userId);
        
        // ユーザーの現在のアラートを取得（アクティブなアラート履歴から）
        const alertHistory = await getAlertHistory();
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const alerts = alertHistory.filter(alert => 
            alert.status === 'active' && new Date(alert.timestamp) > thirtyDaysAgo
        );
        console.log('=== /alertsルート詳細ログ ===');
        console.log('取得したアラート数:', alerts.length);
        console.log('アラート詳細:', alerts.map(alert => ({
            metric: alert.metric,
            message: alert.message,
            checkItemsCount: alert.checkItems ? alert.checkItems.length : 0,
            improvementsCount: alert.improvements ? Object.keys(alert.improvements).length : 0
        })));
        console.log('🔍 アラート取得完了 - 次はユーザー設定取得');
        
        // ユーザー設定を取得
        let userSettings = null;
        try {
            console.log('🔍 UserManager呼び出し開始 - ユーザーID:', userId);
            const UserManager = require('./userManager');
            const userManagerInstance = new UserManager();
            userSettings = userManagerInstance.getUserSettings(userId);
            console.log('✅ ユーザー設定取得成功:', userId, userSettings ? 'あり' : 'なし');
            if (userSettings) {
                console.log('  - goal_type:', userSettings.goal_type);
                console.log('  - target_cpa:', userSettings.target_cpa);
                console.log('  - target_ctr:', userSettings.target_ctr);
            }
        } catch (settingsError) {
            console.error('❌ ユーザー設定取得エラー:', settingsError.message);
            userSettings = null;
        }
        
        // 📊 レンダリング前のデータ確認
        console.log('🔍 ALERTS RENDER前のデータ確認:');
        console.log('   - alerts数:', alerts.length);
        console.log('   - alerts内容:', JSON.stringify(alerts, null, 2));
        
        // アラートがない場合は履歴から取得またはサンプルデータを生成
        let displayAlerts = alerts;
        if (alerts.length === 0) {
            console.log('📌 新規アラートがないため、履歴から取得');
            // アラート履歴から最新のアクティブなアラートを取得
            const historyPath = path.join(__dirname, 'alert_history.json');
            if (fs.existsSync(historyPath)) {
                try {
                    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                    // アクティブなアラートのみを取得（最新10件まで）
                    displayAlerts = history
                        .filter(alert => alert.status === 'active')
                        .slice(0, 10);
                    console.log(`📊 履歴から${displayAlerts.length}件のアクティブアラートを取得`);
                } catch (error) {
                    console.error('履歴読み込みエラー:', error);
                    displayAlerts = [];
                }
            }
            
            // それでも空の場合のみサンプルデータを生成
            if (displayAlerts.length === 0) {
                console.log('📌 履歴もないため、サンプルデータを生成');
                displayAlerts = [
                    {
                        id: 'sample1',
                        metric: 'CPA',
                        message: '目標CPAを20%超過しています（目標: 1,000円、実績: 1,200円）',
                        severity: 'warning',
                        timestamp: new Date(),
                        checkItems: [
                            { title: 'ターゲティング設定の見直し', priority: 1, description: '年齢層と地域の設定を確認' },
                            { title: 'クリエイティブの疲労度チェック', priority: 2, description: '同じ広告の表示頻度を確認' }
                        ],
                        improvements: {
                            'オーディエンスの最適化': ['類似オーディエンスの活用', 'カスタムオーディエンスの作成'],
                            'クリエイティブの改善': ['新しい広告素材の追加', 'A/Bテストの実施']
                        }
                    }
                ];
            }
        }
        
        res.render('alerts', {
            title: 'アラート内容 - Meta広告ダッシュボード',
            alerts: displayAlerts,
            currentGoalType: currentGoalType,
            userSettings: userSettings,
            user: {
                id: req.session.userId,
                email: req.session.userEmail,
                name: req.session.userName
            }
        });
    } catch (error) {
        console.error('=== /alerts ルートエラー ===');
        console.error('アラートページエラー:', error);
        console.error('エラースタック:', error.stack);
        const { getCurrentGoalType } = require('./alertSystem');
        const currentGoalType = getCurrentGoalType();
        // エラー時でもユーザー設定を取得
        let userSettings = null;
        try {
            const UserManager = require('./userManager');
            const userManagerInstance = new UserManager();
            userSettings = userManagerInstance.getUserSettings(req.session.userId);
        } catch (settingsError) {
            console.error('エラー時ユーザー設定取得エラー:', settingsError);
            userSettings = null;
        }
        
        res.render('alerts', {
            title: 'アラート内容 - Meta広告ダッシュボード',
            alerts: [],
            currentGoalType: currentGoalType,
            userSettings: userSettings,
            error: 'アラートの取得に失敗しました'
        });
    }
});

// ユーザー設定API
app.get('/api/user-settings', requireAuth, (req, res) => {
    try {
        const UserManager = require('./userManager');
        const userManagerInstance = new UserManager();
        const userSettings = userManagerInstance.getUserSettings(req.session.userId);
        
        res.json({
            success: true,
            data: userSettings,
            goalType: userSettings?.goal_type || 'toC_line'
        });
    } catch (error) {
        console.error('ユーザー設定取得エラー:', error);
        res.json({
            success: false,
            error: 'ユーザー設定の取得に失敗しました'
        });
    }
});

// アラート履歴ページ
app.get('/alert-history', requireAuth, async (req, res) => {
    try {
        console.log('=== アラート履歴ページアクセス ===');
        
        const { getAlertHistory } = require('./alertSystem');
        let alerts = await getAlertHistory();
        
        console.log('アラート履歴数:', alerts.length);
        
        // アラートがない場合は履歴ファイルから直接読み込み
        if (alerts.length === 0) {
            const historyPath = path.join(__dirname, 'alert_history.json');
            if (fs.existsSync(historyPath)) {
                try {
                    alerts = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
                    console.log(`📊 履歴ファイルから${alerts.length}件のアラートを取得`);
                } catch (error) {
                    console.error('履歴ファイル読み込みエラー:', error);
                }
            }
        }
        
        // それでも空の場合のみサンプルデータを生成
        if (alerts.length === 0) {
            console.log('📌 履歴ファイルもないため、サンプルデータを生成');
            const today = new Date();
            alerts = [
                {
                    id: 'history1',
                    metric: 'CPA',
                    message: '目標CPAを超過しました（1,500円→2,000円）',
                    severity: 'critical',
                    status: 'resolved',
                    timestamp: new Date(today.getTime() - 86400000 * 5) // 5日前
                },
                {
                    id: 'history2',
                    metric: 'CTR',
                    message: 'CTRが基準値を下回りました（2.0%→1.5%）',
                    severity: 'warning',
                    status: 'resolved',
                    timestamp: new Date(today.getTime() - 86400000 * 3) // 3日前
                },
                {
                    id: 'history3',
                    metric: '予算消化率',
                    message: '予算消化率が低下しています（80%→60%）',
                    severity: 'warning',
                    status: 'active',
                    timestamp: new Date(today.getTime() - 86400000 * 1) // 1日前
                },
                {
                    id: 'history4',
                    metric: 'CPM',
                    message: 'CPMが上昇しています（1,000円→1,300円）',
                    severity: 'warning',
                    status: 'active',
                    timestamp: new Date() // 今日
                }
            ];
        }
        
        res.render('alert-history', {
            title: 'アラート履歴 - Meta広告ダッシュボード',
            alerts: alerts,
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    } catch (error) {
        console.error('アラート履歴ページエラー:', error);
        res.render('alert-history', {
            title: 'アラート履歴 - Meta広告ダッシュボード',
            alerts: [],
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    }
});

// 確認事項API
app.get('/api/check-items', requireAuth, async (req, res) => {
    try {
        console.log('=== API確認事項へのアクセス ===');
        console.log('ユーザーID:', req.session.userId);
        
        const userId = req.session.userId;
        
        // アラートシステムを安全に読み込み
        let alerts = [];
        try {
            const { getAlertHistory } = require('./alertSystem');
            console.log('alertSystem.js を読み込み成功');
            
            // アクティブなアラート履歴を取得
            const alertHistory = await getAlertHistory();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            alerts = alertHistory.filter(alert => 
                alert.status === 'active' && new Date(alert.timestamp) > thirtyDaysAgo
            );
            console.log('=== /api/check-items詳細ログ ===');
            console.log('取得したアラート数:', alerts.length);
            console.log('アラート詳細:', alerts.map(alert => ({
                metric: alert.metric,
                message: alert.message,
                checkItemsCount: alert.checkItems ? alert.checkItems.length : 0
            })));
        } catch (alertError) {
            console.error('アラートシステム読み込みエラー:', alertError);
            alerts = [];
        }
        
        // アラートから確認事項を抽出
        const checkItems = [];
        console.log('=== 確認事項抽出デバッグ ===');
        alerts.forEach((alert, index) => {
            console.log(`アラート${index + 1}:`, {
                id: alert.id,
                metric: alert.metric,
                message: alert.message,
                hasCheckItems: !!alert.checkItems,
                checkItemsLength: alert.checkItems ? alert.checkItems.length : 0,
                checkItems: alert.checkItems
            });
            
            // checkItemsが存在する場合は使用
            if (alert.checkItems && alert.checkItems.length > 0) {
                alert.checkItems.forEach((item, itemIndex) => {
                    console.log(`  - checkItem${itemIndex + 1}:`, item);
                    checkItems.push({
                        metric: alert.metric,
                        message: alert.message,
                        priority: item.priority || 1,
                        title: item.title,
                        description: item.description
                    });
                });
            }
        });
        
        // 重複除去処理を修正
        const uniqueCheckItems = [];
        const seen = new Set();
        
        checkItems.forEach(item => {
            const key = `${item.metric}-${item.title}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueCheckItems.push(item);
            }
        });
        
        console.log('=== 最終結果 ===');
        console.log('重複除去前のcheckItems数:', checkItems.length);
        console.log('重複除去後のcheckItems数:', uniqueCheckItems.length);
        console.log('最終checkItems:', uniqueCheckItems);
        
        res.json({
            success: true,
            checkItems: uniqueCheckItems
        });
        
    } catch (error) {
        console.error('確認事項API取得エラー:', error);
        res.json({
            success: false,
            error: 'データ取得に失敗しました',
            checkItems: []
        });
    }
});

// アラート履歴API
app.get('/api/alert-history', requireAuth, async (req, res) => {
    try {
        console.log('=== APIアラート履歴へのアクセス ===');
        console.log('ユーザーID:', req.session.userId);
        
        const { getAlertHistory } = require('./alertSystem');
        const alertHistory = await getAlertHistory();
        
        console.log('取得したアラート履歴数:', alertHistory.length);
        
        res.json({
            success: true,
            alerts: alertHistory
        });
        
    } catch (error) {
        console.error('アラート履歴API取得エラー:', error);
        res.json({
            success: false,
            error: 'データ取得に失敗しました',
            alerts: []
        });
    }
});

// 改善施策API
app.get('/api/improvement-strategies', requireAuth, async (req, res) => {
    try {
        console.log('=== API改善施策へのアクセス ===');
        console.log('ユーザーID:', req.session.userId);
        
        const { getAlertHistory } = require('./alertSystem');
        const alertHistory = await getAlertHistory();
        
        // アクティブなアラートから改善施策を抽出
        const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
        const improvements = [];
        
        activeAlerts.forEach(alert => {
            if (alert.improvements) {
                Object.entries(alert.improvements).forEach(([checkTitle, strategies]) => {
                    improvements.push({
                        metric: alert.metric,
                        message: alert.message,
                        checkTitle: checkTitle,
                        strategies: strategies
                    });
                });
            }
        });
        
        console.log('取得した改善施策数:', improvements.length);
        
        res.json({
            success: true,
            improvements: improvements
        });
        
    } catch (error) {
        console.error('改善施策API取得エラー:', error);
        res.json({
            success: false,
            error: 'データ取得に失敗しました',
            improvements: []
        });
    }
});

// 確認事項ページ
app.get('/improvement-tasks', requireAuth, async (req, res) => {
    try {
        console.log('=== 確認事項ページアクセス ===');
        const userId = req.session.userId;
        
        // アラート履歴から確認事項を取得
        let checkItems = [];
        try {
            const { getAlertHistory } = require('./alertSystem');
            const alertHistory = await getAlertHistory();
            const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
            
            // 確認事項を抽出
            activeAlerts.forEach(alert => {
                if (alert.checkItems && alert.checkItems.length > 0) {
                    alert.checkItems.forEach(item => {
                        checkItems.push({
                            metric: alert.metric,
                            message: alert.message,
                            priority: item.priority || 1,
                            title: item.title,
                            description: item.description
                        });
                    });
                }
            });
        } catch (alertError) {
            console.error('アラート取得エラー:', alertError);
        }
        
        // データがない場合はサンプルデータを生成
        if (checkItems.length === 0) {
            console.log('確認事項が空なのでサンプルデータを生成');
            checkItems = [
                {
                    metric: 'CPA',
                    message: '目標CPAを20%超過しています',
                    priority: 1,
                    title: 'ターゲティング設定の確認',
                    description: 'オーディエンスサイズが大きすぎる可能性があります'
                },
                {
                    metric: 'CPA',
                    message: '目標CPAを20%超過しています',
                    priority: 2,
                    title: '広告クリエイティブの確認',
                    description: 'CTRが低下している可能性があります'
                },
                {
                    metric: 'CTR',
                    message: 'CTRが1.5%を下回っています',
                    priority: 1,
                    title: '広告文の見直し',
                    description: '訴求内容がターゲットに合っていない可能性があります'
                },
                {
                    metric: 'CTR',
                    message: 'CTRが1.5%を下回っています',
                    priority: 2,
                    title: 'ビジュアルの最適化',
                    description: '画像や動画の品質を改善してください'
                },
                {
                    metric: 'Budget',
                    message: '予算消化率が80%を超えています',
                    priority: 1,
                    title: '予算配分の見直し',
                    description: 'パフォーマンスの良いキャンペーンに予算を集中させてください'
                },
                {
                    metric: 'ROAS',
                    message: 'ROASが目標を下回っています',
                    priority: 1,
                    title: 'コンバージョン最適化',
                    description: 'コンバージョン設定が適切か確認してください'
                }
            ];
        }
        
        console.log('確認事項数:', checkItems.length);
        
        res.render('improvement-tasks', {
            title: '確認事項 - Meta広告ダッシュボード',
            checkItems: checkItems,
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    } catch (error) {
        console.error('確認事項ページエラー:', error);
        res.render('improvement-tasks', {
            title: '確認事項 - Meta広告ダッシュボード',
            checkItems: [],
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    }
});

// 改善施策ページ
app.get('/improvement-strategies', requireAuth, async (req, res) => {
    try {
        console.log('=== 改善施策ページアクセス ===');
        
        let improvements = {};
        try {
            const { getAlertHistory } = require('./alertSystem');
            const alertHistory = await getAlertHistory();
            const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
            
            // アラートから改善施策を抽出
            activeAlerts.forEach(alert => {
                if (alert.improvements && Object.keys(alert.improvements).length > 0) {
                    Object.keys(alert.improvements).forEach(key => {
                        if (!improvements[key]) {
                            improvements[key] = [];
                        }
                        alert.improvements[key].forEach(strategy => {
                            if (!improvements[key].includes(strategy)) {
                                improvements[key].push(strategy);
                            }
                        });
                    });
                }
            });
        } catch (alertError) {
            console.error('アラート取得エラー:', alertError);
        }
        
        // データがない場合はサンプルデータを生成
        if (Object.keys(improvements).length === 0) {
            console.log('改善施策が空なのでサンプルデータを生成');
            improvements = {
                'ターゲティング設定の確認': [
                    'カスタムオーディエンスを作成して、より精度の高いターゲティングを行う',
                    '類似オーディエンスのサイズを1-3%に絞り込む',
                    '年齢・性別・地域の設定を見直し、最適化する',
                    '興味関心カテゴリーを再検討し、関連性の高いものに絞る'
                ],
                '広告クリエイティブの確認': [
                    'A/Bテストを実施して、パフォーマンスの良いクリエイティブを特定',
                    '動画広告の最初の3秒を改善し、視聴者の注意を引く',
                    'カルーセル広告を試して、複数の商品/サービスを訴求',
                    '広告文のCTAボタンを明確にし、行動を促す'
                ],
                '広告文の見直し': [
                    'ベネフィットを明確に伝える文章に変更',
                    '数字や具体的な成果を含めて信頼性を高める',
                    '緊急性や限定性を訴求して、行動を促進',
                    'ターゲットの課題や悩みに直接訴えかける文章にする'
                ],
                'ビジュアルの最適化': [
                    '高品質な画像や動画を使用し、プロフェッショナルな印象を与える',
                    'ブランドカラーを統一し、認知度を高める',
                    'モバイルファーストで設計し、スマートフォンでの見やすさを重視',
                    'テキストオーバーレイは20%以下に抑える'
                ],
                '予算配分の見直し': [
                    'パフォーマンスの高いキャンペーンに予算を集中',
                    '曜日・時間帯別の配信を最適化',
                    '自動入札戦略を活用して、効率的な予算配分を実現',
                    'キャンペーン予算最適化（CBO）を有効にする'
                ],
                'コンバージョン最適化': [
                    'ピクセルの設置を確認し、正確なトラッキングを実現',
                    'コンバージョンAPIを導入して、データの精度を向上',
                    'マイクロコンバージョンを設定し、最適化の機会を増やす',
                    'ランディングページの改善で、コンバージョン率を向上'
                ]
            };
        }
        
        console.log('改善施策カテゴリ数:', Object.keys(improvements).length);
        
        res.render('improvement-strategies', {
            title: '改善施策 - Meta広告ダッシュボード',
            improvements: improvements,
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    } catch (error) {
        console.error('改善施策ページエラー:', error);
        res.render('improvement-strategies', {
            title: '改善施策 - Meta広告ダッシュボード',
            improvements: {},
            user: {
                id: req.session.userId,
                name: req.session.userName
            }
        });
    }
});

// チャットワークテストページ
app.get('/chatwork-test', requireAuth, (req, res) => {
    res.render('chatwork-test');
});

// デバッグ用エンドポイント
app.get('/debug/user-settings/:userId?', requireAuth, (req, res) => {
    try {
        const userId = req.params.userId || req.session.userId;
        console.log('Debug - ユーザーID:', userId);
        
        const userSettings = userManager.getUserSettings(userId);
        
        res.json({
            success: true,
            userId: userId,
            userSettings: userSettings,
            sessionUserId: req.session.userId,
            hasSettings: !!userSettings
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/debug/alert-test/:userId?', requireAuth, async (req, res) => {
    try {
        const userId = req.params.userId || req.session.userId;
        console.log('Debug Alert Test - ユーザーID:', userId);
        
        const { checkUserAlerts, getTargetCPA, getTargetCPM } = require('./alertSystem');
        
        // 目標値取得テスト
        const targetCPA = await getTargetCPA(userId);
        const targetCPM = await getTargetCPM(userId);
        
        // アラート生成テスト
        let alerts = [];
        let alertError = null;
        
        try {
            alerts = await checkUserAlerts(userId);
        } catch (error) {
            alertError = {
                message: error.message,
                stack: error.stack
            };
        }
        
        res.json({
            success: true,
            userId: userId,
            targets: {
                cpa: targetCPA,
                cpm: targetCPM
            },
            alerts: alerts,
            alertError: alertError,
            alertCount: alerts.length
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// アラートデータAPI
app.get('/api/alerts-data', async (req, res) => {
    try {
        const alerts = await getCurrentAlerts();
        const alertHistory = await getAlertHistory();
        
        res.json({
            success: true,
            alerts: alerts,
            history: alertHistory,
            lastCheck: new Date().toISOString()
        });
    } catch (error) {
        console.error('アラートデータ取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// アラート履歴API
app.get('/api/alerts-history', requireAuth, async (req, res) => {
  try {
    // 過去7日間のアラート履歴を生成（実際にはDBから取得）
    const history = [];
    const metrics = ['CPA', 'CTR', 'CPM', '予算消化率'];
    const today = new Date();
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // ランダムにアラートを生成（実際のデータがない場合のサンプル）
      if (Math.random() > 0.5) {
        history.push({
          date: date.toISOString(),
          metric: metrics[Math.floor(Math.random() * metrics.length)],
          message: `目標値を${Math.floor(Math.random() * 30 + 10)}%下回りました`,
          resolved: i > 2 // 3日以上前のものは解決済みとする
        });
      }
    }
    
    res.json({
      success: true,
      history: history
    });
  } catch (error) {
    console.error('アラート履歴取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'アラート履歴の取得に失敗しました'
    });
  }
});

// 改善施策API
app.get('/api/improvements', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      improvements: {
        cpa: [
          'オーディエンスの絞り込み',
          '広告クリエイティブのA/Bテスト',
          'リターゲティング設定の見直し'
        ],
        ctr: [
          '広告コピーの見直し',
          'ビジュアル要素の改善',
          'プレースメントの最適化'
        ],
        budgetRate: [
          'ターゲット層の拡大',
          '入札価格の調整',
          '配信時間帯の拡大'
        ]
      }
    });
  } catch (error) {
    console.error('改善施策取得エラー:', error);
    res.status(500).json({
      success: false,
      error: '改善施策の取得に失敗しました'
    });
  }
});

// アラートデータ取得API（既存）
app.get('/api/alerts', requireAuth, async (req, res) => {
    try {
        console.log('=== /api/alerts - アラートデータ取得開始 ===');
        
        // アラート履歴からアクティブなアラートを取得
        const alertHistory = await getAlertHistory();
        const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
        console.log('アラート履歴総数:', alertHistory.length);
        console.log('アクティブアラート数:', activeAlerts.length);
        
        const alertSettings = getAlertSettings();
        
        res.json({
            success: true,
            alerts: activeAlerts,  // historyからアクティブなアラートを返す
            history: alertHistory,
            settings: alertSettings,
            lastCheck: new Date().toISOString()
        });
    } catch (error) {
        console.error('アラートデータ取得エラー:', error);
        
        // フォールバック: エラー時でも基本的な構造を返す
        try {
            const alertHistory = await getAlertHistory();
            const activeAlerts = alertHistory.filter(alert => alert.status === 'active');
            const alertSettings = getAlertSettings();
            
            console.log('フォールバック: アクティブアラート数:', activeAlerts.length);
            
            res.json({
                success: false,
                alerts: activeAlerts,  // フォールバック時もアクティブアラートを返す
                history: alertHistory,
                settings: alertSettings,
                lastCheck: new Date().toISOString(),
                error: error.message,
                fallback: true
            });
        } catch (fallbackError) {
            console.error('フォールバック処理も失敗:', fallbackError);
            res.status(500).json({
                success: false,
                alerts: [],
                history: [],
                settings: {},
                error: error.message,
                fallbackError: fallbackError.message
            });
        }
    }
});

// 一時的なアラートデータ取得（app.jsに追加）
async function getCurrentAlerts() {
    try {
        // アラート履歴からアクティブなアラートを取得
        const history = await getAlertHistory();
        return history.filter(alert => alert.status === 'active');
    } catch (error) {
        console.error('アラート取得エラー:', error);
        return [];
    }
}

// アラート検知時の履歴追加関数
async function addAlertToHistory(alert) {
    try {
        const alertHistoryManager = require('./utils/alertHistoryManager');
        const newAlert = {
            metric: alert.metric,
            message: alert.message,
            level: alert.level || 'medium',
            status: 'active'
        };
        
        alertHistoryManager.addAlertToHistory(newAlert);
        console.log('✅ アラートを履歴に追加:', newAlert);
    } catch (error) {
        console.error('❌ アラート履歴追加エラー:', error);
    }
}

app.get('/history', requireAuth, (req, res) => {
  try {
    res.render('history', { title: 'アラート履歴' });
  } catch (error) {
    res.status(500).send('履歴ページエラー: ' + error.message);
  }
});

app.get('/check', requireAuth, (req, res) => {
  try {
    res.render('check', { 
      title: '確認事項'
    });
  } catch (error) {
    res.status(500).send('確認事項ページエラー: ' + error.message);
  }
});

// 重複したアラート取得APIを削除（上位のものを使用）

// チャットワーク送信API
app.post('/api/send-chatwork', requireAuth, async (req, res) => {
  try {
    console.log('=== チャットワーク送信API ===');
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが指定されていません' });
    }
    
    // 設定ファイルからチャットワーク設定を取得
    let chatworkConfig = null;
    try {
      const settingsPath = path.join(__dirname, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        chatworkConfig = settings.chatwork;
      }
    } catch (error) {
      console.error('設定ファイル読み込みエラー:', error);
    }
    
    if (!chatworkConfig || !chatworkConfig.apiToken || !chatworkConfig.roomId) {
      return res.status(400).json({ error: 'チャットワーク設定が不完全です' });
    }
    
    // チャットワークに送信
    const chatworkResponse = await axios.post(
      `https://api.chatwork.com/v2/rooms/${chatworkConfig.roomId}/messages`,
      `body=${encodeURIComponent(message)}`,
      {
        headers: {
          'X-ChatWorkToken': chatworkConfig.apiToken,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    console.log('チャットワーク送信成功:', chatworkResponse.data);
    res.json({ success: true, message: 'チャットワークに送信しました' });
    
  } catch (error) {
    console.error('チャットワーク送信詳細エラー:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: error.config ? {
        url: error.config.url,
        method: error.config.method,
        headers: error.config.headers
      } : null
    });
    
    res.status(500).json({ 
      error: 'チャットワーク送信に失敗しました',
      details: error.message,
      troubleshooting: 'APIトークンとルームIDを確認してください'
    });
  }
});

// キャンペーン複製API
app.post('/api/campaigns/duplicate', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { campaign_id } = req.body;
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.meta_access_token) {
      return res.status(400).json({ 
        success: false,
        error: 'Meta APIの設定が必要です' 
      });
    }
    
    // キャンペーン情報を取得
    const campaignUrl = `https://graph.facebook.com/v21.0/${campaign_id}`;
    const campaignResponse = await axios.get(campaignUrl, {
      params: {
        access_token: userSettings.meta_access_token,
        fields: 'name,objective,status,daily_budget,lifetime_budget'
      }
    });
    
    const originalCampaign = campaignResponse.data;
    
    // 複製用の新しいキャンペーンを作成
    const createUrl = `https://graph.facebook.com/v21.0/${userSettings.meta_account_id}/campaigns`;
    const newCampaignData = {
      name: `${originalCampaign.name}_コピー_${new Date().toISOString().split('T')[0]}`,
      objective: originalCampaign.objective,
      status: 'PAUSED', // 複製時は一時停止状態で作成
      special_ad_categories: [],
      access_token: userSettings.meta_access_token
    };
    
    // 予算設定があればコピー
    if (originalCampaign.daily_budget) {
      newCampaignData.daily_budget = originalCampaign.daily_budget;
    }
    if (originalCampaign.lifetime_budget) {
      newCampaignData.lifetime_budget = originalCampaign.lifetime_budget;
    }
    
    const createResponse = await axios.post(createUrl, newCampaignData);
    
    res.json({
      success: true,
      campaign_id: createResponse.data.id,
      message: 'キャンペーンを複製しました'
    });
    
  } catch (error) {
    console.error('キャンペーン複製エラー:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'キャンペーンの複製に失敗しました'
    });
  }
});

// キャンペーンステータス変更API
app.post('/api/campaigns/status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { campaign_id, status } = req.body;
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.meta_access_token) {
      return res.status(400).json({ 
        success: false,
        error: 'Meta APIの設定が必要です' 
      });
    }
    
    // キャンペーンステータスを更新
    const updateUrl = `https://graph.facebook.com/v21.0/${campaign_id}`;
    const updateResponse = await axios.post(updateUrl, {
      status: status,
      access_token: userSettings.meta_access_token
    });
    
    res.json({
      success: true,
      message: `キャンペーンを${status === 'ACTIVE' ? '再開' : '停止'}しました`
    });
    
  } catch (error) {
    console.error('ステータス変更エラー:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'ステータスの変更に失敗しました'
    });
  }
});

// 全キャンペーンの詳細数値を取得
app.get('/api/campaigns/details', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const period = req.query.period || 'last_7d';
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.meta_access_token) {
      return res.status(400).json({ 
        success: false,
        error: 'Meta APIの設定が必要です' 
      });
    }
    
    // キャンペーン一覧を取得
    const campaignsUrl = `https://graph.facebook.com/v18.0/${userSettings.meta_account_id}/campaigns`;
    const campaignsResponse = await axios.get(campaignsUrl, {
      params: {
        access_token: userSettings.meta_access_token,
        fields: 'id,name,status,objective',
        limit: 100
      }
    });
    
    const campaigns = campaignsResponse.data.data || [];
    const campaignDetails = [];
    
    // 各キャンペーンのインサイトを取得
    for (const campaign of campaigns) {
      try {
        const insightsUrl = `https://graph.facebook.com/v18.0/${campaign.id}/insights`;
        
        // 期間パラメータの設定
        let insightParams = {
          access_token: userSettings.meta_access_token,
          fields: 'impressions,clicks,spend,ctr,cpm,conversions,actions,frequency,reach',
          time_increment: 'all_days'
        };
        
        if (period === 'lifetime' || period === 'all') {
          // 全期間の場合はキャンペーン作成日から今日まで
          const createdDate = campaign.created_time ? campaign.created_time.split('T')[0] : '2024-01-01';
          const today = new Date().toISOString().split('T')[0];
          insightParams.time_range = JSON.stringify({
            since: createdDate,
            until: today
          });
          console.log(`キャンペーン ${campaign.name} の全期間データ取得: ${createdDate} - ${today}`);
        } else {
          // 通常の期間指定
          insightParams.date_preset = period;
        }
        
        const insightsResponse = await axios.get(insightsUrl, {
          params: insightParams
        });
        
        const insights = insightsResponse.data.data[0] || {};
        // getConversionsFromActions関数を使用してすべてのコンバージョンタイプを検出
        const conversions = getConversionsFromActions(insights.actions);
        const cpa = conversions > 0 ? (parseFloat(insights.spend) / conversions) : null;
        
        campaignDetails.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          spend: parseFloat(insights.spend || 0),
          impressions: parseInt(insights.impressions || 0),
          clicks: parseInt(insights.clicks || 0),
          ctr: parseFloat(insights.ctr || 0),
          cpm: parseFloat(insights.cpm || 0),
          conversions: parseInt(conversions),
          cpa: cpa,
          frequency: parseFloat(insights.frequency || 0),
          reach: parseInt(insights.reach || 0)
        });
      } catch (insightError) {
        console.log(`キャンペーン${campaign.id}のインサイト取得エラー:`, insightError.message);
        // エラーがあってもキャンペーン基本情報は返す
        campaignDetails.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          objective: campaign.objective,
          spend: 0,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpm: 0,
          conversions: 0,
          cpa: 0,
          frequency: 0,
          reach: 0
        });
      }
    }
    
    // 結果をソート（広告費の多い順）
    campaignDetails.sort((a, b) => b.spend - a.spend);
    
    res.json({
      success: true,
      campaigns: campaignDetails,
      total: campaignDetails.length,
      period: period
    });
  } catch (error) {
    console.error('キャンペーン詳細取得エラー:', error);
    res.status(500).json({ 
      success: false,
      error: 'キャンペーン詳細の取得に失敗しました' 
    });
  }
});

// キャンペーン詳細API
app.get('/api/campaign/:id/insights', requireAuth, async (req, res) => {
  try {
    const campaignId = req.params.id;
    const userId = req.session.userId;
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.meta_access_token) {
      return res.status(400).json({ 
        success: false,
        error: 'Meta APIの設定が必要です' 
      });
    }
    
    const url = `https://graph.facebook.com/v18.0/${campaignId}/insights`;
    const params = {
      access_token: userSettings.meta_access_token,
      fields: 'impressions,clicks,spend,ctr,cpm,conversions,actions,frequency,reach',
      date_preset: req.query.date_preset || 'last_7d',
      time_increment: 1
    };
    
    const response = await axios.get(url, { params });
    
    res.json({
      success: true,
      insights: response.data.data || []
    });
  } catch (error) {
    console.error('Campaign insights error:', error);
    res.status(500).json({ 
      success: false,
      error: 'キャンペーン詳細の取得に失敗しました' 
    });
  }
});

// エクスポート機能
app.get('/api/export/campaigns', requireAuth, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    
    // キャンペーンデータを取得
    const campaignsResponse = await axios.get(`http://localhost:${process.env.PORT || 3000}/api/campaigns`, {
      headers: {
        Cookie: req.headers.cookie
      }
    });
    
    const campaigns = campaignsResponse.data.campaigns || [];
    
    if (format === 'csv') {
      // CSV形式でエクスポート
      const csvHeader = 'ID,名前,ステータス,目的,作成日,更新日\n';
      const csvRows = campaigns.map(c => 
        `"${c.id}","${c.name}","${c.status}","${c.objective}","${c.created_time}","${c.updated_time}"`
      ).join('\n');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="campaigns.csv"');
      res.send('\uFEFF' + csvHeader + csvRows); // BOM付きUTF-8
    } else {
      // JSON形式でエクスポート
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="campaigns.json"');
      res.json(campaigns);
    }
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'エクスポートエラー' });
  }
});

// スプレッドシート形式でエクスポート
app.get('/api/export/spreadsheet', requireAuth, async (req, res) => {
  try {
    const { exportToCSV } = require('./utils/googleSheets');
    const period = req.query.period || 'last_7d';
    const campaignId = req.query.campaign_id || 'all';
    
    // ダッシュボードデータ取得（選択された期間とキャンペーンで）
    const dashboardUrl = campaignId === 'all' 
      ? `http://localhost:${process.env.PORT || 3000}/api/dashboard-data?period=${period}`
      : `http://localhost:${process.env.PORT || 3000}/api/dashboard-data?period=${period}&campaign_id=${campaignId}`;
    
    const dashboardResponse = await axios.get(dashboardUrl, {
      headers: { Cookie: req.headers.cookie }
    });
    
    // キャンペーン詳細データ取得
    const campaignsDetailResponse = await axios.get(
      `http://localhost:${process.env.PORT || 3000}/api/campaigns/details?period=${period}`,
      { headers: { Cookie: req.headers.cookie }}
    );
    
    const dashboardData = dashboardResponse.data.data || {};
    const campaigns = campaignsDetailResponse.data.campaigns || [];
    
    // 選択されたキャンペーンのみフィルタリング
    const filteredCampaigns = campaignId === 'all' 
      ? campaigns 
      : campaigns.filter(c => c.id === campaignId);
    
    // CSV形式でエクスポート（スプレッドシート対応）
    const csvContent = exportToCSV(filteredCampaigns, dashboardData, period);
    
    const fileName = `meta_ads_report_${period}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('スプレッドシートエクスポートエラー:', error);
    res.status(500).json({ error: 'エクスポートエラー' });
  }
});

app.get('/improve', requireAuth, (req, res) => {
  try {
    res.render('improve', { 
      title: '改善施策',
      improvements: {
        budgetRate: ['クリエイティブの改善', 'ターゲティングの見直し'],
        ctr: ['新しいクリエイティブの作成', 'ターゲティングの精度向上']
      }
    });
  } catch (error) {
    res.status(500).send('改善施策ページエラー: ' + error.message);
  }
});

app.get('/settings', requireAuth, (req, res) => {
  try {
    res.render('settings', { title: 'API連携設定' });
  } catch (error) {
    res.status(500).send('設定ページエラー: ' + error.message);
  }
});

// ルート
app.get('/', (req, res) => {
  if (req.session && req.session.authenticated) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/auth/login');
  }
});

// ログアウト
app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

// ================================
// 競合するPOST /setupルートを削除済み

// ダッシュボードデータ取得API
app.get('/api/dashboard-data', requireAuth, async (req, res) => {
  try {
    console.log('=== ダッシュボードデータ取得開始（マルチユーザー対応） ===');
    
    const userId = req.session.userId;
    const period = req.query.period || 'today';
    const campaignId = req.query.campaign_id || null;
    
    console.log('ユーザーID:', userId);
    console.log('期間:', period);
    console.log('キャンペーンID:', campaignId);
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.meta_access_token || !userSettings.meta_account_id) {
      return res.status(400).json({
        success: false,
        message: 'Meta広告の設定が完了していません。設定画面で再度設定してください。',
        error: 'SETUP_INCOMPLETE'
      });
    }
    
    console.log('ユーザー設定確認完了:', {
      hasToken: !!userSettings.meta_access_token,
      hasAccountId: !!userSettings.meta_account_id,
      hasCPA: !!userSettings.target_cpa,
      hasCPM: !!userSettings.target_cpm,
      hasDailyBudget: !!userSettings.target_dailyBudget
    });
    
    let metaData;
    
    // 期間に応じたデータ取得
    if (period === 'today' || period === 'yesterday') {
      const date = period === 'today' 
        ? new Date().toISOString().split('T')[0]
        : new Date(Date.now() - 86400000).toISOString().split('T')[0];
      metaData = await fetchMetaDataWithStoredConfig(date, campaignId, userId);
    } else {
      // 期間データを取得
      const periodMap = {
        'last_3d': '3',
        'last_7d': '7',
        'last_14d': '14',
        'last_30d': '30'
      };
      const periodDays = periodMap[period] || '7';
      metaData = await fetchMetaPeriodDataWithStoredConfig(periodDays, campaignId, userId);
    }
    
    res.json({
      success: true,
      data: metaData,
      user: {
        targets: {
          cpa: userSettings.target_cpa,
          cpm: userSettings.target_cpm,
          dailyBudget: userSettings.target_dailyBudget
        }
      },
      lastUpdate: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('ダッシュボードデータ取得エラー:', error);
    res.status(500).json({
      success: false,
      message: 'ダッシュボードデータの取得に失敗しました',
      error: error.message
    });
  }
});

// アラート設定API（alertSystem.jsのgetCurrentGoalTypeを使用）
app.get('/api/alert-settings', requireAuth, async (req, res) => {
  try {
    const { getAlertSettings } = require('./alertSystem');
    const settings = getAlertSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('アラート設定取得エラー:', error);
    res.status(500).json({
      success: false,
      error: 'アラート設定の取得に失敗しました'
    });
  }
});

// Meta広告データ取得関数
async function fetchMetaAdsData(accessToken, accountId) {
  try {
    console.log('Meta広告データ取得開始:', { accountId });
    
    // アカウント情報取得
    const accountResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${accountId}`,
      {
        params: {
          fields: 'name,currency,timezone_name'
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    console.log('アカウント情報取得成功:', accountResponse.data);
    
    // キャンペーンデータ取得
    const campaignResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${accountId}/campaigns`,
      {
        params: {
          fields: 'name,status,objective,created_time,updated_time',
          limit: 25
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    console.log('キャンペーンデータ取得成功:', campaignResponse.data.data.length, '件');
    
    // インサイトデータ取得（過去7日間）
    const insightsResponse = await axios.get(
      `https://graph.facebook.com/v18.0/${accountId}/insights`,
      {
        params: {
          fields: 'spend,impressions,clicks,ctr,cpc,cpp,reach,frequency',
          date_preset: 'last_7_days',
          time_increment: 1
        },
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    console.log('インサイトデータ取得成功:', insightsResponse.data.data.length, '件');
    
    // インサイト生成
    const insights = generateInsights(insightsResponse.data.data);
    
    return {
      campaigns: campaignResponse.data.data,
      performance: insightsResponse.data.data,
      insights: insights,
      account: accountResponse.data
    };
    
  } catch (error) {
    console.error('Meta広告データ取得エラー:', error);
    throw error;
  }
}

// インサイト生成関数
function generateInsights(performanceData) {
  const insights = [];
  
  if (!performanceData || performanceData.length === 0) {
    insights.push({
      type: 'info',
      message: 'データがありません。広告キャンペーンを確認してください。'
    });
    return insights;
  }
  
  // 最新のデータを使用
  const latestData = performanceData[performanceData.length - 1];
  
  if (latestData.ctr) {
    const ctr = parseFloat(latestData.ctr);
    if (ctr < 1.0) {
      insights.push({
        type: 'warning',
        message: 'CTRが1%を下回っています。広告クリエイティブの見直しを検討してください。'
      });
    }
  }
  
  if (latestData.cpc) {
    const cpc = parseFloat(latestData.cpc);
    if (cpc > 100) {
      insights.push({
        type: 'warning',
        message: 'CPCが高めです。ターゲティングの最適化を検討してください。'
      });
    }
  }
  
  if (latestData.spend) {
    const spend = parseFloat(latestData.spend);
    if (spend < 1000) {
      insights.push({
        type: 'info',
        message: '支出が少なめです。予算の見直しを検討してください。'
      });
    }
  }
  
  if (insights.length === 0) {
    insights.push({
      type: 'success',
      message: '現在、特に改善点はありません。継続して監視してください。'
    });
  }
  
  return insights;
}

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).send('サーバーエラーが発生しました: ' + err.message);
});

// 設定済みMeta APIデータの確認・取得機能
app.get('/api/check-saved-meta-data', (req, res) => {
    console.log('=== 保存済みMeta API設定確認 ===');
    
    try {
        const setupPath = path.join(__dirname, 'config', 'setup.json');
        const metaConfigPath = path.join(__dirname, 'config', 'meta-config.json');
        
        // setup.json を優先的に読み込み
        if (fs.existsSync(setupPath)) {
            const setupData = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
            console.log('setup.json 読み込み成功:', {
                hasGoal: !!setupData.goal,
                goalType: setupData.goal?.type,
                isConfigured: setupData.isConfigured
            });
            
            res.json({
                success: true,
                hasConfig: true,
                data: setupData // setup.json の全データを返す
            });
        } 
        // フォールバック: meta-config.json を確認
        else if (fs.existsSync(metaConfigPath)) {
            const configData = JSON.parse(fs.readFileSync(metaConfigPath, 'utf8'));
            console.log('meta-config.json フォールバック:', {
                hasAccessToken: !!configData.meta_access_token,
                hasAccountId: !!configData.meta_account_id
            });
            
            res.json({
                success: true,
                hasConfig: true,
                data: {
                    meta: {
                        accessToken: configData.meta_access_token,
                        accountId: configData.meta_account_id,
                        appId: configData.meta_app_id
                    },
                    goal: {
                        type: '', // デフォルト値
                        name: '未設定'
                    }
                }
            });
        } else {
            console.log('設定ファイルが見つかりません');
            res.json({
                success: false,
                hasConfig: false,
                error: '設定ファイルが見つかりません'
            });
        }
    } catch (error) {
        console.error('設定確認エラー:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// 保存されたMeta API設定データを確実に取得
function getMetaApiConfigFromSetup(userId = null) {
    console.log('=== 設定済みMeta API情報取得開始 ===', { userId });
    
    // パターン1: ユーザー別設定から取得（優先）
    if (userId) {
        try {
            const userManager = getUserManager();
            const userSettings = userManager.getUserSettings(userId);
            
            console.log('🔍 ユーザー別設定確認:', {
                userId: userId,
                userSettingsFound: !!userSettings,
                hasAccessToken: !!(userSettings?.meta_access_token),
                hasAccountId: !!(userSettings?.meta_account_id),
                accessTokenLength: userSettings?.meta_access_token?.length || 0,
                accountId: userSettings?.meta_account_id
            });
            
            if (userSettings && userSettings.meta_access_token && userSettings.meta_account_id) {
                console.log('✅ ユーザー別Meta API設定取得成功');
                return {
                    accessToken: userSettings.meta_access_token,
                    accountId: userSettings.meta_account_id,
                    appId: userSettings.meta_app_id || ''
                };
            } else {
                console.log('❌ ユーザー別Meta API設定が不完全または未設定');
            }
        } catch (error) {
            console.error('ユーザー別設定取得エラー:', error);
        }
    }
    
    // パターン2: グローバル変数から取得
    if (global.metaApiConfig) {
        console.log('グローバル変数からMeta API設定取得');
        return global.metaApiConfig;
    }
    
    // パターン3: ファイルシステムから取得（後方互換性）
    const possiblePaths = [
        path.join(__dirname, 'data', 'user-config.json'),
        path.join(__dirname, 'config', 'meta-config.json'),
        path.join(__dirname, 'setup-data.json'),
        path.join(__dirname, 'user-data.json'),
        path.join(__dirname, 'settings.json')
    ];
    
    for (const configPath of possiblePaths) {
        try {
            if (fs.existsSync(configPath)) {
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log(`設定ファイル発見: ${configPath}`);
                console.log('設定内容:', Object.keys(data));
                
                // Meta API情報の抽出
                if (data.meta_access_token && data.meta_account_id) {
                    console.log('✅ Meta API設定取得成功');
                    return {
                        accessToken: data.meta_access_token,
                        accountId: data.meta_account_id,
                        appId: data.meta_app_id
                    };
                }
                
                // ネストした構造の場合（settings.json形式）
                if (data.meta && data.meta.accessToken) {
                    console.log('✅ ネストしたMeta API設定取得成功（settings.json）');
                    return data.meta;
                }
                
                // settings.jsonの構造に対応
                if (data.meta && data.meta.accessToken && data.meta.accountId) {
                    console.log('✅ settings.json形式のMeta API設定取得成功');
                    return {
                        accessToken: data.meta.accessToken,
                        accountId: data.meta.accountId,
                        appId: data.meta.appId
                    };
                }
            }
        } catch (error) {
            console.log(`設定ファイル読み込みエラー: ${configPath}`, error.message);
        }
    }
    
    // パターン4: 環境変数から取得
    if (process.env.META_ACCESS_TOKEN && process.env.META_ACCOUNT_ID) {
        console.log('環境変数からMeta API設定取得');
        return {
            accessToken: process.env.META_ACCESS_TOKEN,
            accountId: process.env.META_ACCOUNT_ID,
            appId: process.env.META_APP_ID
        };
    }
    
    console.log('❌ Meta API設定が見つかりません');
    return null;
}

// 保存済み設定データを取得する関数（後方互換性）
function getStoredMetaConfig() {
    return getMetaApiConfigFromSetup();
}

// 設定状況詳細確認API
app.get('/api/debug-meta-config', (req, res) => {
    console.log('=== Meta API設定デバッグ ===');
    
    const debugInfo = {
        timestamp: new Date().toISOString(),
        globalVariables: {},
        fileSystem: {},
        environment: {}
    };
    
    // グローバル変数確認
    debugInfo.globalVariables = {
        hasMetaApiConfig: !!global.metaApiConfig,
        hasUserData: !!global.userData,
        globalKeys: Object.keys(global).filter(key => key.includes('meta') || key.includes('user'))
    };
    
    // ファイルシステム確認
    const checkPaths = [
        'data/user-config.json',
        'config/meta-config.json', 
        'setup-data.json',
        'user-data.json',
        'settings.json'
    ];
    
    checkPaths.forEach(relativePath => {
        const fullPath = path.join(__dirname, relativePath);
        try {
            if (fs.existsSync(fullPath)) {
                const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                debugInfo.fileSystem[relativePath] = {
                    exists: true,
                    keys: Object.keys(data),
                    hasMetaToken: !!data.meta_access_token,
                    hasMetaAccount: !!data.meta_account_id,
                    hasNestedMeta: !!(data.meta && data.meta.accessToken),
                    hasSettingsMeta: !!(data.meta && data.meta.accessToken && data.meta.accountId)
                };
            } else {
                debugInfo.fileSystem[relativePath] = { exists: false };
            }
        } catch (error) {
            debugInfo.fileSystem[relativePath] = { 
                exists: true, 
                error: error.message 
            };
        }
    });
    
    // 環境変数確認
    debugInfo.environment = {
        hasMetaAccessToken: !!process.env.META_ACCESS_TOKEN,
        hasMetaAccountId: !!process.env.META_ACCOUNT_ID,
        nodeEnv: process.env.NODE_ENV
    };
    
    // 最終的な設定取得試行
    const finalConfig = getMetaApiConfigFromSetup();
    debugInfo.finalResult = {
        configFound: !!finalConfig,
        hasAccessToken: !!(finalConfig && finalConfig.accessToken),
        hasAccountId: !!(finalConfig && finalConfig.accountId)
    };
    
    console.log('デバッグ情報:', debugInfo);
    
    res.json(debugInfo);
});

// デバッグ用エンドポイント
app.get('/api/debug', (req, res) => {
  res.json({ 
    message: 'API エンドポイントは動作しています',
    timestamp: new Date().toISOString(),
    session: !!req.session.authenticated
  });
});

app.post('/api/debug-post', (req, res) => {
  console.log('POST リクエスト受信:', req.body);
  res.json({ 
    message: 'POST エンドポイントは動作しています',
    received: req.body
  });
});

// Meta API接続テスト（詳細版）
app.get('/api/test-meta-api', requireAuth, async (req, res) => {
    console.log('=== Meta API接続テスト開始 ===');
    
    try {
        const config = getStoredMetaConfig();
        
        if (!config || !config.accessToken || !config.accountId) {
            throw new Error('Meta API設定が見つかりません。設定画面で設定してください。');
        }
        
        console.log('使用する認証情報:', {
            accessToken: config.accessToken.substring(0, 20) + '...',
            accountId: config.accountId
        });
        
        // アカウント情報取得テスト
        const accountTestUrl = `https://graph.facebook.com/v18.0/${config.accountId}?access_token=${config.accessToken}&fields=name,account_status,currency`;
        
        console.log('アカウント確認URL:', accountTestUrl.replace(config.accessToken, 'TOKEN_HIDDEN'));
        
        const accountResponse = await fetch(accountTestUrl);
        const accountData = await accountResponse.json();
        
        console.log('アカウントレスポンス:', accountData);
        
        if (accountData.error) {
            throw new Error(`Meta API Error: ${accountData.error.message}`);
        }
        
        // 今日のデータ取得テスト
        const today = new Date().toISOString().split('T')[0];
        const insightsTestUrl = `https://graph.facebook.com/v18.0/${config.accountId}/insights?access_token=${config.accessToken}&fields=spend,impressions,clicks&time_range={"since":"${today}","until":"${today}"}&level=account`;
        
        console.log('インサイト確認URL:', insightsTestUrl.replace(config.accessToken, 'TOKEN_HIDDEN'));
        
        const insightsResponse = await fetch(insightsTestUrl);
        const insightsData = await insightsResponse.json();
        
        console.log('インサイトレスポンス:', insightsData);
        
        res.json({
            success: true,
            account: accountData,
            insights: insightsData,
            message: 'Meta API接続成功'
        });
        
    } catch (error) {
        console.error('Meta API接続エラー:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Meta API接続テスト（従来版）
app.post('/api/test-meta', requireAuth, async (req, res) => {
  try {
    console.log('Meta API接続テスト開始');
    const { token, accountId } = req.body;
    
    if (!token || !accountId) {
      return res.json({ 
        success: false, 
        error: 'アクセストークンとアカウントIDが必要です' 
      });
    }
    
    console.log('Meta API呼び出し:', accountId);
    
    // Meta Graph API でアカウント情報を取得
    const response = await axios.get(`https://graph.facebook.com/v18.0/${accountId}`, {
      params: { 
        access_token: token, 
        fields: 'name,currency,account_status,timezone_name,business_name'
      },
      timeout: 10000 // 10秒タイムアウト
    });
    
    console.log('Meta API応答成功:', response.data);
    
    const accountData = response.data;
    const statusText = accountData.account_status === 1 ? 'アクティブ' : 
                      accountData.account_status === 2 ? '無効' : 
                      accountData.account_status === 3 ? '未承認' : '不明';
    
    res.json({ 
      success: true, 
      data: {
        name: accountData.name || 'Meta広告アカウント',
        currency: accountData.currency || 'JPY',
        status: statusText,
        timezone: accountData.timezone_name || 'Asia/Tokyo',
        business: accountData.business_name || ''
      }
    });
    
  } catch (error) {
    console.error('Meta API接続テストエラー:', error.response?.data || error.message);
    
    let errorMessage = 'Meta API接続に失敗しました';
    
    if (error.response?.data?.error) {
      const metaError = error.response.data.error;
      if (metaError.code === 190) {
        errorMessage = 'アクセストークンが無効です';
      } else if (metaError.code === 100) {
        errorMessage = 'アカウントIDが見つかりません';
      } else {
        errorMessage = `API エラー: ${metaError.message}`;
      }
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'インターネット接続を確認してください';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '接続がタイムアウトしました';
    }
    
    res.json({ 
      success: false, 
      error: errorMessage
    });
  }
});

// チャットワーク API接続テスト
app.post('/api/test-chatwork', requireAuth, async (req, res) => {
  try {
    console.log('チャットワーク API接続テスト開始');
    let { token, roomId } = req.body;
    
    // ユーザー設定から取得を試みる
    if (!token || !roomId) {
      const userSettings = userManager.getUserSettings(req.session.userId);
      if (userSettings) {
        token = token || userSettings.chatwork_api_token;
        roomId = roomId || userSettings.chatwork_room_id;
      }
    }
    
    if (!token || !roomId) {
      return res.json({ 
        success: false, 
        error: 'APIトークンとルームIDが必要です' 
      });
    }
    
    console.log('チャットワーク API呼び出し:', roomId);
    
    // チャットワーク API でルーム情報を取得
    const response = await axios.get(`https://api.chatwork.com/v2/rooms/${roomId}`, {
      headers: { 
        'X-ChatWorkToken': token,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒タイムアウト
    });
    
    console.log('チャットワーク API応答成功:', response.data);
    
    const roomData = response.data;
    const roleText = roomData.role === 'admin' ? '管理者' :
                     roomData.role === 'member' ? 'メンバー' :
                     roomData.role === 'readonly' ? '閲覧のみ' : '不明';
    
    const typeText = roomData.type === 'my' ? 'マイチャット' :
                     roomData.type === 'direct' ? 'ダイレクト' :
                     roomData.type === 'group' ? 'グループ' : '不明';
    
    res.json({ 
      success: true, 
      data: {
        name: roomData.name || 'チャットルーム',
        description: roomData.description || '',
        type: typeText,
        role: roleText,
        member_count: roomData.member_count || 0
      }
    });
    
  } catch (error) {
    console.error('チャットワーク API接続テストエラー:', error.response?.data || error.message);
    
    let errorMessage = 'チャットワーク API接続に失敗しました';
    
    if (error.response?.status === 401) {
      errorMessage = 'APIトークンが無効です';
    } else if (error.response?.status === 404) {
      errorMessage = 'ルームIDが見つかりません';
    } else if (error.response?.status === 403) {
      errorMessage = 'ルームへのアクセス権限がありません';
    } else if (error.response?.data?.errors) {
      errorMessage = `API エラー: ${error.response.data.errors[0]}`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'インターネット接続を確認してください';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '接続がタイムアウトしました';
    }
    
    res.json({ 
      success: false, 
      error: errorMessage
    });
  }
});

// API設定テスト（全体テスト）
app.post('/api/test-all-connections', requireAuth, async (req, res) => {
  try {
    // 設定ファイルから読み込み
    let settings = {};
    if (fs.existsSync('./settings.json')) {
      settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
    }
    
    const results = {
      meta: { success: false, error: 'Meta API設定がありません' },
      chatwork: { success: false, error: 'チャットワーク設定がありません' }
    };
    
    // Meta API テスト
    if (settings.meta?.accessToken && settings.meta?.accountId) {
      try {
        const metaResponse = await axios.get(`https://graph.facebook.com/v18.0/${settings.meta.accountId}`, {
          params: { 
            access_token: settings.meta.accessToken, 
            fields: 'name,currency'
          },
          timeout: 5000
        });
        results.meta = { success: true, data: metaResponse.data };
      } catch (error) {
        results.meta = { success: false, error: 'Meta API接続失敗' };
      }
    }
    
    // チャットワーク API テスト
    if (settings.chatwork?.apiToken && settings.chatwork?.roomId) {
      try {
        const chatworkResponse = await axios.get(`https://api.chatwork.com/v2/rooms/${settings.chatwork.roomId}`, {
          headers: { 'X-ChatWorkToken': settings.chatwork.apiToken },
          timeout: 5000
        });
        results.chatwork = { success: true, data: chatworkResponse.data };
      } catch (error) {
        results.chatwork = { success: false, error: 'チャットワーク API接続失敗' };
      }
    }
    
    res.json({
      success: results.meta.success && results.chatwork.success,
      results: results
    });
    
  } catch (error) {
    console.error('全接続テストエラー:', error);
    res.json({ 
      success: false, 
      error: '接続テストでエラーが発生しました'
    });
  }
});

// ダッシュボードメインAPIエンドポイント
app.get('/api/meta-ads-data', requireAuth, async (req, res, next) => {
    // 内部リクエスト判定
    const isInternalRequest = req.headers['user-agent'] === 'Internal-Server-Request';
    
    // requireAuth middlewareで既に認証チェック済み
    
    const { type, date, period, campaignId } = req.query;
    const userId = req.session?.userId;
    
    console.log('=== ダッシュボード Meta広告データAPI ===');
    console.log('🔍 セッション情報:', {
        hasSession: !!req.session,
        sessionUserId: req.session?.userId,
        sessionUser: req.session?.user,
        sessionUserID: req.session?.user?.id,
        finalUserId: userId
    });
    console.log('リクエストパラメータ:', { type, date, period, campaignId, userId });
    
    try {
        let result;
        
        if (type === 'daily' && date) {
            console.log(`${date}の実際のMeta広告データを取得中...`);
            result = await fetchMetaDataWithStoredConfig(date, campaignId, userId);
        } else if (type === 'period' && period) {
            console.log(`過去${period}日間のMeta広告データを取得中...`);
            result = await fetchMetaPeriodDataWithStoredConfig(period, campaignId, userId);
        } else {
            throw new Error('無効なリクエストパラメータです');
        }
        
        console.log('✅ ダッシュボードデータ取得成功:', result);
        res.json(result);
        
    } catch (error) {
        console.error('❌ ダッシュボードデータ取得失敗:', error.message);
        console.error('🚨 エラー詳細:', {
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            userId: userId,
            requestParams: { type, date, period, campaignId }
        });
        
        // エラー時でも空データではなく、エラー情報を含むレスポンスを返す
        res.status(500).json({
            error: 'Meta広告データの取得に失敗しました',
            details: error.message,
            userId: userId,
            hasUserSettings: userId ? 'checked' : 'not_checked',
            timestamp: new Date().toISOString()
        });
    }
});

// 設定済みデータを使用した実際のMeta API呼び出し
async function fetchMetaDataWithStoredConfig(selectedDate, campaignId = null, userId = null) {
    console.log(`=== Meta API呼び出し: ${selectedDate} ===`, { userId });
    
    try {
        const config = getMetaApiConfigFromSetup(userId);
        
        if (!config) {
            throw new Error('Meta API設定が見つかりません。設定画面で再度設定してください。');
        }
        
        if (!config.accessToken || !config.accountId) {
            throw new Error('Meta API認証情報が不完全です。アクセストークンまたはアカウントIDが設定されていません。');
        }
        
        console.log('🔍 Meta API使用する認証情報:', {
            accountId: config.accountId,
            accessTokenLength: config.accessToken.length,
            accessTokenPrefix: config.accessToken.substring(0, 10) + '...',
            fromUserSettings: !!userId,
            userId: userId
        });
        
        const baseUrl = 'https://graph.facebook.com/v18.0';
        const endpoint = `${baseUrl}/${config.accountId}/insights`;
        
        const params = {
            access_token: config.accessToken,
            fields: [
                'spend',
                'impressions', 
                'clicks',
                'ctr',
                'cpm',
                'frequency',
                'reach',
                'actions',
                'action_values',
                'cost_per_action_type',
                'website_purchase_roas'
            ].join(','),
            time_range: JSON.stringify({
                since: selectedDate,
                until: selectedDate
            }),
            level: campaignId ? 'campaign' : 'account',
            action_report_time: 'conversion',  // コンバージョン時点での集計
            action_attribution_windows: ['7d_click', '1d_view']  // アトリビューションウィンドウ
        };

        if (campaignId) {
            params.filtering = JSON.stringify([{
                field: 'campaign.id',
                operator: 'IN',
                value: [campaignId]
            }]);
        }
        
        const queryString = new URLSearchParams(params).toString();
        const apiUrl = `${endpoint}?${queryString}`;
        
        console.log('Meta API URL:', apiUrl.replace(config.accessToken, 'ACCESS_TOKEN_HIDDEN'));
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Meta API HTTPエラー詳細:', {
                status: response.status,
                statusText: response.statusText,
                url: apiUrl.replace(config.accessToken, 'ACCESS_TOKEN_HIDDEN'),
                errorText: errorText,
                headers: Object.fromEntries(response.headers.entries())
            });
            throw new Error(`Meta API HTTPエラー: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Meta APIレスポンス:', data);
        
        // アクションタイプの詳細をログ出力
        if (data.data && data.data[0] && data.data[0].actions) {
            console.log('\n=== 取得したアクションタイプ一覧 ===');
            data.data[0].actions.forEach(action => {
                console.log(`  ${action.action_type}: ${action.value}`);
                // カスタムコンバージョンを特定
                if (action.action_type.includes('offsite_conversion') || 
                    action.action_type.includes('onsite_conversion') ||
                    action.action_type.includes('custom')) {
                    console.log(`  -> カスタムコンバージョン検出: ${action.action_type}`);
                }
            });
            console.log('===========================\n');
        }
        
        if (data.error) {
            console.error('Meta APIエラー:', data.error);
            throw new Error(`Meta APIエラー: ${data.error.message} (Code: ${data.error.code})`);
        }
        
        if (!data.data || data.data.length === 0) {
            console.log(`${selectedDate}のデータなし - 0値データを返します`);
            return createZeroMetrics(selectedDate);
        }
        
        const insights = data.data[0];
        console.log('✅ Meta広告データ取得成功:', insights);
        
        // アクティブなキャンペーンと広告セットから実際の日予算を取得
        let actualDailyBudget = 0;
        try {
            console.log('🔍 実際の日予算を取得中（キャンペーン＋広告セット）...');
            
            // 1. アクティブキャンペーンの日予算を取得
            const campaignsUrl = `${baseUrl}/${config.accountId}/campaigns`;
            const campaignsParams = new URLSearchParams({
                access_token: config.accessToken,
                fields: 'id,name,status,daily_budget,lifetime_budget,effective_status',
                effective_status: 'ACTIVE'  // アクティブキャンペーンのみ
            });
            
            const campaignsResponse = await fetch(`${campaignsUrl}?${campaignsParams}`);
            if (campaignsResponse.ok) {
                const campaignsData = await campaignsResponse.json();
                console.log('キャンペーンデータ取得:', campaignsData);
                
                if (campaignsData.data && campaignsData.data.length > 0) {
                    console.log(`アクティブキャンペーン数: ${campaignsData.data.length}`);
                    campaignsData.data.forEach(campaign => {
                        // アクティブステータスのキャンペーンのみ処理
                        if (campaign.effective_status === 'ACTIVE' || campaign.status === 'ACTIVE') {
                            if (campaign.daily_budget) {
                                const budget = parseFloat(campaign.daily_budget) / 100;
                                actualDailyBudget += budget;
                                console.log(`✅ アクティブキャンペーン "${campaign.name}": ${budget}円/日`);
                            } else if (campaign.lifetime_budget) {
                                const budget = (parseFloat(campaign.lifetime_budget) / 100) / 30;
                                actualDailyBudget += budget;
                                console.log(`✅ アクティブキャンペーン "${campaign.name}": ${budget}円/日（生涯予算）`);
                            }
                        }
                    });
                }
            }
            
            // 2. 広告セットレベルの日予算を取得（アクティブキャンペーンのみ）
            const adsetsUrl = `${baseUrl}/${config.accountId}/adsets`;
            const adsetsParams = new URLSearchParams({
                access_token: config.accessToken,
                fields: 'id,name,status,daily_budget,lifetime_budget,campaign_id,effective_status',
                effective_status: 'ACTIVE'  // アクティブな広告セットのみ取得
            });
            
            // キャンペーン別の場合、そのキャンペーンの広告セットのみをフィルタリング
            if (campaignId) {
                adsetsParams.append('filtering', JSON.stringify([{
                    field: 'campaign_id',
                    operator: 'IN',
                    value: [campaignId]
                }]));
                console.log(`🎯 キャンペーン${campaignId}の広告セットのみ取得`);
            }
            
            const adsetsResponse = await fetch(`${adsetsUrl}?${adsetsParams}`);
            if (adsetsResponse.ok) {
                const adsetsData = await adsetsResponse.json();
                console.log('広告セットデータ取得:', adsetsData);
                
                if (adsetsData.data && adsetsData.data.length > 0) {
                    console.log(`アクティブ広告セット数: ${adsetsData.data.length}`);
                    adsetsData.data.forEach(adset => {
                        // アクティブステータスの広告セットのみ予算を加算
                        if (adset.effective_status === 'ACTIVE' || adset.status === 'ACTIVE') {
                            if (adset.daily_budget) {
                                // Meta APIはcentsで返すので円に変換（100で割る）
                                const dailyBudgetYen = parseFloat(adset.daily_budget) / 100;
                                actualDailyBudget += dailyBudgetYen;
                                console.log(`✅ アクティブ広告セット "${adset.name}": ${dailyBudgetYen}円/日`);
                            } else if (adset.lifetime_budget) {
                                const lifetimeBudgetYen = (parseFloat(adset.lifetime_budget) / 100) / 30;
                                actualDailyBudget += lifetimeBudgetYen;
                                console.log(`✅ アクティブ広告セット "${adset.name}": ${lifetimeBudgetYen}円/日（ライフタイム予算）`);
                            }
                        } else {
                            console.log(`⏸️ 非アクティブ広告セット "${adset.name}" はスキップ`);
                        }
                    });
                }
            }
            
            console.log('✅ アクティブキャンペーン・広告セットの日予算合計:', actualDailyBudget + '円');
        } catch (budgetError) {
            console.error('日予算取得エラー:', budgetError);
        }
        
        return convertInsightsToMetricsWithActualBudget(insights, selectedDate, userId, actualDailyBudget);
        
    } catch (error) {
        console.error('Meta API呼び出し失敗:', error.message);
        throw error;
    }
}

// データなし時の0値メトリクス（拡張版）
function createZeroMetrics(selectedDate) {
    return {
        spend: 0,
        budgetRate: 0.00,
        ctr: 0.00,
        cpm: 0,
        conversions: 0,
        cpa: 0,
        frequency: 0.00,
        chartData: {
            labels: [formatDateLabel(selectedDate)],
            spend: [0],
            ctr: [0],
            cpm: [0],
            conversions: [0],
            cpa: [0],           // ✅ CPA追加
            frequency: [0]      // ✅ フリークエンシー追加
        }
    };
}

// インサイトデータをメトリクスに変換（ハイブリッド方式）
function convertInsightsToMetrics(insights, selectedDate, userId = null, actualDailyBudget = null) {
    const spend = parseFloat(insights.spend || 0);
    const conversions = getConversionsFromActions(insights.actions);
    const cpa = conversions > 0 ? spend / conversions : null;
    
    // ハイブリッド方式で日予算を取得
    const dailyBudget = getDailyBudgetFromGoals(userId, actualDailyBudget);
    const budgetRate = dailyBudget > 0 ? (spend / dailyBudget) * 100 : 0;
    
    console.log('=== 単日予算消化率計算（ハイブリッド方式） ===');
    console.log('消費金額:', spend + '円');
    console.log('API取得日予算:', actualDailyBudget + '円');
    console.log('使用日予算:', dailyBudget + '円');
    console.log('予算消化率:', budgetRate.toFixed(2) + '%');
    
    return {
        spend: Math.round(spend),
        budgetRate: parseFloat(Math.min(budgetRate, 100).toFixed(2)),
        ctr: parseFloat(insights.ctr || 0),
        cpm: Math.round(parseFloat(insights.cpm || 0)),
        conversions: conversions,
        cpa: Math.round(cpa),
        frequency: parseFloat(insights.frequency || 0),
        chartData: {
            labels: [formatDateLabel(selectedDate)],
            spend: [Math.round(spend)],
            ctr: [parseFloat(insights.ctr || 0)],
            cpm: [Math.round(parseFloat(insights.cpm || 0))],
            conversions: [conversions],
            cpa: [Math.round(cpa)],           // ✅ CPA追加
            frequency: [parseFloat(insights.frequency || 0)]            // ✅ フリークエンシー追加
        }
    };
}

// インサイトデータをメトリクスに変換（実際の日予算使用）
function convertInsightsToMetricsWithActualBudget(insights, selectedDate, userId = null, actualDailyBudget = 0) {
    const spend = parseFloat(insights.spend || 0);
    const conversions = getConversionsFromActions(insights.actions);
    const cpa = conversions > 0 ? spend / conversions : null;
    
    // ハイブリッド方式で日予算を取得（API優先、ユーザー設定フォールバック）
    console.log('convertInsightsToMetricsWithActualBudget - userId:', userId);
    console.log('convertInsightsToMetricsWithActualBudget - actualDailyBudget:', actualDailyBudget);
    const dailyBudget = getDailyBudgetFromGoals(userId, actualDailyBudget);
    const budgetRate = dailyBudget > 0 ? (spend / dailyBudget) * 100 : 0;
    
    console.log('=== 予算消化率計算（実際の日予算使用） ===');
    console.log('実際の消費:', spend + '円');
    console.log('実際の日予算:', actualDailyBudget + '円');
    console.log('使用する日予算:', dailyBudget + '円');
    console.log('計算された予算消化率:', budgetRate.toFixed(2) + '%');
    
    return {
        spend: Math.round(spend),
        budgetRate: parseFloat(Math.min(budgetRate, 100).toFixed(2)),
        ctr: parseFloat(insights.ctr || 0),
        cpm: Math.round(parseFloat(insights.cpm || 0)),
        conversions: conversions,
        cpa: Math.round(cpa),
        frequency: parseFloat(insights.frequency || 0),
        chartData: {
            labels: [formatDateLabel(selectedDate)],
            spend: [Math.round(spend)],
            ctr: [parseFloat(insights.ctr || 0)],
            cpm: [Math.round(parseFloat(insights.cpm || 0))],
            conversions: [conversions],
            cpa: [Math.round(cpa)],           // ✅ CPA追加
            frequency: [parseFloat(insights.frequency || 0)]            // ✅ フリークエンシー追加
        }
    };
}

// アクションからコンバージョン抽出（改善版：すべてのコンバージョンタイプに対応）
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
        // onsite_conversion プレフィックスを持つすべてのアクション
        else if (action.action_type && action.action_type.startsWith('onsite_conversion.')) {
            shouldCount = true;
            priority = 7;
        }
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
    Object.values(conversionsByValue).forEach(conv => {
        total += conv.count;
        detectedEvents.push(`${conv.type}: ${conv.count}`);
    });
    
    if (detectedEvents.length > 0) {
        console.log('検出されたCV:', detectedEvents.join(', '));
    } else {
        console.log('CVイベントが見つかりません。設定されているPixelイベントを確認してください。');
    }
    
    console.log('CV数合計:', total);
    return total;
}

// ハイブリッド方式で日予算を取得（API優先、ユーザー設定フォールバック）
function getDailyBudgetFromGoals(userId = null, actualDailyBudget = null) {
    try {
        console.log('=== ハイブリッド日予算取得 ===');
        console.log('入力userId:', userId);
        console.log('API取得日予算（アクティブキャンペーンのみ）:', actualDailyBudget);
        
        // 第1優先: Meta APIから取得した実際の日予算（アクティブキャンペーンのみ）
        if (actualDailyBudget && actualDailyBudget > 0) {
            console.log('✅ アクティブキャンペーンの日予算を使用:', actualDailyBudget, '円');
            return actualDailyBudget;
        }
        
        // 第2優先: ユーザー設定の日予算
        if (userId) {
            const userManager = getUserManager();
            const userSettings = userManager.getUserSettings(userId);
            console.log('取得したuserSettings:', userSettings);
            console.log('target_daily_budgetの値:', userSettings?.target_daily_budget);
            
            if (userSettings && userSettings.target_daily_budget) {
                const budget = parseFloat(userSettings.target_daily_budget);
                if (!isNaN(budget) && budget > 0) {
                    console.log('✅ ユーザー設定の日予算を使用:', budget, '円');
                    return budget;
                }
            }
        }
        
        // フォールバック: 日予算が設定されていない場合は0を返す（予算消化率計算を無効化）
        console.log('⚠️ 日予算が設定されていません - 予算消化率は計算されません');
        return 0;
    } catch (error) {
        console.error('ゴール設定読み込みエラー:', error);
        return 15000; // エラー時はデフォルト値
    }
}

// ユーザーの実際の設定値を取得
function getUserActualTargets(userId) {
    try {
        const userManager = getUserManager();
        const userSettings = userManager.getUserSettings(userId);
        
        if (userSettings) {
            return {
                cpa: parseFloat(userSettings.target_cpa) || null,
                cpm: parseFloat(userSettings.target_cpm) || null,
                ctr: parseFloat(userSettings.target_ctr) || null,
                dailyBudget: parseFloat(userSettings.target_dailyBudget) || null
            };
        }
        return null;
    } catch (error) {
        console.error('ユーザー設定取得エラー:', error);
        return null;
    }
}

// 実際のMeta広告APIからデータ取得（修正版）- 後方互換性
async function getActualMetaData(selectedDate) {
    return await fetchMetaDataWithStoredConfig(selectedDate);
}

// データがない日の0値データ作成
function createEmptyDayData(selectedDate) {
    return {
        spend: 0,
        budgetRate: '0.00',
        ctr: '0.00',
        cpm: 0,
        conversions: 0,
        cpa: 0,
        frequency: '0.00',
        chartData: {
            labels: [formatDateLabel(selectedDate)],
            spend: [0],
            ctr: [0],
            cpm: [0],
            conversions: [0]
        }
    };
}

// ダミーデータ生成（フォールバック用）
function generateDailyDummyData(selectedDate) {
    console.log('指定日付のダミーデータ生成:', selectedDate);
    
    // 選択した日付を基準にシード値を生成
    const dateObj = new Date(selectedDate);
    const dateSeed = dateObj.getFullYear() * 10000 + 
                    (dateObj.getMonth() + 1) * 100 + 
                    dateObj.getDate();
    
    // 日付に応じて一意のランダム値を生成
    function seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }
    
    // 曜日による変動を考慮（土日は低め、平日は高め）
    const dayOfWeek = dateObj.getDay();
    const weekendMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.7 : 1.0;
    
    const baseSpend = Math.floor(seededRandom(dateSeed) * 25000 + 8000) * weekendMultiplier;
    const baseCTR = seededRandom(dateSeed + 1) * 4 + 2;
    const baseCPM = Math.floor(seededRandom(dateSeed + 2) * 2000 + 3000);
    const baseConversions = Math.floor(seededRandom(dateSeed + 3) * 40 + 5) * weekendMultiplier;
    
    // その日付専用のグラフデータ（1日分なので1ポイント）
    const chartData = {
        labels: [formatDateLabel(selectedDate)],
        spend: [Math.floor(baseSpend)],
        ctr: [baseCTR.toFixed(2)],
        cpm: [baseCPM],
        conversions: [Math.floor(baseConversions)]
    };
    
    return {
        spend: Math.floor(baseSpend),
        budgetRate: (seededRandom(dateSeed + 4) * 40 + 70).toFixed(2),
        ctr: baseCTR.toFixed(2),
        cpm: baseCPM,
        conversions: Math.floor(baseConversions),
        cpa: baseConversions > 0 ? Math.floor(baseSpend / baseConversions) : null,
        frequency: (seededRandom(dateSeed + 5) * 2 + 0.8).toFixed(2),
        chartData: chartData
    };
}

// アクションから購入価値を取得
function getPurchaseValueFromActions(actions) {
    if (!actions) return 0;
    
    const purchaseAction = actions.find(action => action.action_type === 'purchase');
    return purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
}

// 実際の期間データ集計
function aggregateRealPeriodData(dailyData, userId = null, actualDailyBudget = null) {
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;
    
    const chartLabels = [];
    const chartSpend = [];
    const chartCTR = [];
    const chartCPM = [];
    const chartConversions = [];
    const chartCPA = [];           // ✅ CPA配列追加
    const chartFrequency = [];     // ✅ フリークエンシー配列追加
    
    console.log(`aggregateRealPeriodData: 受信データ数=${dailyData.length}`);
    
    dailyData.forEach((day, index) => {
        const spend = parseFloat(day.spend || 0);
        const impressions = parseInt(day.impressions || 0);
        const clicks = parseInt(day.clicks || 0);
        const conversions = getConversionsFromActions(day.actions);
        const cpa = conversions > 0 ? spend / conversions : null;
        const frequency = parseFloat(day.frequency || 0);
        
        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalConversions += conversions;
        totalReach += parseInt(day.reach || 0);
        
        const dateLabel = formatDateLabel(day.date_start);
        console.log(`Day ${index + 1}: date_start=${day.date_start}, label=${dateLabel}, spend=${spend}`);
        
        chartLabels.push(dateLabel);
        chartSpend.push(Math.round(spend));
        chartCTR.push(parseFloat(day.ctr || 0));
        chartCPM.push(Math.round(parseFloat(day.cpm || 0)));
        chartConversions.push(conversions);
        chartCPA.push(Math.round(cpa));          // ✅ CPA追加
        chartFrequency.push(frequency);          // ✅ フリークエンシー追加
    });
    
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;
    const avgCPA = totalConversions > 0 ? (totalSpend / totalConversions) : null;
    const avgFrequency = totalReach > 0 ? (totalImpressions / totalReach) : 0;
    
    return {
        spend: Math.round(totalSpend),
        budgetRate: (() => {
            try {
                const dailyBudget = getDailyBudgetFromGoals(userId, actualDailyBudget);
                const periodBudget = dailyData.length * dailyBudget;
                const rate = periodBudget > 0 ? ((totalSpend / periodBudget) * 100) : 0;
                
                console.log('=== 期間予算消化率計算（ハイブリッド方式） ===');
                console.log('期間:', dailyData.length, '日');
                console.log('API取得日予算:', actualDailyBudget, '円');
                console.log('使用日予算:', dailyBudget, '円');
                console.log('期間予算:', periodBudget, '円');
                console.log('合計消費:', totalSpend, '円');
                console.log('計算式:', totalSpend, '÷', periodBudget, '× 100 =', rate.toFixed(2) + '%');
                
                return isNaN(rate) ? 0.00 : parseFloat(rate.toFixed(2));
            } catch (error) {
                console.error('期間予算消化率計算エラー:', error);
                const fallbackBudget = getDailyBudgetFromGoals(userId);
                const rate = dailyData.length > 0 ? ((totalSpend / (dailyData.length * fallbackBudget)) * 100) : 0;
                return isNaN(rate) ? 0.00 : parseFloat(rate.toFixed(2));
            }
        })(),
        ctr: parseFloat(avgCTR.toFixed(2)),
        cpm: Math.round(avgCPM),
        conversions: totalConversions,
        cpa: Math.round(avgCPA),
        frequency: parseFloat(avgFrequency.toFixed(2)),
        chartData: {
            labels: chartLabels,
            spend: chartSpend,
            ctr: chartCTR,
            cpm: chartCPM,
            conversions: chartConversions,
            cpa: chartCPA,           // ✅ CPA配列追加
            frequency: chartFrequency // ✅ フリークエンシー配列追加
        }
    };
}

// 予算消化率計算
function calculateBudgetRate(spend, selectedDate, userId = null) {
    const dailyBudget = getDailyBudgetFromGoals(userId);
    return ((parseFloat(spend) / dailyBudget) * 100).toFixed(2);
}

function calculateBudgetRateForPeriod(totalSpend, days, userId = null) {
    const dailyBudget = getDailyBudgetFromGoals(userId);
    const periodBudget = dailyBudget * days;
    return ((totalSpend / periodBudget) * 100).toFixed(2);
}

// 日付ラベルのフォーマット
function formatDateLabel(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 期間データの実際のAPI取得（修正版）
async function fetchMetaPeriodDataWithStoredConfig(period, campaignId = null, userId = null) {
    console.log(`=== Meta API期間データ取得: ${period}日間 ===`, { userId });
    try {
        const config = getMetaApiConfigFromSetup(userId);
        
        if (!config || !config.accessToken || !config.accountId) {
            throw new Error('Meta API設定が見つかりません。設定画面でMeta API情報を設定してください。');
        }
        
        const accessToken = config.accessToken;
        const accountId = config.accountId;

        const endDate = new Date();
        const startDate = new Date();
        switch(period) {
            case '7': startDate.setDate(endDate.getDate() - 6); break;
            case '14': startDate.setDate(endDate.getDate() - 13); break;
            case '30': startDate.setDate(endDate.getDate() - 29); break;
            case 'all': startDate.setMonth(endDate.getMonth() - 3); break;
        }
        const since = startDate.toISOString().split('T')[0];
        const until = endDate.toISOString().split('T')[0];

        const baseUrl = 'https://graph.facebook.com/v18.0';
        const endpoint = `${baseUrl}/${accountId}/insights`;
        const params = {
            access_token: accessToken,
            fields: 'spend,impressions,clicks,ctr,cpm,frequency,reach,actions,date_start',
            time_range: JSON.stringify({ since, until }),
            level: campaignId ? 'campaign' : 'account',
            time_increment: 1,
            limit: 1000
        };

        if (campaignId) {
            params.filtering = JSON.stringify([{
                field: 'campaign.id',
                operator: 'IN',
                value: [campaignId]
            }]);
        }
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${endpoint}?${queryString}`);
        const data = await response.json();
        
        // APIエラーの処理
        if (data.error) {
            console.log('Meta APIエラー:', data.error);
            if (data.error.code === 17 || data.error.message?.includes('リクエスト数が上限')) {
                console.log('API Rate Limit エラー - ダミーデータを生成します');
                return generatePeriodDummyData(period);
            }
            throw new Error(data.error.message || 'Meta API Error');
        }
        
        // データがない場合はダミーデータを生成
        if (!data.data || data.data.length === 0) {
            console.log('データなし、ダミーデータを生成します');
            return generatePeriodDummyData(period);
        }
        
        console.log(`期間データ取得完了: ${data.data.length}日分`);
        
        // キャンペーン日予算も取得
        let actualDailyBudget = 0;
        try {
            const campaignsUrl = `${baseUrl}/${accountId}/campaigns`;
            const campaignsParams = new URLSearchParams({
                access_token: accessToken,
                fields: 'id,name,status,daily_budget,lifetime_budget,effective_status',
                effective_status: 'ACTIVE'  // アクティブキャンペーンのみ取得
            });
            
            const campaignsResponse = await fetch(`${campaignsUrl}?${campaignsParams}`);
            if (campaignsResponse.ok) {
                const campaignsData = await campaignsResponse.json();
                
                if (campaignsData.data && campaignsData.data.length > 0) {
                    console.log('アクティブキャンペーン数:', campaignsData.data.length);
                    campaignsData.data.forEach(campaign => {
                        // ACTIVEステータスのキャンペーンのみ予算を加算
                        if (campaign.effective_status === 'ACTIVE' || campaign.status === 'ACTIVE') {
                            if (campaign.daily_budget) {
                                const budget = parseFloat(campaign.daily_budget) / 100;
                                actualDailyBudget += budget;
                                console.log(`キャンペーン ${campaign.name}: 日予算 ${budget}円`);
                            } else if (campaign.lifetime_budget) {
                                const budget = (parseFloat(campaign.lifetime_budget) / 100) / 30;
                                actualDailyBudget += budget;
                                console.log(`キャンペーン ${campaign.name}: 生涯予算から計算 ${budget}円/日`);
                            }
                        }
                    });
                    console.log('アクティブキャンペーンの日予算合計:', actualDailyBudget + '円');
                }
            }
        } catch (budgetError) {
            console.error('期間データ用 日予算取得エラー:', budgetError);
        }
        
        return aggregateRealPeriodData(data.data, userId, actualDailyBudget);
    } catch (error) {
        console.error('Meta API期間データエラー:', error);
        throw error;
    }
}

// 期間データの実際のAPI取得（修正版）- 後方互換性
async function getActualMetaPeriodData(period) {
    return await fetchMetaPeriodDataWithStoredConfig(period);
}

// 期間ダミーデータ生成（フォールバック用）
function generatePeriodDummyData(period) {
    console.log('指定期間のダミーデータ生成:', period + '日間');
    
    const days = parseInt(period);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1); // 今日を含む期間
    
    const dates = [];
    const spendData = [];
    const ctrData = [];
    const cpmData = [];
    const conversionsData = [];
    const cpaData = [];           // ✅ CPA配列追加
    const frequencyData = [];     // ✅ フリークエンシー配列追加
    
    let totalSpend = 0;
    let totalConversions = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    
    // 指定期間の各日のデータを生成
    for (let i = 0; i < days; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        
        // その日の正確なデータを取得
        const dateString = currentDate.toISOString().split('T')[0];
        const dailyData = generateDailyDummyData(dateString);
        
        dates.push(formatDateLabel(dateString));
        spendData.push(dailyData.spend);
        ctrData.push(parseFloat(dailyData.ctr));
        cpmData.push(dailyData.cpm);
        conversionsData.push(dailyData.conversions);
        cpaData.push(dailyData.cpa);           // ✅ CPA追加
        frequencyData.push(parseFloat(dailyData.frequency)); // ✅ フリークエンシー追加
        
        // 集計用
        totalSpend += dailyData.spend;
        totalConversions += dailyData.conversions;
        
        // CTR計算用の推定値
        const estimatedImpressions = dailyData.spend / dailyData.cpm * 1000;
        const estimatedClicks = estimatedImpressions * parseFloat(dailyData.ctr) / 100;
        totalImpressions += estimatedImpressions;
        totalClicks += estimatedClicks;
    }
    
    // 期間全体の平均・合計値を計算
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;
    const avgCPA = totalConversions > 0 ? (totalSpend / totalConversions) : null;
    
    return {
        spend: Math.floor(totalSpend),
        budgetRate: (() => {
            try {
                const config = getMetaApiConfigFromSetup();
                const dailyBudget = config?.goal?.target_dailyBudget || '15000';
                const budget = parseFloat(dailyBudget);
                const rate = days > 0 ? ((totalSpend / (days * budget)) * 100) : 0;
                return isNaN(rate) ? '0.00' : rate.toFixed(2);
            } catch {
                const rate = days > 0 ? ((totalSpend / (days * 15000)) * 100) : 0;
                return isNaN(rate) ? '0.00' : rate.toFixed(2);
            }
        })(),
        ctr: avgCTR.toFixed(2),
        cpm: Math.floor(avgCPM),
        conversions: totalConversions,
        cpa: Math.floor(avgCPA),
        frequency: (totalClicks > 0 ? (totalImpressions / totalClicks * 0.8) : 1.2).toFixed(2),
        chartData: {
            labels: dates,
            spend: spendData,
            ctr: ctrData,
            cpm: cpmData,
            conversions: conversionsData,
            cpa: cpaData,           // ✅ CPA配列追加
            frequency: frequencyData // ✅ フリークエンシー配列追加
        }
    };
}





// チャットワーク送信API
app.post('/api/chatwork/send', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    const userId = req.session?.userId;
    
    if (!message) {
      return res.status(400).json({ error: 'メッセージが必要です' });
    }
    
    // ユーザー設定を取得
    const userSettings = userManager.getUserSettings(userId);
    if (!userSettings || !userSettings.chatwork_api_token || !userSettings.chatwork_room_id) {
      return res.status(400).json({ error: 'Chatwork設定が不完全です' });
    }
    
    // Chatwork APIに送信
    const response = await axios.post(
      `https://api.chatwork.com/v2/rooms/${userSettings.chatwork_room_id}/messages`,
      `body=${encodeURIComponent(message)}`,
      {
        headers: {
          'X-ChatWorkToken': userSettings.chatwork_api_token,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    res.json({ success: true, message: 'Chatworkに送信しました' });
  } catch (error) {
    console.error('Chatwork送信エラー:', error);
    res.status(500).json({ 
      error: 'Chatwork送信に失敗しました',
      details: error.message
    });
  }
});

// チャットワークテスト送信API
app.post('/api/chatwork-test', requireAuth, async (req, res) => {
    try {
        const { type } = req.body;
        const userId = req.session?.userId;
        
        console.log(`🧪 チャットワークテスト送信開始: ${type}`, { userId });
        
        const ChatworkAutoSender = require('./utils/chatworkAutoSender');
        const sender = new ChatworkAutoSender();
        
        await sender.sendTestMessage(type, userId);
        res.json({ success: true, message: `${type}テスト送信を実行しました` });
    } catch (error) {
        console.error('チャットワークテスト送信エラー:', error);
        res.status(500).json({ 
            error: 'テスト送信に失敗しました',
            details: error.message,
            stack: error.stack
        });
    }
});

// 早すぎる404ハンドラーを削除

// Meta API接続テスト用
app.get('/api/test-meta-connection', requireAuth, async (req, res) => {
    try {
        const accessToken = process.env.META_ACCESS_TOKEN;
        const accountId = process.env.META_ACCOUNT_ID;
        
        if (!accessToken || !accountId) {
            return res.json({
                success: false,
                error: 'Meta API認証情報が設定されていません',
                message: '.envファイルにMETA_ACCESS_TOKENとMETA_ACCOUNT_IDを設定してください',
                setup_guide: {
                    step1: 'Meta for Developersでアプリを作成',
                    step2: '広告アカウントIDを取得（act_で始まる）',
                    step3: '長期アクセストークンを生成',
                    step4: '.envファイルに設定'
                }
            });
        }
        
        console.log('Meta API接続テスト開始');
        console.log('アカウントID:', accountId);
        
        const response = await fetch(`https://graph.facebook.com/v18.0/${accountId}?access_token=${accessToken}&fields=name,account_status,currency,timezone_name`);
        const data = await response.json();
        
        if (data.error) {
            console.error('Meta API接続エラー:', data.error);
            return res.json({
                success: false,
                error: 'Meta API接続エラー',
                details: data.error,
                suggestion: 'アクセストークンとアカウントIDを確認してください'
            });
        }
        
        console.log('Meta API接続成功:', data);
        res.json({
            success: true,
            account: data,
            message: 'Meta API接続成功',
            next_step: 'ダッシュボードで日付を選択してデータを取得できます'
        });
    } catch (error) {
        console.error('Meta API接続テストエラー:', error);
        res.json({
            success: false,
            error: 'Meta API接続テストエラー',
            details: error.message
        });
    }
});

// アラート履歴取得API（ローカルストレージ同期用）
app.get('/api/alert-history', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId || 'test-user-id-123'; // フォールバック用
        console.log('アラート履歴API - ユーザーID:', userId);
        
        // 実際のalert_history.jsonファイルを読み込み
        const historyPath = path.join(__dirname, 'alert_history.json');
        let alertHistory = [];
        
        if (fs.existsSync(historyPath)) {
            const historyData = fs.readFileSync(historyPath, 'utf8');
            alertHistory = JSON.parse(historyData);
            console.log('アラート履歴ファイルから読み込み:', alertHistory.length + '件');
        } else {
            console.log('アラート履歴ファイルが存在しません');
        }
        
        // 直接Meta APIから最新データを取得
        let dashboardData = null;
        let userTargets = null;
        try {
            console.log('=== アラート履歴用: 最新Meta APIデータ取得 ===');
            const today = new Date().toISOString().split('T')[0];
            dashboardData = await fetchMetaDataWithStoredConfig(today, null, userId);
            
            const userSettings = userManager.getUserSettings(userId);
            userTargets = {
                dailyBudget: userSettings?.target_dailyBudget
            };
            
            console.log('アラート履歴用データ取得成功:', {
                budgetRate: dashboardData?.budgetRate,
                spend: dashboardData?.spend,
                dailyBudget: userTargets?.dailyBudget
            });
        } catch (error) {
            console.log('アラート履歴用データ取得失敗:', error.message);
        }

        // API応答形式に変換（checkItemsとimprovementsを保持、動的メッセージ生成）
        const formattedHistory = alertHistory.map(alert => {
            let dynamicMessage = alert.message;
            
            // 予算消化率のメッセージを動的に生成（ハイブリッド方式）
            if (alert.metric === 'budget_rate' && dashboardData) {
                const budgetRate = dashboardData.budgetRate || 0;
                const spend = dashboardData.spend || 0;
                
                // ハイブリッド方式で日予算を決定
                const apiDailyBudget = dashboardData.actualDailyBudget;
                const userDailyBudget = userTargets?.dailyBudget ? parseFloat(userTargets.dailyBudget) : null;
                
                let finalDailyBudget;
                let budgetSource;
                
                if (apiDailyBudget && apiDailyBudget > 0) {
                    finalDailyBudget = apiDailyBudget;
                    budgetSource = 'API取得';
                } else if (userDailyBudget && userDailyBudget > 0) {
                    finalDailyBudget = userDailyBudget;
                    budgetSource = 'ユーザー設定';
                } else {
                    finalDailyBudget = 10000; // 最終フォールバック
                    budgetSource = 'デフォルト';
                }
                
                const actualBudgetRate = (spend / finalDailyBudget * 100).toFixed(2);
                const budgetInfo = `${budgetSource}日予算: ${finalDailyBudget.toLocaleString()}円`;
                
                console.log('アラート予算消化率計算:', {
                    spend,
                    apiDailyBudget,
                    userDailyBudget,
                    finalDailyBudget,
                    budgetSource,
                    actualBudgetRate
                });
                
                dynamicMessage = `予算消化率が80%以下の${actualBudgetRate}%が3日間続いています（${budgetInfo}、実際の消化: ${spend.toLocaleString()}円）`;
                console.log('動的予算消化率メッセージ生成:', dynamicMessage);
                console.log('予算消化率計算詳細:', {
                    originalBudgetRate: budgetRate,
                    actualBudgetRate: actualBudgetRate,
                    spend: spend,
                    dailyBudget: dailyBudget,
                    actualDailyBudget: dashboardData.actualDailyBudget
                });
            }
            
            const formattedAlert = {
                id: alert.id,
                metric: getMetricDisplayName(alert.metric),
                message: dynamicMessage,
                level: alert.severity === 'critical' ? 'high' : 'medium',
                timestamp: alert.timestamp || alert.triggeredAt || new Date().toISOString(),
                status: 'active',
                checkItems: alert.checkItems || [],
                improvements: alert.improvements || {}
            };
            
            // デバッグ: 確認事項データの確認
            if (alert.checkItems && alert.checkItems.length > 0) {
                console.log(`✅ ${formattedAlert.metric}: checkItems存在 (${alert.checkItems.length}件)`);
                console.log('checkItems詳細:', alert.checkItems.map(item => item.title || item));
            } else {
                console.log(`❌ ${formattedAlert.metric}: checkItemsが空またはundefined`);
            }
            
            return formattedAlert;
        });
        
        console.log('フォーマット後のアラート数:', formattedHistory.length);
        
        res.json({
            success: true,
            history: formattedHistory,
            generatedAt: new Date().toISOString(),
            source: 'file'
        });
        
    } catch (error) {
        console.error('アラート履歴取得エラー:', error);
        res.json({
            success: false,
            history: [],
            error: error.message
        });
    }
});

// トークン管理システムAPI
app.get('/api/token-info', requireAuth, async (req, res) => {
    try {
        const tokenInfo = await tokenManager.getTokenInfo();
        res.json({
            success: true,
            tokenInfo: tokenInfo
        });
    } catch (error) {
        console.error('トークン情報取得エラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// トークン管理システムリセットAPI（テスト用）
app.post('/api/token-reset', requireAuth, async (req, res) => {
    try {
        await tokenManager.resetTokenInfo();
        res.json({
            success: true,
            message: 'トークン情報をリセットしました'
        });
    } catch (error) {
        console.error('トークン情報リセットエラー:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 設定完了状態確認API
app.get('/api/setup-status', requireAuth, (req, res) => {
  try {
    const isComplete = checkSetupCompletion();
    res.json({
      success: true,
      isComplete: isComplete,
      message: isComplete ? '設定完了済み' : '設定未完了'
    });
  } catch (error) {
    console.error('設定状態確認エラー:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// チャットワーク通知送信API
app.post('/api/send-chatwork-notification', async (req, res) => {
    const { apiToken, roomId, message, messageType } = req.body;
    
    console.log('=== チャットワーク通知送信 ===');
    console.log('メッセージタイプ:', messageType);
    
    try {
        const chatworkApiUrl = `https://api.chatwork.com/v2/rooms/${roomId}/messages`;
        
        const response = await fetch(chatworkApiUrl, {
            method: 'POST',
            headers: {
                'X-ChatWorkToken': apiToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                body: message,
                self_unread: '0'
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Chatwork API Error: ${response.status} - ${errorText}`);
        }
        
        const result = await response.json();
        console.log('✅ チャットワーク送信成功:', result);
        
        res.json({
            success: true,
            messageId: result.message_id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ チャットワーク送信失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 緊急テスト用ダッシュボード
app.get('/dashboard-test', (req, res) => {
  console.log('🧪 ダッシュボードテスト開始');
  try {
    res.send(`
      <html>
      <head><title>ダッシュボードテスト</title></head>
      <body>
        <h1>✅ ダッシュボード基本機能OK</h1>
        <p>Express基本動作: 正常</p>
        <p>認証状態: ${req.session?.authenticated || '未認証'}</p>
        <a href="/dashboard">元のダッシュボードテスト</a>
      </body>
      </html>
    `);
    console.log('✅ ダッシュボードテスト成功');
  } catch (error) {
    console.error('❌ ダッシュボードテスト失敗:', error);
    res.status(500).send('テストエラー: ' + error.message);
  }
});

// セットアップ状態確認API（テスト用）
app.get('/api/test-setup-status', (req, res) => {
  try {
    const isComplete = checkSetupCompletion();
    const hasSetupFile = fs.existsSync('./config/setup.json');
    const hasSettingsFile = fs.existsSync('./settings.json');
    
    let setupData = null;
    if (hasSetupFile) {
      setupData = JSON.parse(fs.readFileSync('./config/setup.json', 'utf8'));
    }
    
    res.json({
      success: true,
      isComplete,
      hasSetupFile,
      hasSettingsFile,
      setupData: setupData ? {
        hasMeta: !!(setupData.meta?.accessToken && setupData.meta?.accountId),
        hasChatwork: !!(setupData.chatwork?.apiToken && setupData.chatwork?.roomId),
        hasGoal: !!(setupData.goal?.type),
        isConfigured: setupData.isConfigured
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// スケジューラーを読み込み
try {
    require('./scheduler');
    console.log('✅ スケジューラー読み込み成功');
} catch (error) {
    console.error('❌ スケジューラー読み込み失敗:', error.message);
}

// マルチユーザー対応チャットワーク自動送信機能を初期化
try {
    const MultiUserChatworkSender = require('./utils/multiUserChatworkSender');
    const multiUserSender = new MultiUserChatworkSender();
    
    const cron = require('node-cron');
    
    // 日次レポート: 毎朝9時
    cron.schedule('0 9 * * *', async () => {
        console.log('📅 日次レポート送信スケジュール実行（全ユーザー）');
        await multiUserSender.sendDailyReportToAllUsers();
    }, {
        timezone: 'Asia/Tokyo'
    });
    
    // 定期更新通知: 12時、15時、17時、19時
    cron.schedule('0 12,15,17,19 * * *', async () => {
        console.log('🔄 定期更新通知送信スケジュール実行（全ユーザー）');
        await multiUserSender.sendUpdateNotificationToAllUsers();
    }, {
        timezone: 'Asia/Tokyo'
    });
    
    // アラート通知: 9時、12時、15時、17時、19時
    cron.schedule('0 9,12,15,17,19 * * *', async () => {
        console.log('🚨 アラート通知送信スケジュール実行（全ユーザー）');
        await multiUserSender.sendAlertNotificationToAllUsers();
    }, {
        timezone: 'Asia/Tokyo'
    });
    
    console.log('✅ マルチユーザー対応チャットワーク自動送信機能を開始しました');
} catch (error) {
    console.error('❌ チャットワーク自動送信機能の開始に失敗:', error.message);
}

// 🧪 デバッグ用エンドポイント
app.all('/debug-routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(middleware => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods),
        stackCount: middleware.route.stack.length
      });
    }
  });
  
  const setupRoutes = routes.filter(r => r.path.includes('setup') || r.path.includes('save'));
  
  res.json({ 
    totalRoutes: routes.length,
    setupRoutes: setupRoutes,
    allRoutes: routes.sort((a, b) => a.path.localeCompare(b.path))
  });
});

// ヘルスチェック用エンドポイント
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// ユーザー設定取得API
app.get('/api/user-settings', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userManager = getUserManager();
        const userSettings = userManager.getUserSettings(userId);
        
        if (!userSettings) {
            return res.status(404).json({ 
                success: false, 
                message: 'ユーザー設定が見つかりません' 
            });
        }
        
        res.json({
            success: true,
            target_budget_rate: userSettings.target_budget_rate || 80,
            target_daily_budget: userSettings.target_daily_budget || 2800,
            target_ctr: userSettings.target_ctr || 1.0,
            target_cpm: userSettings.target_cpm || 1500,
            target_cpa: userSettings.target_cpa || 7000,
            target_cv: userSettings.target_cv || 1
        });
    } catch (error) {
        console.error('ユーザー設定取得エラー:', error);
        res.status(500).json({ 
            success: false, 
            message: 'エラーが発生しました' 
        });
    }
});

// 目標値更新API
app.post('/api/update-targets', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const userManager = getUserManager();
        const { 
            target_budget_rate, 
            target_daily_budget, 
            target_ctr, 
            target_cpm, 
            target_cpa, 
            target_cv 
        } = req.body;
        
        // 現在の設定を取得
        const currentSettings = userManager.getUserSettings(userId) || {};
        
        // 更新された値のみを上書き
        const updatedSettings = {
            ...currentSettings,
            target_budget_rate: target_budget_rate !== undefined ? target_budget_rate : currentSettings.target_budget_rate,
            target_daily_budget: target_daily_budget !== undefined ? target_daily_budget : currentSettings.target_daily_budget,
            target_ctr: target_ctr !== undefined ? target_ctr : currentSettings.target_ctr,
            target_cpm: target_cpm !== undefined ? target_cpm : currentSettings.target_cpm,
            target_cpa: target_cpa !== undefined ? target_cpa : currentSettings.target_cpa,
            target_cv: target_cv !== undefined ? target_cv : currentSettings.target_cv
        };
        
        // 設定を保存
        userManager.saveUserSettings(userId, updatedSettings);
        
        // アラートを再生成
        const alertSystem = require('./alertSystem');
        const alerts = await alertSystem.checkUserAlerts(userId);
        
        console.log('✅ 目標値更新成功:', userId);
        res.json({ 
            success: true, 
            message: '目標値を更新しました',
            alerts: alerts
        });
    } catch (error) {
        console.error('目標値更新エラー:', error);
        res.status(500).json({ 
            success: false, 
            message: 'エラーが発生しました' 
        });
    }
});

// 重複した404ハンドラーと/save-setupルートを削除（正しい場所に移動予定）

// 404ハンドリング（必ず最後に配置）
app.use((req, res) => {
  console.log('404エラー:', req.method, req.url);
  res.status(404).send('ページが見つかりません');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==========================================\n✅ サーバー起動成功！\n🌐 URL: http://localhost:${PORT}\n👤 ログイン: komiya / komiya\n==========================================\n`);
});