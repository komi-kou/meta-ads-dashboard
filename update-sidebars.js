const fs = require('fs');
const path = require('path');

// 更新対象のビューファイル
const viewFiles = [
    'campaigns.ejs',
    'budget-scheduling.ejs',
    'detailed-reports.ejs',
    'alerts.ejs',
    'alert-history.ejs',
    'improvement-tasks.ejs',
    'improvement-strategies.ejs',
    'settings.ejs'
];

// 古いサイドバーのパターン
const oldSidebarPattern = /<nav class="sidebar-nav">[\s\S]*?<\/nav>/;

// 新しいサイドバーのHTML
const newSidebarNav = `<nav class="sidebar-nav">
                <a href="/dashboard" class="nav-item">ダッシュボード</a>
                <a href="/campaigns" class="nav-item">📊 キャンペーン管理</a>
                <a href="/ad-performance" class="nav-item">🎯 広告パフォーマンス</a>
                <a href="/audience-analysis" class="nav-item">👥 オーディエンス分析</a>
                <a href="/budget-scheduling" class="nav-item">⏰ 予算スケジューリング</a>
                <a href="/detailed-reports" class="nav-item">📈 詳細レポート</a>
                <a href="/alerts" class="nav-item" id="alerts-link">アラート内容</a>
                <a href="/alert-history" class="nav-item">アラート履歴</a>
                <a href="/improvement-tasks" class="nav-item">確認事項</a>
                <a href="/improvement-strategies" class="nav-item">改善施策</a>            </nav>`;

console.log('========================================');
console.log('📝 サイドバー更新スクリプト開始');
console.log('========================================\n');

viewFiles.forEach(fileName => {
    const filePath = path.join(__dirname, 'views', fileName);
    
    try {
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️  ${fileName} - ファイルが存在しません`);
            return;
        }
        
        let content = fs.readFileSync(filePath, 'utf8');
        
        // サイドバーが含まれているか確認
        if (!content.includes('sidebar-nav')) {
            console.log(`⏭️  ${fileName} - サイドバーなし（スキップ）`);
            return;
        }
        
        // サイドバーを更新
        if (oldSidebarPattern.test(content)) {
            content = content.replace(oldSidebarPattern, newSidebarNav);
            
            // 現在のページをアクティブにする
            const pageName = fileName.replace('.ejs', '');
            const pagePatterns = {
                'campaigns': '📊 キャンペーン管理',
                'budget-scheduling': '⏰ 予算スケジューリング',
                'detailed-reports': '📈 詳細レポート',
                'alerts': 'アラート内容',
                'alert-history': 'アラート履歴',
                'improvement-tasks': '確認事項',
                'improvement-strategies': '改善施策',
                'settings': null // settingsページは特別扱い
            };
            
            if (pagePatterns[pageName]) {
                // 該当するメニュー項目にactiveクラスを追加
                const menuText = pagePatterns[pageName];
                content = content.replace(
                    new RegExp(`(<a href="/${pageName}"[^>]*class="nav-item)(">.*?${menuText}.*?</a>)`),
                    '$1 active$2'
                );
            }
            
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${fileName} - 更新完了`);
        } else {
            console.log(`ℹ️  ${fileName} - 既に最新または異なる形式`);
        }
    } catch (error) {
        console.error(`❌ ${fileName} - エラー: ${error.message}`);
    }
});

console.log('\n========================================');
console.log('✅ サイドバー更新完了');
console.log('========================================');