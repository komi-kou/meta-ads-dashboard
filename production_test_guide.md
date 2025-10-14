# 本番環境 通知テスト手順

## 📋 事前確認

### 1. Render.com ダッシュボード確認
- ✅ サービスが正常に稼働しているか
- ✅ 最新のコミットがデプロイされているか
- ✅ ボリュームが正しくマウントされているか (`/opt/render/project/data`)

### 2. 環境変数確認
必要な環境変数が設定されているか:
- `NODE_ENV=production`
- `SESSION_SECRET`
- その他の必要な設定

---

## 🧪 本番環境テスト手順

### ステップ1: ログイン
```
URL: https://meta-ads-dashboard.onrender.com/login
Email: test123@gmail.com
Password: kmykuhi1215K
```

### ステップ2: ブラウザのコンソールを開く
- Chrome: F12 → Console タブ
- Safari: Cmd+Opt+C → Console タブ

### ステップ3: 全時間帯テストを実行

以下のコードをコンソールに貼り付けて実行:

```javascript
async function testAllHours() {
    const hours = [9, 12, 15, 17, 19];
    const userId = '3dab6ad4-6397-4659-b96e-88a3d59bc85b';
    
    console.log('='.repeat(60));
    console.log('📋 本番環境 全時間帯テスト開始');
    console.log('='.repeat(60));
    
    for (const hour of hours) {
        console.log(`\n⏰ ${hour}時の通知テスト...`);
        
        try {
            const response = await fetch('/api/test/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    hour: hour,
                    userId: userId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                console.log(`✅ ${hour}時: 成功`);
                console.log(`   送信結果:`, data.results);
            } else {
                console.error(`❌ ${hour}時: 失敗`, data);
            }
        } catch (error) {
            console.error(`❌ ${hour}時: エラー`, error);
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 全時間帯テスト完了');
    console.log('='.repeat(60));
    console.log('\n📱 Chatworkで以下を確認してください:');
    console.log('   Room 412659441 (メインアカウント)');
    console.log('   Room 405488662 (追加アカウント「整足院」)');
}

testAllHours();
```

---

## ✅ 確認ポイント

### Chatwork Room 412659441 (メインアカウント)
各時間帯で以下の通知が届くこと:

**9時:**
- [ ] 日次レポート
- [ ] アラート通知

**12時, 15時, 17時, 19時:**
- [ ] 定期更新通知
- [ ] アラート通知

### Chatwork Room 405488662 (追加アカウント)
各時間帯で以下の通知が届くこと:

**9時:**
- [ ] 日次レポート
- [ ] アラート通知

**12時, 15時, 17時, 19時:**
- [ ] 定期更新通知
- [ ] アラート通知

### 通知内容の確認
- [ ] メインアカウントと追加アカウントの通知形式が統一されている
- [ ] 実数値に基づいた内容になっている
- [ ] 重複した通知が送られていない
- [ ] それぞれ正しいルームIDに分離されている

---

## 🔧 トラブルシューティング

### 通知が届かない場合

1. **ユーザー登録確認**
   - `/data/users.json` に test123@gmail.com が存在するか
   - `is_active: true` になっているか

2. **設定ファイル確認**
   - `/data/user_settings/3dab6ad4-6397-4659-b96e-88a3d59bc85b.json` が存在するか
   - `enable_scheduler: true` になっているか
   - `enable_chatwork: true` になっているか
   - ルームIDが正しく設定されているか

3. **ログ確認**
   - Render.comのログで通知送信のログを確認
   - エラーメッセージがないか確認

4. **スケジューラー確認**
   - `scheduler.js` が正常に起動しているか
   - cron設定が正しいか (9, 12, 15, 17, 19時)

---

## 📝 結果記録

テスト実施日時: _______________

| 時間帯 | Room 412659441 | Room 405488662 | 備考 |
|--------|----------------|----------------|------|
| 9時    | □             | □             |      |
| 12時   | □             | □             |      |
| 15時   | □             | □             |      |
| 17時   | □             | □             |      |
| 19時   | □             | □             |      |

通知内容:
- メイン/追加アカウントの形式統一: □
- 実数値ベース: □
- 重複なし: □
- ルーム分離: □

---

## 🎯 次のステップ

全てのテストが成功した場合:
1. ✅ 本番環境での動作確認完了
2. ✅ 定時スケジュールで自動実行される
3. ✅ 新規ユーザー登録も問題なく動作する
4. ✅ 追加アカウント設定も問題なく動作する

本番環境で問題が発生した場合:
1. ログを確認
2. 設定ファイルを確認
3. 必要に応じて修正とデプロイ
