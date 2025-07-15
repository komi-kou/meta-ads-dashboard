// dotenvによる環境変数読み込み
require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const axios = require('axios');
const fs = require('fs');

// 環境変数確認ログ
console.log('=== 環境変数確認 ===');
console.log('META_ACCESS_TOKEN:', process.env.META_ACCESS_TOKEN ? '設定済み' : '未設定');
console.log('META_ACCOUNT_ID:', process.env.META_ACCOUNT_ID ? '設定済み' : '未設定');
console.log('META_APP_ID:', process.env.META_APP_ID ? '設定済み' : '未設定');

const app = express();

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

// 基本設定
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// セッション設定
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // 本番はtrue
    maxAge: 24 * 60 * 60 * 1000, // 24時間
    httpOnly: true,
    sameSite: 'lax'
  }
}));

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
    getCurrentGoal: () => ({ name: 'toC（メルマガ登録）' }),
    getAllGoals: () => [{ key: 'toC_newsletter', name: 'toC（メルマガ登録）' }]
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

// 認証ミドルウェア
function requireAuth(req, res, next) {
  console.log('🔐 requireAuth チェック中...');
  console.log('セッション認証状態:', req.session?.authenticated);
  if (req.session && req.session.authenticated) {
    console.log('✅ 認証OK');
    return next();
  } else {
    console.log('❌ 認証失敗 - ログインページにリダイレクト');
    return res.redirect('/auth/login');
  }
}

// 設定完了判定機能
function checkSetupCompletion(req = null) {
  try {
    console.log('=== セットアップ完了状態チェック ===');
    
    // セッションから設定をチェック（優先）
    let sessionHasMeta = false;
    let sessionHasChatwork = false;
    let sessionHasGoal = false;
    
    if (req && req.session) {
      sessionHasMeta = !!(req.session.metaAccessToken && req.session.metaAccountId);
      sessionHasChatwork = !!(req.session.chatworkApiToken && req.session.chatworkRoomId);
      sessionHasGoal = !!(req.session.goalType);
      
      console.log('セッション設定状態:', {
        meta: sessionHasMeta,
        chatwork: sessionHasChatwork,
        goal: sessionHasGoal
      });
    }
    
    // settings.jsonから設定を読み込み（フォールバック）
    let fileHasMeta = false;
    let fileHasChatwork = false;
    let fileHasGoal = false;
    let isConfigured = false;
    
    if (fs.existsSync('./settings.json')) {
      const settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
      
      fileHasMeta = !!(settings.meta?.accessToken && settings.meta?.accountId);
      fileHasChatwork = !!(settings.chatwork?.apiToken && settings.chatwork?.roomId);
      fileHasGoal = !!(settings.goal?.type);
      isConfigured = settings.isConfigured === true;
      
      console.log('ファイル設定状態:', {
        meta: fileHasMeta,
        chatwork: fileHasChatwork,
        goal: fileHasGoal,
        isConfigured: isConfigured
      });
    }
    
    // セッションまたはファイルのどちらかで完了していればOK
    const hasMetaAPI = sessionHasMeta || fileHasMeta;
    const hasChatwork = sessionHasChatwork || fileHasChatwork;
    const hasGoal = sessionHasGoal || fileHasGoal;
    
    const isComplete = hasMetaAPI && hasChatwork && hasGoal;
    
    console.log('最終判定:', {
      hasMetaAPI,
      hasChatwork,
      hasGoal,
      isComplete
    });
    
    return isComplete;
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

// ルートアクセス（セットアップ完了チェック付き）
app.get('/', (req, res) => {
  console.log('=== ROOT ACCESS ===');
  console.log('Session:', req.session);
  
  // 認証チェック
  if (!req.session.user && !req.session.authenticated) {
    console.log('No session, redirecting to login');
    return res.redirect('/login');
  }
  
  // セットアップ完了チェック
  const isSetupComplete = checkSetupCompletion(req);
  
  if (isSetupComplete) {
    console.log('Setup complete, redirecting to dashboard');
    res.redirect('/dashboard');
  } else {
    console.log('Setup not complete, redirecting to setup');
    res.redirect('/setup');
  }
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

// ログイン処理（常にセットアップページへリダイレクト）
app.post('/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('=== ログイン処理開始 ===');
    console.log('ユーザー名:', username);
    
    if (username === 'komiya' && (password === 'komiya' || password === 'password')) {
      req.session.authenticated = true;
      req.session.user = username;
      console.log('認証成功');
      console.log('セッション状態:', req.session);
      
      // 設定完了状態をチェック
      const isSetupComplete = checkSetupCompletion(req);
      
      if (isSetupComplete) {
        console.log('設定完了済み → ダッシュボードにリダイレクト');
        res.redirect('/dashboard');
      } else {
        console.log('設定未完了 → セットアップ画面にリダイレクト');
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

// 初期設定ページ
app.get('/setup', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  res.render('setup', {
    currentConfig: {
      metaAccessToken: req.session.metaAccessToken || '',
      metaAccountId: req.session.metaAccountId || '',
      chatworkApiToken: req.session.chatworkApiToken || '',
      chatworkRoomId: req.session.chatworkRoomId || ''
    }
  });
});

// ダッシュボード（セットアップ完了チェック付き）
app.get('/dashboard', (req, res) => {
  console.log('=== DASHBOARD ACCESS ===');
  console.log('Session:', req.session);
  
  // 認証チェック
  if (!req.session.user && !req.session.authenticated) {
    console.log('No user session, redirecting to login');
    return res.redirect('/login');
  }
  
  // セットアップ完了チェック
  const isSetupComplete = checkSetupCompletion(req);
  
  if (!isSetupComplete) {
    console.log('Setup not complete, redirecting to setup page');
    return res.redirect('/setup');
  }
  
  console.log('Setup complete, rendering dashboard');
  try {
    res.render('dashboard', {
      userTokens: {
        meta: req.session?.metaAccessToken || '',
        chatwork: req.session?.chatworkApiToken || ''
      },
      user: req.session?.user || 'User'
    });
  } catch (error) {
    console.error('Dashboard render error:', error);
    res.status(500).send('Dashboard error: ' + error.message);
  }
});

// ダッシュボードの代替ルート（認証なし）
app.get('/dashboard-test', (req, res) => {
  console.log('=== DASHBOARD TEST ACCESS ===');
  try {
    res.render('dashboard', {
      userTokens: {
        meta: 'test-token',
        chatwork: 'test-token'
      },
      user: 'TestUser'
    });
  } catch (error) {
    console.error('Dashboard test render error:', error);
    res.status(500).send('Dashboard test error: ' + error.message);
  }
});

// アラートページ表示
app.get('/alerts', requireAuth, (req, res) => {
    res.render('alerts');
});

// アラートシステムのインポート
const { checkAllAlerts, getAlertHistory, getAlertSettings } = require('./alertSystem');

// アラート関連のルートを app.js に追加

// アラート内容ページ
app.get('/alerts', (req, res) => {
    console.log('アラートページにアクセス');
    res.render('alerts', {
        title: 'アラート内容 - Meta広告ダッシュボード'
    });
});

// アラート履歴ページ
app.get('/alert-history', (req, res) => {
    res.render('alert-history', {
        title: 'アラート履歴 - Meta広告ダッシュボード'
    });
});

// 確認事項ページ
app.get('/improvement-tasks', (req, res) => {
    res.render('improvement-tasks', {
        title: '確認事項 - Meta広告ダッシュボード'
    });
});

// 改善施策ページ
app.get('/improvement-strategies', (req, res) => {
    res.render('improvement-strategies', {
        title: '改善施策 - Meta広告ダッシュボード'
    });
});

// チャットワークテストページ
app.get('/chatwork-test', requireAuth, (req, res) => {
    res.render('chatwork-test');
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

// アラートデータ取得API（既存）
app.get('/api/alerts', async (req, res) => {
    try {
        const alerts = await checkAllAlerts();
        const alertHistory = await getAlertHistory();
        const alertSettings = getAlertSettings();
        
        res.json({
            success: true,
            alerts: alerts,
            history: alertHistory,
            settings: alertSettings,
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

// 一時的なアラートデータ取得（app.jsに追加）
async function getCurrentAlerts() {
    try {
        // アラート履歴からアクティブなアラートを取得
        const alertHistoryManager = require('./utils/alertHistoryManager');
        const history = alertHistoryManager.getAlertHistory();
        return history.filter(alert => alert.status === 'active');
    } catch (error) {
        console.error('アラート取得エラー:', error);
        // フォールバック: 一時的にダミーアラートを返す
        return [
            {
                id: 'alert_1',
                metric: '予算消化率',
                level: 'medium',
                message: '予算消化率が80%以下の状態が2日間続いています',
                status: 'active',
                timestamp: new Date().toISOString()
            }
        ];
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

// アラート取得API
app.get('/api/alerts', requireAuth, async (req, res) => {
  try {
    console.log('=== アラート取得API ===');
    
    // 現在のアラートを取得
    const alerts = await getCurrentAlerts();
    
    // アクティブなアラートのみを返す
    const activeAlerts = alerts.filter(alert => alert.status === 'active');
    
    console.log('取得したアラート数:', activeAlerts.length);
    
    res.json(activeAlerts);
  } catch (error) {
    console.error('アラート取得エラー:', error);
    res.status(500).json({ error: 'アラート取得に失敗しました' });
  }
});

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
    console.error('チャットワーク送信エラー:', error);
    res.status(500).json({ 
      error: 'チャットワーク送信に失敗しました',
      details: error.message 
    });
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
// POST /setup ルート（設定保存）
// ================================
app.post('/setup', requireAuth, async (req, res) => {
  console.log('🚨 POST /setup が呼ばれました!');
  console.log('=== 設定保存処理開始 ===');
  console.log('受信データ:', req.body);
  
  try {
    
    // 設定データ作成
    const settings = {
      meta: {
        accessToken: req.body.meta_access_token || '',
        accountId: req.body.meta_account_id || '',
        appId: req.body.meta_app_id || ''
      },
      chatwork: {
        apiToken: req.body.chatwork_api_token || '',
        roomId: req.body.chatwork_room_id || ''
      },
      goal: {
        type: req.body.goal_type || 'toC_newsletter',
        name: getGoalName(req.body.goal_type || 'toC_newsletter')
      },
      isConfigured: true,
      setupCompletedAt: new Date().toISOString()
    };
    
    console.log('保存する設定:', settings);
    
    // settings.json に保存
    fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
    console.log('✅ settings.json 保存完了');
    
    // config/meta-config.json にも保存（ダッシュボード用）
    const metaConfig = {
      meta_access_token: req.body.meta_access_token || '',
      meta_account_id: req.body.meta_account_id || '',
      meta_app_id: req.body.meta_app_id || ''
    };
    
    // configディレクトリが存在しない場合は作成
    if (!fs.existsSync('./config')) {
      fs.mkdirSync('./config');
    }
    
    fs.writeFileSync('./config/meta-config.json', JSON.stringify(metaConfig, null, 2));
    console.log('✅ config/meta-config.json 保存完了');
    
    console.log('✅ 設定保存完了');
    
    // 設定完了状態をマーク
    markSetupAsComplete();
    
    // トークン管理システムに登録
    try {
        await tokenManager.registerToken();
        console.log('✅ トークン管理システムに登録完了');
    } catch (error) {
        console.error('⚠️ トークン管理システム登録エラー:', error);
    }
    
    // ダッシュボードにリダイレクト（設定完了フラグ付き）
    console.log('🔄 ダッシュボードにリダイレクト（設定完了）');
    res.redirect('/dashboard?setup_completed=true');
    
  } catch (error) {
    console.error('❌ 設定保存エラー:', error);
    res.status(500).send(`設定保存エラー: ${error.message}`);
  }
});

// ゴール名取得ヘルパー
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

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('サーバーエラー:', err);
  res.status(500).send('サーバーエラーが発生しました: ' + err.message);
});

// 設定済みMeta APIデータの確認・取得機能
app.get('/api/check-saved-meta-data', (req, res) => {
    console.log('=== 保存済みMeta API設定確認 ===');
    
    try {
        const configPath = path.join(__dirname, 'config', 'meta-config.json');
        
        if (fs.existsSync(configPath)) {
            const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            console.log('保存済み設定データ:', {
                hasAccessToken: !!configData.meta_access_token,
                hasAccountId: !!configData.meta_account_id,
                accessTokenLength: configData.meta_access_token ? configData.meta_access_token.length : 0,
                accountId: configData.meta_account_id ? configData.meta_account_id.substring(0, 10) + '...' : 'なし'
            });
            
            res.json({
                success: true,
                hasConfig: true,
                config: {
                    hasAccessToken: !!configData.meta_access_token,
                    hasAccountId: !!configData.meta_account_id,
                    accessTokenLength: configData.meta_access_token ? configData.meta_access_token.length : 0
                }
            });
        } else {
            console.log('設定ファイルが見つかりません:', configPath);
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
function getMetaApiConfigFromSetup() {
    console.log('=== 設定済みMeta API情報取得開始 ===');
    
    // パターン1: グローバル変数から取得
    if (global.metaApiConfig) {
        console.log('グローバル変数からMeta API設定取得');
        return global.metaApiConfig;
    }
    
    // パターン2: ファイルシステムから取得
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
    
    // パターン3: 環境変数から取得
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
    const { token, roomId } = req.body;
    
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
app.get('/api/meta-ads-data', async (req, res, next) => {
    // 内部リクエスト判定
    const isInternalRequest = req.headers['user-agent'] === 'Internal-Server-Request';
    if (!isInternalRequest && !(req.session && req.session.user)) {
        // 認証されていない外部リクエストはログインページにリダイレクト
        return res.redirect('/login');
    }
    const { type, date, period } = req.query;
    console.log('=== ダッシュボード Meta広告データAPI ===');
    console.log('リクエストパラメータ:', { type, date, period });
    
    try {
        let result;
        
        if (type === 'daily' && date) {
            console.log(`${date}の実際のMeta広告データを取得中...`);
            result = await fetchMetaDataWithStoredConfig(date);
        } else if (type === 'period' && period) {
            console.log(`過去${period}日間のMeta広告データを取得中...`);
            result = await fetchMetaPeriodDataWithStoredConfig(period);
        } else {
            throw new Error('無効なリクエストパラメータです');
        }
        
        console.log('✅ ダッシュボードデータ取得成功:', result);
        res.json(result);
        
    } catch (error) {
        console.error('❌ ダッシュボードデータ取得失敗:', error.message);
        res.status(500).json({
            error: 'Meta広告データの取得に失敗しました',
            details: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// 設定済みデータを使用した実際のMeta API呼び出し
async function fetchMetaDataWithStoredConfig(selectedDate) {
    console.log(`=== Meta API呼び出し: ${selectedDate} ===`);
    
    try {
        const config = getMetaApiConfigFromSetup();
        
        if (!config) {
            throw new Error('Meta API設定が見つかりません。設定画面で再度設定してください。');
        }
        
        if (!config.accessToken || !config.accountId) {
            throw new Error('Meta API認証情報が不完全です。アクセストークンまたはアカウントIDが設定されていません。');
        }
        
        console.log('使用する認証情報:', {
            accountId: config.accountId,
            accessTokenLength: config.accessToken.length,
            accessTokenPrefix: config.accessToken.substring(0, 10) + '...'
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
                'cost_per_action_type'
            ].join(','),
            time_range: JSON.stringify({
                since: selectedDate,
                until: selectedDate
            }),
            level: 'account'
        };
        
        const queryString = new URLSearchParams(params).toString();
        const apiUrl = `${endpoint}?${queryString}`;
        
        console.log('Meta API URL:', apiUrl.replace(config.accessToken, 'ACCESS_TOKEN_HIDDEN'));
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Meta API HTTPエラー:', response.status, errorText);
            throw new Error(`Meta API HTTPエラー: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        console.log('Meta APIレスポンス:', data);
        
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
        
        return convertInsightsToMetrics(insights, selectedDate);
        
    } catch (error) {
        console.error('Meta API呼び出し失敗:', error.message);
        throw error;
    }
}

// データなし時の0値メトリクス（拡張版）
function createZeroMetrics(selectedDate) {
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
            conversions: [0],
            cpa: [0],           // ✅ CPA追加
            frequency: [0]      // ✅ フリークエンシー追加
        }
    };
}

// インサイトデータをメトリクスに変換
function convertInsightsToMetrics(insights, selectedDate) {
    const spend = parseFloat(insights.spend || 0);
    const conversions = getConversionsFromActions(insights.actions);
    const cpa = conversions > 0 ? spend / conversions : 0;
    
    // 目標予算（デフォルト15,000円/日）
    const dailyBudget = 15000;
    const budgetRate = (spend / dailyBudget) * 100;
    
    return {
        spend: Math.round(spend),
        budgetRate: Math.min(budgetRate, 999.99).toFixed(2),
        ctr: parseFloat(insights.ctr || 0).toFixed(2),
        cpm: Math.round(parseFloat(insights.cpm || 0)),
        conversions: conversions,
        cpa: Math.round(cpa),
        frequency: parseFloat(insights.frequency || 0).toFixed(2),
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

// アクションからコンバージョン抽出
function getConversionsFromActions(actions) {
    if (!actions || !Array.isArray(actions)) return 0;
    
    let total = 0;
    const conversionTypes = ['purchase', 'lead', 'complete_registration', 'add_to_cart'];
    
    actions.forEach(action => {
        if (conversionTypes.includes(action.action_type)) {
            total += parseInt(action.value || 0);
        }
    });
    
    return total;
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
        cpa: Math.floor(baseSpend / Math.max(baseConversions, 1)),
        frequency: (seededRandom(dateSeed + 5) * 2 + 0.8).toFixed(2),
        chartData: chartData
    };
}

// アクションからコンバージョン数を抽出
function extractConversions(actions) {
    if (!actions || !Array.isArray(actions)) {
        return 0;
    }
    
    // 主要なコンバージョンアクションタイプ
    const conversionTypes = [
        'purchase',
        'lead',
        'complete_registration',
        'add_to_cart',
        'initiate_checkout',
        'submit_application'
    ];
    
    let totalConversions = 0;
    
    actions.forEach(action => {
        if (conversionTypes.includes(action.action_type)) {
            totalConversions += parseInt(action.value || 0);
        }
    });
    
    console.log('抽出されたコンバージョン数:', totalConversions);
    return totalConversions;
}

// アクションから購入価値を取得
function getPurchaseValueFromActions(actions) {
    if (!actions) return 0;
    
    const purchaseAction = actions.find(action => action.action_type === 'purchase');
    return purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
}

// 実際の期間データ集計
function aggregateRealPeriodData(dailyData) {
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
    
    dailyData.forEach(day => {
        const spend = parseFloat(day.spend || 0);
        const impressions = parseInt(day.impressions || 0);
        const clicks = parseInt(day.clicks || 0);
        const conversions = extractConversions(day.actions);
        const cpa = conversions > 0 ? spend / conversions : 0;
        const frequency = parseFloat(day.frequency || 0);
        
        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalConversions += conversions;
        totalReach += parseInt(day.reach || 0);
        
        chartLabels.push(formatDateLabel(day.date_start));
        chartSpend.push(Math.round(spend));
        chartCTR.push(parseFloat(day.ctr || 0));
        chartCPM.push(Math.round(parseFloat(day.cpm || 0)));
        chartConversions.push(conversions);
        chartCPA.push(Math.round(cpa));          // ✅ CPA追加
        chartFrequency.push(frequency);          // ✅ フリークエンシー追加
    });
    
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;
    const avgCPA = totalConversions > 0 ? (totalSpend / totalConversions) : 0;
    const avgFrequency = totalReach > 0 ? (totalImpressions / totalReach) : 0;
    
    return {
        spend: Math.round(totalSpend),
        budgetRate: ((totalSpend / (dailyData.length * 20000)) * 100).toFixed(2),
        ctr: avgCTR.toFixed(2),
        cpm: Math.round(avgCPM),
        conversions: totalConversions,
        cpa: Math.round(avgCPA),
        frequency: avgFrequency.toFixed(2),
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
function calculateBudgetRate(spend, selectedDate) {
    // 実際の日予算を設定（例：20,000円）
    const dailyBudget = 20000;
    return ((parseFloat(spend) / dailyBudget) * 100).toFixed(2);
}

function calculateBudgetRateForPeriod(totalSpend, days) {
    const dailyBudget = 20000;
    const periodBudget = dailyBudget * days;
    return ((totalSpend / periodBudget) * 100).toFixed(2);
}

// 日付ラベルのフォーマット
function formatDateLabel(dateString) {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

// 期間データの実際のAPI取得（修正版）
async function fetchMetaPeriodDataWithStoredConfig(period) {
    console.log(`=== Meta API期間データ取得: ${period}日間 ===`);
    try {
        const config = getMetaApiConfigFromSetup();
        
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
            level: 'account',
            time_increment: 1,
            limit: 1000
        };
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`${endpoint}?${queryString}`);
        const data = await response.json();
        if (data.error) throw new Error(`Meta API Error: ${data.error.message}`);
        console.log(`期間データ取得完了: ${data.data.length}日分`);
        return aggregateRealPeriodData(data.data);
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
    const avgCPA = totalConversions > 0 ? (totalSpend / totalConversions) : 0;
    
    return {
        spend: Math.floor(totalSpend),
        budgetRate: ((totalSpend / (days * 15000)) * 100).toFixed(2), // 1日15,000円予算想定
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





// チャットワークテスト送信API
app.post('/api/chatwork-test', requireAuth, async (req, res) => {
    try {
        const { type } = req.body;
        console.log(`🧪 チャットワークテスト送信開始: ${type}`);
        
        const ChatworkAutoSender = require('./utils/chatworkAutoSender');
        const sender = new ChatworkAutoSender();
        
        await sender.sendTestMessage(type);
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

// 404ハンドリング
app.use((req, res) => {
  res.status(404).send('ページが見つかりません');
});

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
        const fs = require('fs');
        const path = require('path');
        const historyPath = path.join(__dirname, 'alert_history.json');
        
        if (fs.existsSync(historyPath)) {
            const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
            
            // 過去24時間以内のアラートのみを返す
            const twentyFourHoursAgo = new Date();
            twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
            
            const recentAlerts = history.filter(alert => {
                const alertTime = new Date(alert.timestamp);
                return alertTime > twentyFourHoursAgo && alert.status === 'active';
            });
            
            // フロントエンドが期待する形式に変換
            const formattedHistory = recentAlerts.map(alert => ({
                metric: alert.metric,
                message: alert.message,
                severity: alert.level,
                timestamp: alert.timestamp
            }));
            
            res.json(formattedHistory);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('アラート履歴取得エラー:', error);
        res.json([]);
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

// スケジューラーを読み込み
try {
    require('./scheduler');
    console.log('✅ スケジューラー読み込み成功');
} catch (error) {
    console.error('❌ スケジューラー読み込み失敗:', error.message);
}

// チャットワーク自動送信機能を初期化
try {
    const ChatworkAutoSender = require('./utils/chatworkAutoSender');
    const chatworkSender = new ChatworkAutoSender();
    chatworkSender.startScheduler();
    console.log('✅ チャットワーク自動送信機能を開始しました');
} catch (error) {
    console.error('❌ チャットワーク自動送信機能の開始に失敗:', error.message);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n==========================================\n✅ サーバー起動成功！\n🌐 URL: http://localhost:${PORT}\n👤 ログイン: komiya / komiya\n==========================================\n  `);
});

// Phase 1: セッション設定用の簡易ルート追加（既存ルーティングは削除しない）
app.post('/temp-api-setup', (req, res) => {
  console.log('=== TEMP API SETUP RECEIVED ===');
  console.log('Request body:', req.body);
  
  if (!req.session.user) {
    console.log('No user session, redirecting to login');
    return res.redirect('/login');
  }
  
  try {
    // API設定をセッションに保存
    if (req.body.metaAccessToken) {
      req.session.metaAccessToken = req.body.metaAccessToken;
    }
    if (req.body.metaAccountId) {
      req.session.metaAccountId = req.body.metaAccountId;
    }
    if (req.body.chatworkApiToken) {
      req.session.chatworkApiToken = req.body.chatworkApiToken;
    }
    if (req.body.chatworkRoomId) {
      req.session.chatworkRoomId = req.body.chatworkRoomId;
    }
    
    // ゴール設定も保存（デフォルト値）
    if (!req.session.goalType) {
      req.session.goalType = 'toC_newsletter';
    }
    
    console.log('Session data saved:', {
      hasMetaToken: !!req.session.metaAccessToken,
      hasMetaAccount: !!req.session.metaAccountId,
      hasChatworkToken: !!req.session.chatworkApiToken,
      hasChatworkRoom: !!req.session.chatworkRoomId,
      hasGoal: !!req.session.goalType
    });
    
    // セットアップ完了状態をチェック
    const isSetupComplete = checkSetupCompletion(req);
    
    if (isSetupComplete) {
      console.log('Setup complete, redirecting to dashboard');
      res.redirect('/dashboard');
    } else {
      console.log('Setup not complete, staying on setup page');
      res.redirect('/setup');
    }
    
  } catch (error) {
    console.error('Temp setup save error:', error);
    res.status(500).json({ error: 'Setup failed: ' + error.message });
  }
});

// Phase 2: セットアップ保存
app.post('/save-setup', (req, res) => {
  console.log('=== SETUP FORM RECEIVED ===');
  console.log('Request body:', req.body);
  console.log('Session user:', req.session.user);
  if (!req.session.user) {
    console.log('No user session, redirecting to login');
    return res.redirect('/login');
  }
  try {
    req.session.metaAccessToken = req.body.metaAccessToken;
    req.session.metaAccountId = req.body.metaAccountId;
    req.session.chatworkApiToken = req.body.chatworkApiToken;
    req.session.chatworkRoomId = req.body.chatworkRoomId;
    console.log('Session data saved:', {
      hasMetaToken: !!req.session.metaAccessToken,
      hasMetaAccount: !!req.session.metaAccountId,
      hasChatworkToken: !!req.session.chatworkApiToken,
      hasChatworkRoom: !!req.session.chatworkRoomId
    });
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ error: 'Session save failed' });
      }
      console.log('Session saved successfully, redirecting to dashboard');
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Setup save error:', error);
    res.status(500).json({ error: 'Setup failed: ' + error.message });
  }
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