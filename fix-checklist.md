# Chatworkテスト修正チェックリスト

## ✅ 実装完了内容

### 1. 日次レポートテスト専用メソッド
- **ファイル**: `utils/multiUserChatworkSender.js`
- **メソッド**: `sendTestDailyReport()`（152行目～）
- **特徴**: 
  - Meta APIを一切呼ばない
  - 固定のテストデータのみ使用
  - 適切な桁数でフォーマット

### 2. テストモードリダイレクト
- **ファイル**: `utils/multiUserChatworkSender.js`
- **変更箇所**: `sendUserDailyReport()`の48-50行目
- **動作**: `isTestMode=true`の場合、`sendTestDailyReport()`を呼び出し

### 3. デバッグ情報追加
- **ファイル**: `app.js`
- **変更箇所**: 4285-4289行目
- **内容**: ユーザー設定の実際のフィールドを表示

### 4. アラート重複排除強化
- **ファイル**: `utils/multiUserChatworkSender.js`
- **変更箇所**: 275-296行目
- **方式**: ユニークキー（メトリック+目標値+現在値）で管理

### 5. Chatworkトークン統一
- **ファイル**: `app.js`
- **変更箇所**: 4294-4313行目
- **対応フィールド**: 
  - chatwork_api_token
  - chatwork_token
  - chatworkApiToken
  - chatworkToken

## 📊 期待される結果

### 日次レポート
```
消化金額（合計）：2,207円
予算消化率（平均）：100%
CTR（平均）：0.8%  ← 0.793651から修正
CPM（平均）：1,946円  ← 1946.208から修正
フリークエンシー（平均）：1.3  ← 1.3451957から修正
コンバージョン数：0件
```

### アラート通知
- 重複なし（4件のユニークアラートのみ）
- CTR、CPM、CV、予算消化率

## 🔍 動作確認手順

1. **プロセス再起動**
   ```bash
   pkill -f node
   npm start
   ```

2. **管理画面でテスト**
   - https://meta-ads-dashboard.onrender.com/chatwork-test
   - 各テストボタンをクリック

3. **コンソールログ確認**
   - `📝 === テスト専用日次レポート送信開始 ===`
   - `🔀 テスト専用メソッドにリダイレクト`
   - `CTR: 0.8%`
   - `CPM: 1,946円`
   - `フリークエンシー: 1.3`

## ⚠️ 注意事項

- **必ずプロセスを再起動**してください
- require.cacheが古いコードをキャッシュしている可能性があります
- pm2を使用している場合は`pm2 reload all`を実行

## 📁 修正ファイル一覧

1. `utils/multiUserChatworkSender.js`
2. `app.js`
3. `chatworkApi.js`

これらのファイルをデプロイしてください。