const fs = require('fs').promises;
const path = require('path');

const TOKEN_INFO_FILE = path.join(__dirname, '..', 'config', 'tokenInfo.json');

class TokenManager {
    constructor() {
        this.tokenInfo = null;
    }

    // トークン情報を読み込み
    async loadTokenInfo() {
        try {
            const data = await fs.readFile(TOKEN_INFO_FILE, 'utf8');
            this.tokenInfo = JSON.parse(data);
            return this.tokenInfo;
        } catch (error) {
            // ファイルが存在しない場合は初期化
            this.tokenInfo = {
                registrationDate: null,
                expiryDate: null,
                notificationDate: null,
                notificationSent: false,
                lastChecked: null
            };
            await this.saveTokenInfo();
            return this.tokenInfo;
        }
    }

    // トークン情報を保存
    async saveTokenInfo() {
        try {
            await fs.writeFile(TOKEN_INFO_FILE, JSON.stringify(this.tokenInfo, null, 2));
        } catch (error) {
            console.error('トークン情報保存エラー:', error);
        }
    }

    // トークン登録時の処理
    async registerToken() {
        const registrationDate = new Date();
        const expiryDate = new Date(registrationDate);
        expiryDate.setMonth(expiryDate.getMonth() + 2); // 2ヶ月後
        
        const notificationDate = new Date(expiryDate);
        notificationDate.setDate(notificationDate.getDate() - 7); // 1週間前
        
        this.tokenInfo = {
            registrationDate: registrationDate.toISOString(),
            expiryDate: expiryDate.toISOString(),
            notificationDate: notificationDate.toISOString(),
            notificationSent: false,
            lastChecked: new Date().toISOString()
        };
        
        await this.saveTokenInfo();
        console.log('✅ トークン登録完了:', {
            registrationDate: this.tokenInfo.registrationDate,
            expiryDate: this.tokenInfo.expiryDate,
            notificationDate: this.tokenInfo.notificationDate
        });
    }

    // トークン期限チェック
    async checkTokenExpiry() {
        await this.loadTokenInfo();
        
        if (!this.tokenInfo.registrationDate) {
            console.log('⚠️ トークン登録日が記録されていません');
            return { shouldNotify: false, reason: 'no_registration_date' };
        }

        const today = new Date();
        const notificationDate = new Date(this.tokenInfo.notificationDate);
        const expiryDate = new Date(this.tokenInfo.expiryDate);

        // 既に通知済みの場合は送信しない
        if (this.tokenInfo.notificationSent) {
            console.log('ℹ️ トークン期限通知は既に送信済みです');
            return { shouldNotify: false, reason: 'already_notified' };
        }

        // 通知日に達した場合のみ送信
        if (today >= notificationDate && today < expiryDate) {
            console.log('⚠️ トークン期限警告送信が必要です');
            return { shouldNotify: true, reason: 'notification_due' };
        }

        // 期限切れの場合
        if (today >= expiryDate) {
            console.log('🚨 トークンが期限切れです');
            return { shouldNotify: false, reason: 'expired' };
        }

        // 通知日より前
        console.log('ℹ️ トークン期限通知日まで待機中');
        return { shouldNotify: false, reason: 'before_notification_date' };
    }

    // 通知送信完了マーク
    async markNotificationSent() {
        this.tokenInfo.notificationSent = true;
        this.tokenInfo.lastChecked = new Date().toISOString();
        await this.saveTokenInfo();
        console.log('✅ トークン期限通知送信完了を記録しました');
    }

    // トークン情報をリセット（新しいトークン登録時）
    async resetTokenInfo() {
        this.tokenInfo = {
            registrationDate: null,
            expiryDate: null,
            notificationDate: null,
            notificationSent: false,
            lastChecked: null
        };
        await this.saveTokenInfo();
        console.log('🔄 トークン情報をリセットしました');
    }

    // トークン情報の詳細を取得
    async getTokenInfo() {
        await this.loadTokenInfo();
        return this.tokenInfo;
    }
}

module.exports = new TokenManager(); 