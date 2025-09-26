// metaApi参照エラーを修正
const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appPath, 'utf8');

// metaApiがrequireされているか確認
if (!content.includes("const metaApi = require('./metaApi')")) {
    console.log('❌ metaApiがrequireされていません。追加します...');
    
    // UserManagerの後にmetaApiを追加
    const userManagerIndex = content.indexOf("const UserManager = require('./UserManager');");
    if (userManagerIndex !== -1) {
        const insertPoint = content.indexOf('\n', userManagerIndex) + 1;
        content = content.substring(0, insertPoint) + 
                  "const metaApi = require('./metaApi');\n" + 
                  content.substring(insertPoint);
        
        fs.writeFileSync(appPath, content, 'utf8');
        console.log('✅ metaApiのrequire文を追加しました');
    }
} else {
    console.log('✅ metaApiは既にrequireされています');
}

console.log('修正完了！');