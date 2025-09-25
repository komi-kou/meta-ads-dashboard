#!/bin/bash
# すべての.ejsファイルから設定のサイドバー項目を削除

for file in views/*.ejs; do
    # 設定のサイドバー項目を削除（改行も含めて）
    sed -i '' '/<a href="\/settings"[^>]*>.*設定.*<\/a>/d' "$file"
done

echo "設定項目を削除しました"