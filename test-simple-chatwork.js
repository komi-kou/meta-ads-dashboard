// シンプルなChatworkテスト
const axios = require('axios');

async function testChatwork() {
    // setup.jsonから設定を読み込み
    const setupConfig = require('./config/setup.json');
    
    console.log('=== Chatwork接続テスト ===');
    console.log('Room ID (setup.json):', setupConfig.chatwork.roomId);
    console.log('Token length:', setupConfig.chatwork.apiToken?.length || 0);
    
    const url = `https://api.chatwork.com/v2/rooms/${setupConfig.chatwork.roomId}/messages`;
    const formData = new URLSearchParams();
    formData.append('body', `[info]テスト送信: ${new Date().toLocaleString('ja-JP')}[/info]`);
    
    try {
        const response = await axios.post(url, formData, {
            headers: {
                'X-ChatWorkToken': setupConfig.chatwork.apiToken,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('✅ 送信成功！');
        console.log('Message ID:', response.data.message_id);
    } catch (error) {
        console.error('❌ 送信失敗');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data);
    }
}

testChatwork();