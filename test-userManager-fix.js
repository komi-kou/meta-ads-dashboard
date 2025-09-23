// test-userManager-fix.js - UserManager修正のテスト
const UserManager = require('./userManager');

console.log('=== UserManager修正テスト ===\n');

try {
    const userManager = new UserManager();
    
    console.log('1. getAllUsersメソッドのテスト');
    const users = userManager.getAllUsers();
    console.log(`   取得したユーザー数: ${users.length}`);
    
    users.forEach(user => {
        console.log(`   - ${user.email} (ID: ${user.id})`);
    });
    
    console.log('\n2. getUserSettings個別テスト');
    const testUserId = 'b4475ace-303e-4fd1-8740-221154c9b291';
    const settings = userManager.getUserSettings(testUserId);
    
    if (settings) {
        console.log(`   ✅ komiya11122@gmail.com の設定取得成功`);
        console.log(`   - ChatworkルームID: ${settings.chatwork_room_id}`);
        console.log(`   - アラート有効: ${settings.enable_alerts}`);
    }
    
    console.log('\n✅ UserManager修正成功！');
    
} catch (error) {
    console.error('❌ エラー:', error.message);
    console.error(error.stack);
}