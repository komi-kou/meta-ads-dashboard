const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

class Database {
    constructor() {
        // 本番環境では永続化されるパスを使用
        const dbPath = process.env.NODE_ENV === 'production' 
            ? '/opt/render/project/data/users.db' 
            : path.join(__dirname, 'users.db');
            
        this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('❌ データベース接続エラー:', err.message);
            } else {
                console.log('✅ SQLiteデータベースに接続しました');
                this.initializeTables();
            }
        });
    }

    // テーブル初期化（セキュリティ重視）
    initializeTables() {
        const queries = [
            // ユーザーテーブル
            `CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active INTEGER DEFAULT 1,
                login_attempts INTEGER DEFAULT 0,
                locked_until DATETIME NULL
            )`,
            
            // ユーザー設定テーブル（暗号化対応）
            `CREATE TABLE IF NOT EXISTS user_settings (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                meta_access_token TEXT,
                meta_account_id TEXT,
                meta_app_id TEXT,
                chatwork_token TEXT,
                chatwork_room_id TEXT,
                service_goal TEXT,
                target_cpa REAL,
                target_cpm REAL,
                target_ctr REAL,
                notifications_enabled INTEGER DEFAULT 1,
                daily_report_enabled INTEGER DEFAULT 1,
                update_notifications_enabled INTEGER DEFAULT 1,
                alert_notifications_enabled INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            
            // ユーザー別広告データテーブル
            `CREATE TABLE IF NOT EXISTS user_ad_data (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                date TEXT NOT NULL,
                spend REAL,
                impressions INTEGER,
                clicks INTEGER,
                conversions INTEGER,
                ctr REAL,
                cpm REAL,
                cpa REAL,
                budget_rate REAL,
                frequency REAL,
                alerts TEXT, -- JSON形式でアラート情報を保存
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            
            // セッションテーブル（セキュリティ強化）
            `CREATE TABLE IF NOT EXISTS sessions (
                sid TEXT PRIMARY KEY,
                sess TEXT NOT NULL,
                expire INTEGER NOT NULL,
                user_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`,
            
            // ログテーブル（監査用）
            `CREATE TABLE IF NOT EXISTS audit_logs (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
            )`
        ];

        queries.forEach(query => {
            this.db.run(query, (err) => {
                if (err) {
                    console.error('❌ テーブル作成エラー:', err.message);
                } else {
                    console.log('✅ テーブル初期化完了');
                }
            });
        });

        // インデックス作成（パフォーマンス向上）
        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
            'CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_ad_data_user_id ON user_ad_data(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_ad_data_date ON user_ad_data(date)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at)'
        ];

        indexes.forEach(index => {
            this.db.run(index);
        });
    }

    // セキュアなユーザー作成
    async createUser(email, password, username) {
        return new Promise((resolve, reject) => {
            // パスワードの複雑性チェック
            if (password.length < 8) {
                return reject(new Error('パスワードは8文字以上である必要があります'));
            }

            bcrypt.hash(password, 12, (err, hash) => {
                if (err) return reject(err);

                const userId = require('uuid').v4();
                const query = `INSERT INTO users (id, email, password_hash, username) VALUES (?, ?, ?, ?)`;
                
                this.db.run(query, [userId, email.toLowerCase(), hash, username], function(err) {
                    if (err) {
                        if (err.code === 'SQLITE_CONSTRAINT') {
                            reject(new Error('このメールアドレスは既に登録されています'));
                        } else {
                            reject(err);
                        }
                    } else {
                        resolve(userId);
                    }
                });
            });
        });
    }

    // セキュアなユーザー認証
    async authenticateUser(email, password) {
        return new Promise((resolve, reject) => {
            const query = `SELECT id, password_hash, login_attempts, locked_until FROM users WHERE email = ? AND is_active = 1`;
            
            this.db.get(query, [email.toLowerCase()], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);

                // アカウントロック確認
                if (row.locked_until && new Date(row.locked_until) > new Date()) {
                    return reject(new Error('アカウントが一時的にロックされています'));
                }

                bcrypt.compare(password, row.password_hash, (err, isValid) => {
                    if (err) return reject(err);

                    if (isValid) {
                        // ログイン成功 - 試行回数リセット
                        this.db.run(`UPDATE users SET login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
                        resolve(row.id);
                    } else {
                        // ログイン失敗 - 試行回数増加
                        const newAttempts = (row.login_attempts || 0) + 1;
                        let lockUntil = null;
                        
                        if (newAttempts >= 5) {
                            lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30分ロック
                        }

                        this.db.run(`UPDATE users SET login_attempts = ?, locked_until = ? WHERE id = ?`, 
                            [newAttempts, lockUntil?.toISOString(), row.id]);
                        
                        resolve(null);
                    }
                });
            });
        });
    }

    // ユーザー設定の取得（セキュア）
    async getUserSettings(userId) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM user_settings WHERE user_id = ?`;
            this.db.get(query, [userId], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }

    // ユーザー設定の保存/更新
    async saveUserSettings(userId, settings) {
        return new Promise((resolve, reject) => {
            const settingId = require('uuid').v4();
            const query = `
                INSERT OR REPLACE INTO user_settings 
                (id, user_id, meta_access_token, meta_account_id, meta_app_id, 
                 chatwork_token, chatwork_room_id, service_goal, target_cpa, 
                 target_cpm, target_ctr, notifications_enabled, daily_report_enabled,
                 update_notifications_enabled, alert_notifications_enabled, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(query, [
                settingId, userId, settings.meta_access_token, settings.meta_account_id,
                settings.meta_app_id, settings.chatwork_token, settings.chatwork_room_id,
                settings.service_goal, settings.target_cpa, settings.target_cpm,
                settings.target_ctr, settings.notifications_enabled ? 1 : 0,
                settings.daily_report_enabled ? 1 : 0, settings.update_notifications_enabled ? 1 : 0,
                settings.alert_notifications_enabled ? 1 : 0
            ], function(err) {
                if (err) return reject(err);
                resolve(settingId);
            });
        });
    }

    // ユーザー別広告データの保存
    async saveUserAdData(userId, adData) {
        return new Promise((resolve, reject) => {
            const dataId = require('uuid').v4();
            const query = `
                INSERT INTO user_ad_data 
                (id, user_id, date, spend, impressions, clicks, conversions, 
                 ctr, cpm, cpa, budget_rate, frequency, alerts)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [
                dataId, userId, adData.date || adData.date_start, adData.spend,
                adData.impressions, adData.clicks, adData.conversions,
                adData.ctr, adData.cpm, adData.cpa, adData.budget_rate,
                adData.frequency, JSON.stringify(adData.alerts || [])
            ], function(err) {
                if (err) return reject(err);
                resolve(dataId);
            });
        });
    }

    // ユーザー別広告データの取得
    async getUserAdData(userId, limit = 100) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM user_ad_data 
                WHERE user_id = ? 
                ORDER BY date DESC 
                LIMIT ?
            `;
            this.db.all(query, [userId, limit], (err, rows) => {
                if (err) return reject(err);
                
                // alerts フィールドをJSONパース
                const processedRows = rows.map(row => ({
                    ...row,
                    alerts: row.alerts ? JSON.parse(row.alerts) : []
                }));
                
                resolve(processedRows);
            });
        });
    }

    // 監査ログの記録
    async logAuditEvent(userId, action, details, ipAddress, userAgent) {
        return new Promise((resolve, reject) => {
            const logId = require('uuid').v4();
            const query = `
                INSERT INTO audit_logs (id, user_id, action, details, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            this.db.run(query, [logId, userId, action, details, ipAddress, userAgent], function(err) {
                if (err) return reject(err);
                resolve(logId);
            });
        });
    }

    // データベース接続終了
    close() {
        this.db.close((err) => {
            if (err) {
                console.error('❌ データベース切断エラー:', err.message);
            } else {
                console.log('✅ データベース接続を閉じました');
            }
        });
    }
}

module.exports = Database;