// Chatworkのルーム一覧を取得して権限を確認
const axios = require('axios');
const fs = require('fs');

async function checkChatworkRooms() {
    const setupConfig = require('./config/setup.json');
    const userSettings = JSON.parse(fs.readFileSync('./user_settings/7fe7e401-a67b-40fb-bdff-0b61b67dc116.json', 'utf8'));
    
    console.log('=== Chatwork Room権限チェック ===\n');
    
    // 利用可能なルーム一覧を取得
    const url = 'https://api.chatwork.com/v2/rooms';
    
    try {
        const response = await axios.get(url, {
            headers: {
                'X-ChatWorkToken': setupConfig.chatwork.apiToken
            }
        });
        
        console.log('取得したルーム数:', response.data.length);
        console.log('\n設定されているRoom ID:');
        console.log('- setup.json:', setupConfig.chatwork.roomId);
        console.log('- user_settings:', userSettings.chatwork_room_id);
        
        console.log('\n利用可能なルーム一覧:');
        response.data.forEach(room => {
            console.log(`- Room ID: ${room.room_id}`);
            console.log(`  名前: ${room.name}`);
            console.log(`  タイプ: ${room.type}`);
            console.log(`  役割: ${room.role}`);
            console.log(`  メッセージ送信権限: ${room.role === 'admin' || room.role === 'member' ? '○' : '×'}`);
            console.log('');
        });
        
        // 設定されているRoom IDが利用可能か確認
        const setupRoomExists = response.data.some(r => r.room_id == setupConfig.chatwork.roomId);
        const userRoomExists = response.data.some(r => r.room_id == userSettings.chatwork_room_id);
        
        console.log('権限確認結果:');
        console.log(`- setup.json (${setupConfig.chatwork.roomId}): ${setupRoomExists ? '✅ 存在する' : '❌ 存在しない/権限なし'}`);
        console.log(`- user_settings (${userSettings.chatwork_room_id}): ${userRoomExists ? '✅ 存在する' : '❌ 存在しない/権限なし'}`);
        
        // 送信可能なルームを提案
        const sendableRooms = response.data.filter(r => r.role === 'admin' || r.role === 'member');
        if (sendableRooms.length > 0) {
            console.log('\n📝 送信可能なルーム候補:');
            sendableRooms.forEach(room => {
                console.log(`- Room ID: ${room.room_id} (${room.name})`);
            });
        }
        
    } catch (error) {
        console.error('❌ エラーが発生しました:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data || error.message);
    }
}

checkChatworkRooms();