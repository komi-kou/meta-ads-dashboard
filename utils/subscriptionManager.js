/**
 * サブスクリプション管理システム
 * 解約者の完全アクセス制限機能
 */

const fs = require('fs');
const path = require('path');

class SubscriptionManager {
    constructor() {
        this.subscriptionFile = path.join(__dirname, '../data/user_subscriptions.json');
        this.ensureSubscriptionFile();
    }

    // サブスクリプションファイルの初期化
    ensureSubscriptionFile() {
        if (!fs.existsSync(this.subscriptionFile)) {
            const initialData = [];
            fs.writeFileSync(this.subscriptionFile, JSON.stringify(initialData, null, 2));
        }
    }

    // サブスクリプション情報を読み込み
    getSubscriptions() {
        try {
            const data = fs.readFileSync(this.subscriptionFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('サブスクリプション読み込みエラー:', error);
            return [];
        }
    }

    // サブスクリプション情報を保存
    saveSubscriptions(subscriptions) {
        try {
            fs.writeFileSync(this.subscriptionFile, JSON.stringify(subscriptions, null, 2));
            return true;
        } catch (error) {
            console.error('サブスクリプション保存エラー:', error);
            return false;
        }
    }

    // ユーザーのサブスクリプション状態を取得
    getUserSubscription(userId) {
        const subscriptions = this.getSubscriptions();
        return subscriptions.find(sub => sub.user_id === userId);
    }

    // サブスクリプション作成/更新
    updateUserSubscription(userId, subscriptionData) {
        const subscriptions = this.getSubscriptions();
        const existingIndex = subscriptions.findIndex(sub => sub.user_id === userId);
        
        const subscription = {
            user_id: userId,
            plan_type: subscriptionData.plan_type || 'basic',
            status: subscriptionData.status || 'active',
            start_date: subscriptionData.start_date || new Date().toISOString(),
            end_date: subscriptionData.end_date,
            payment_method: subscriptionData.payment_method,
            stripe_customer_id: subscriptionData.stripe_customer_id,
            created_at: subscriptionData.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        if (existingIndex >= 0) {
            subscriptions[existingIndex] = { ...subscriptions[existingIndex], ...subscription };
        } else {
            subscriptions.push(subscription);
        }

        return this.saveSubscriptions(subscriptions);
    }

    // アクティブなサブスクリプションかチェック
    isSubscriptionActive(userId) {
        const subscription = this.getUserSubscription(userId);
        
        if (!subscription) {
            console.log(`❌ ユーザー ${userId}: サブスクリプション未登録`);
            return false;
        }

        // ステータスチェック
        if (subscription.status !== 'active') {
            console.log(`❌ ユーザー ${userId}: ステータス無効 (${subscription.status})`);
            return false;
        }

        // 期限チェック
        if (subscription.end_date && new Date(subscription.end_date) <= new Date()) {
            console.log(`❌ ユーザー ${userId}: 期限切れ (${subscription.end_date})`);
            // 自動的に期限切れステータスに更新
            this.updateUserSubscription(userId, { status: 'expired' });
            return false;
        }

        console.log(`✅ ユーザー ${userId}: アクティブなサブスクリプション`);
        return true;
    }

    // サブスクリプションを解約
    cancelSubscription(userId, reason = 'user_cancelled') {
        const subscription = this.getUserSubscription(userId);
        if (!subscription) {
            return false;
        }

        return this.updateUserSubscription(userId, {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason
        });
    }

    // トライアル期間の設定
    createTrialSubscription(userId, trialDays = 14) {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDays);

        return this.updateUserSubscription(userId, {
            plan_type: 'trial',
            status: 'active',
            end_date: endDate.toISOString(),
            payment_method: 'trial'
        });
    }

    // 全解約者のリストを取得
    getCancelledUsers() {
        const subscriptions = this.getSubscriptions();
        return subscriptions.filter(sub => 
            sub.status === 'cancelled' || 
            sub.status === 'expired' ||
            (sub.end_date && new Date(sub.end_date) <= new Date())
        ).map(sub => sub.user_id);
    }
}

module.exports = SubscriptionManager;