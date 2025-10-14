#!/usr/bin/env python3
import os
import re

# 自動最適化提案メニューを追加
def add_optimization_menu(filepath, is_active=False):
    """ファイルのサイドバーに自動最適化提案メニューを追加"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # クリエイティブ分析の後に自動最適化提案を追加
        pattern = r'(<a href="/creative-performance"[^>]*>.*?クリエイティブ分析</a>)'
        
        active_class = ' active' if is_active else ''
        replacement = r'\1\n                <a href="/auto-optimization" class="nav-item' + active_class + '">🤖 自動最適化提案</a>'
        
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
        
        # ファイルに書き戻す
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Updated: {os.path.basename(filepath)}")
        return True
    except Exception as e:
        print(f"❌ Error updating {os.path.basename(filepath)}: {e}")
        return False

# 処理対象のビューファイル
views_dir = '/Users/komiyakouhei/Desktop/meta-ads-dashboard-main 55/views'
view_files = [
    ('dashboard.ejs', False),
    ('campaigns.ejs', False),
    ('ad-performance.ejs', False),
    ('audience-analysis.ejs', False),
    ('creative-performance.ejs', False),
    ('auto-optimization.ejs', True),  # このページではアクティブ
    ('budget-scheduling.ejs', False),
    ('alerts.ejs', False),
    ('alert-history.ejs', False),
    ('improvement-tasks.ejs', False),
    ('improvement-strategies.ejs', False),
    ('settings.ejs', False)
]

success_count = 0
for filename, is_active in view_files:
    filepath = os.path.join(views_dir, filename)
    if os.path.exists(filepath):
        if add_optimization_menu(filepath, is_active):
            success_count += 1
    else:
        print(f"⚠️ Not found: {filename}")

print(f"\n✅ 自動最適化提案メニューを{success_count}ファイルに追加しました")