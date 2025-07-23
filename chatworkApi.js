const axios = require('axios');

async function sendChatworkMessage({ date, message, token, room_id }) {
  if (!token || !room_id || !message || message.trim() === "") {
    console.error("Chatwork送信メッセージが空です。送信をスキップします。");
    return;
  }
  
  console.log(`[Chatwork] 送信準備: メッセージ長=${message.length}, ルームID=${room_id}`);
  
  const url = `https://api.chatwork.com/v2/rooms/${room_id}/messages`;
  try {
    // URLSearchParamsを使用してフォームデータとして送信
    const formData = new URLSearchParams();
    formData.append('body', message);
    
    await axios.post(url, formData, {
      headers: { 
        'X-ChatWorkToken': token,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    console.log(`[chatwork] ${date}のアラート通知を送信しました`);
  } catch (err) {
    console.error('Chatwork送信エラー:', err.response?.data || err.message);
    console.error('リクエスト詳細:', {
      url: url,
      messageLength: message.length,
      tokenLength: token ? token.length : 0
    });
  }
}

// アラート通知用の関数
async function sendChatworkNotification(type, data = {}, userId = null) {
  try {
    let config = {};
    
    // パターン1: ユーザー別設定から取得（優先）
    if (userId) {
      try {
        const { getUserManager } = require('./middleware/testAuth');
        const userManager = getUserManager();
        const userSettings = userManager.getUserSettings(userId);
        
        if (userSettings && userSettings.chatwork_token && userSettings.chatwork_room_id) {
          console.log('✅ ユーザー別チャットワーク設定取得成功');
          config = {
            apiToken: userSettings.chatwork_token,
            roomId: userSettings.chatwork_room_id
          };
        } else {
          console.log('❌ ユーザー別チャットワーク設定が不完全または未設定');
        }
      } catch (error) {
        console.error('ユーザー別チャットワーク設定取得エラー:', error);
      }
    }
    
    // パターン2: 環境変数から取得（本番環境）
    if (!config.apiToken && process.env.NODE_ENV === 'production') {
      config = {
        apiToken: process.env.CHATWORK_TOKEN,
        roomId: process.env.CHATWORK_ROOM_ID
      };
    }
    
    // パターン3: 設定ファイルから取得（後方互換性）
    if (!config.apiToken) {
      const fs = require('fs');
      const path = require('path');
      
      const settingsPath = path.join(__dirname, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings.chatwork) {
          config = settings.chatwork;
        }
      }
    }
    
    if (!config.apiToken || !config.roomId) {
      console.log('チャットワーク設定なし - アラート通知スキップ');
      return;
    }
    
    let message = '';
    
    switch (type) {
      case 'alert_notification':
        message = data.customMessage || '[info][title]🚨 Meta広告アラート通知[/title]\nアラートが発生しました。[/info]';
        break;
      case 'morning_alert_summary':
        message = data.customMessage || '[info][title]🌅 朝のアラートサマリー[/title]\n本日のアラート確認をお願いします。[/info]';
        break;
      default:
        message = data.customMessage || '[info][title]通知[/title]\n通知が送信されました。[/info]';
    }
    
    await sendChatworkMessage({
      date: new Date().toISOString().slice(0, 10),
      message: message,
      token: config.apiToken,
      room_id: config.roomId
    });
    
    console.log('✅ チャットワーク通知送信完了');
    
  } catch (error) {
    console.error('❌ チャットワーク通知送信エラー:', error);
  }
}

module.exports = { sendChatworkMessage, sendChatworkNotification };
