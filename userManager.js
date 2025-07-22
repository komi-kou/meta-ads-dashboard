const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

class UserManager {
    constructor() {
        // データファイルのパス
        this.usersFile = path.join(__dirname, 'data', 'users.json');
        this.settingsFile = path.join(__dirname, 'data', 'user_settings.json');
        this.dataFile = path.join(__dirname, 'data', 'user_ad_data.json');
        this.auditFile = path.join(__dirname, 'data', 'audit_logs.json');
        
        // データディレクトリを作成
        this.ensureDataDirectory();
        
        // ファイルを初期化
        this.initializeFiles();
    }

    // データディレクトリの確保
    ensureDataDirectory() {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ データディレクトリを作成しました');
        }
    }

    // ファイルの初期化
    initializeFiles() {
        const files = [
            { path: this.usersFile, default: [] },
            { path: this.settingsFile, default: [] },
            { path: this.dataFile, default: [] },
            { path: this.auditFile, default: [] }
        ];

        files.forEach(file => {
            if (!fs.existsSync(file.path)) {
                this.writeJsonFile(file.path, file.default);
                console.log(`✅ ${path.basename(file.path)} を初期化しました`);
            }
        });
    }

    // JSONファイルの安全な読み込み
    readJsonFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const data = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(data);
            }
            return [];
        } catch (error) {
            console.error(`ファイル読み込みエラー ${filePath}:`, error);
            return [];
        }
    }

    // JSONファイルの安全な書き込み
    writeJsonFile(filePath, data) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error(`ファイル書き込みエラー ${filePath}:`, error);
            return false;
        }
    }

    // ユーザー作成
    async createUser(email, password, username) {
        try {
            // パスワードの複雑性チェック
            if (password.length < 8) {
                throw new Error('パスワードは8文字以上である必要があります');
            }

            const users = this.readJsonFile(this.usersFile);
            
            // 重複チェック
            const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
            if (existingUser) {
                throw new Error('このメールアドレスは既に登録されています');
            }

            // パスワードハッシュ化
            const passwordHash = await bcrypt.hash(password, 12);
            
            const userId = uuidv4();
            const newUser = {
                id: userId,
                email: email.toLowerCase(),
                password_hash: passwordHash,
                username: username,
                created_at: new Date().toISOString(),
                last_login: null,
                is_active: true,
                login_attempts: 0,
                locked_until: null
            };

            users.push(newUser);
            this.writeJsonFile(this.usersFile, users);

            console.log(`✅ ユーザー作成完了: ${email}`);
            return userId;
        } catch (error) {
            console.error('ユーザー作成エラー:', error);
            throw error;
        }
    }

    // ユーザー認証
    async authenticateUser(email, password) {
        try {
            const users = this.readJsonFile(this.usersFile);
            const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.is_active);

            if (!user) {
                return null;
            }

            // アカウントロック確認
            if (user.locked_until && new Date(user.locked_until) > new Date()) {
                throw new Error('アカウントが一時的にロックされています');
            }

            // パスワード確認
            const isValid = await bcrypt.compare(password, user.password_hash);
            
            if (isValid) {
                // ログイン成功 - 試行回数リセット
                user.login_attempts = 0;
                user.locked_until = null;
                user.last_login = new Date().toISOString();
                this.writeJsonFile(this.usersFile, users);
                
                console.log(`✅ ログイン成功: ${email}`);
                return user.id;
            } else {
                // ログイン失敗 - 試行回数増加
                user.login_attempts = (user.login_attempts || 0) + 1;
                
                if (user.login_attempts >= 5) {
                    user.locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30分ロック
                }
                
                this.writeJsonFile(this.usersFile, users);
                return null;
            }
        } catch (error) {
            console.error('認証エラー:', error);
            throw error;
        }
    }

    // ユーザー設定取得
    getUserSettings(userId) {
        const settings = this.readJsonFile(this.settingsFile);
        return settings.find(s => s.user_id === userId) || null;
    }

    // ユーザー設定保存
    saveUserSettings(userId, settingsData) {
        try {
            const settings = this.readJsonFile(this.settingsFile);
            const existingIndex = settings.findIndex(s => s.user_id === userId);
            
            const userSettings = {
                id: existingIndex >= 0 ? settings[existingIndex].id : uuidv4(),
                user_id: userId,
                meta_access_token: settingsData.meta_access_token,
                meta_account_id: settingsData.meta_account_id,
                meta_app_id: settingsData.meta_app_id,
                chatwork_token: settingsData.chatwork_token,
                chatwork_room_id: settingsData.chatwork_room_id,
                service_goal: settingsData.service_goal,
                target_cpa: settingsData.target_cpa,
                target_cpm: settingsData.target_cpm,
                target_ctr: settingsData.target_ctr,
                notifications_enabled: settingsData.notifications_enabled !== false,
                daily_report_enabled: settingsData.daily_report_enabled !== false,
                update_notifications_enabled: settingsData.update_notifications_enabled !== false,
                alert_notifications_enabled: settingsData.alert_notifications_enabled !== false,
                updated_at: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                settings[existingIndex] = userSettings;
            } else {
                userSettings.created_at = new Date().toISOString();
                settings.push(userSettings);
            }

            this.writeJsonFile(this.settingsFile, settings);
            console.log(`✅ ユーザー設定保存完了: ${userId}`);
            return userSettings.id;
        } catch (error) {
            console.error('設定保存エラー:', error);
            throw error;
        }
    }

    // ユーザー広告データ保存
    saveUserAdData(userId, adData) {
        try {
            const allData = this.readJsonFile(this.dataFile);
            
            const userAdData = {
                id: uuidv4(),
                user_id: userId,
                date: adData.date || adData.date_start,
                spend: adData.spend,
                impressions: adData.impressions,
                clicks: adData.clicks,
                conversions: adData.conversions,
                ctr: adData.ctr,
                cpm: adData.cpm,
                cpa: adData.cpa,
                budget_rate: adData.budget_rate,
                frequency: adData.frequency,
                alerts: adData.alerts || [],
                created_at: new Date().toISOString()
            };

            allData.push(userAdData);
            
            // 古いデータを削除（ユーザーごとに最新100件まで保持）
            const userDataCount = allData.filter(d => d.user_id === userId).length;
            if (userDataCount > 100) {
                const userDataSorted = allData
                    .filter(d => d.user_id === userId)
                    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                const toKeep = userDataSorted.slice(0, 100);
                const otherUserData = allData.filter(d => d.user_id !== userId);
                
                this.writeJsonFile(this.dataFile, [...otherUserData, ...toKeep]);
            } else {
                this.writeJsonFile(this.dataFile, allData);
            }

            console.log(`✅ ユーザー広告データ保存完了: ${userId}`);
            return userAdData.id;
        } catch (error) {
            console.error('広告データ保存エラー:', error);
            throw error;
        }
    }

    // ユーザー広告データ取得
    getUserAdData(userId, limit = 30) {
        const allData = this.readJsonFile(this.dataFile);
        return allData
            .filter(d => d.user_id === userId)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, limit);
    }

    // 全アクティブユーザー取得（チャットワーク送信用）
    getAllActiveUsers() {
        const users = this.readJsonFile(this.usersFile);
        const settings = this.readJsonFile(this.settingsFile);
        
        return users
            .filter(u => u.is_active)
            .map(user => {
                const userSettings = settings.find(s => s.user_id === user.id);
                if (userSettings && 
                    userSettings.notifications_enabled && 
                    userSettings.chatwork_token && 
                    userSettings.chatwork_room_id &&
                    userSettings.meta_access_token) {
                    return {
                        ...user,
                        ...userSettings
                    };
                }
                return null;
            })
            .filter(user => user !== null);
    }

    // 監査ログ記録
    logAuditEvent(userId, action, details, ipAddress, userAgent) {
        try {
            const logs = this.readJsonFile(this.auditFile);
            
            const logEntry = {
                id: uuidv4(),
                user_id: userId,
                action: action,
                details: details,
                ip_address: ipAddress,
                user_agent: userAgent,
                created_at: new Date().toISOString()
            };

            logs.push(logEntry);
            
            // 古いログを削除（最新1000件まで保持）
            if (logs.length > 1000) {
                const sortedLogs = logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                this.writeJsonFile(this.auditFile, sortedLogs.slice(0, 1000));
            } else {
                this.writeJsonFile(this.auditFile, logs);
            }

            return logEntry.id;
        } catch (error) {
            console.error('監査ログエラー:', error);
        }
    }

    // ユーザー情報取得
    getUserById(userId) {
        const users = this.readJsonFile(this.usersFile);
        return users.find(u => u.id === userId) || null;
    }
}

module.exports = UserManager;