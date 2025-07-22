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
async function sendChatworkNotification(type, data = {}) {
  try {
    let config = {};
    
    // 本番環境では環境変数から取得
    if (process.env.NODE_ENV === 'production') {
      config = {
        apiToken: process.env.CHATWORK_TOKEN,
        roomId: process.env.CHATWORK_ROOM_ID
      };
    } else {
      // ローカル環境では設定ファイルから取得
      const fs = require('fs');
      const path = require('path');
      
      const settingsPath = path.join(__dirname, 'settings.json');
      if (!fs.existsSync(settingsPath)) {
        console.log('設定ファイルなし - アラート通知スキップ');
        return;
      }

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      config = settings.chatwork;
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
