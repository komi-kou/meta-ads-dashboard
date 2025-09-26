#!/bin/bash

# カラー出力用
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Meta広告ダッシュボード - ページ表示テスト開始${NC}"
echo "=================================="

# セッションクッキーを保存するファイル
COOKIE_JAR="/tmp/meta-ads-cookies.txt"

# ログイン
echo -e "\n${YELLOW}1. ログイン処理${NC}"
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
  -X POST "http://localhost:3000/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "email=komiya11122@gmail.com&password=kmykuhi1215K&rememberMe=on" \
  -w "\n%{http_code}" \
  -L)

HTTP_CODE=$(echo "$LOGIN_RESPONSE" | tail -n 1)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ ログイン成功${NC}"
else
    echo -e "${RED}❌ ログイン失敗 (HTTP $HTTP_CODE)${NC}"
    exit 1
fi

sleep 1

# テストするページのリスト
PAGES=(
    "/alerts:アラート内容"
    "/alert-history:アラート履歴"
    "/improvement-tasks:確認事項"
    "/improvement-strategies:改善施策"
)

echo -e "\n${YELLOW}2. 各ページの表示確認${NC}"
echo "=================================="

for PAGE_INFO in "${PAGES[@]}"; do
    PAGE=$(echo $PAGE_INFO | cut -d: -f1)
    NAME=$(echo $PAGE_INFO | cut -d: -f2)
    
    echo -e "\n${YELLOW}テスト: $NAME ($PAGE)${NC}"
    
    # ページ取得
    RESPONSE=$(curl -s -b "$COOKIE_JAR" "http://localhost:3000$PAGE")
    
    # 重要な要素の確認
    if echo "$RESPONSE" | grep -q "ログイン"; then
        echo -e "${RED}❌ 認証エラー: ログインページにリダイレクトされました${NC}"
        continue
    fi
    
    # ページタイトル確認
    if echo "$RESPONSE" | grep -q "$NAME"; then
        echo -e "${GREEN}✅ ページタイトル確認${NC}"
    else
        echo -e "${RED}❌ ページタイトルが見つかりません${NC}"
    fi
    
    # 空のコンテンツメッセージの確認
    if echo "$RESPONSE" | grep -q "データがありません\|アラートはありません\|確認が必要な項目はありません\|改善施策はありません"; then
        echo -e "${RED}❌ 空のコンテンツメッセージが表示されています${NC}"
        
        # サンプルデータの確認
        if echo "$RESPONSE" | grep -q "CPA\|CTR\|ROAS\|予算"; then
            echo -e "${GREEN}✅ しかし、サンプルデータは存在します${NC}"
        fi
    else
        echo -e "${GREEN}✅ コンテンツが表示されています${NC}"
    fi
    
    # 特定のコンテンツ確認
    case "$PAGE" in
        "/alerts")
            if echo "$RESPONSE" | grep -q "severity\|metric\|message"; then
                echo -e "${GREEN}✅ アラートデータ構造確認${NC}"
            fi
            ;;
        "/alert-history")
            if echo "$RESPONSE" | grep -q "過去\|履歴"; then
                echo -e "${GREEN}✅ 履歴関連の要素確認${NC}"
            fi
            ;;
        "/improvement-tasks")
            if echo "$RESPONSE" | grep -q "確認\|priority\|description"; then
                echo -e "${GREEN}✅ 確認事項の要素確認${NC}"
            fi
            ;;
        "/improvement-strategies")
            if echo "$RESPONSE" | grep -q "改善\|施策\|最適化"; then
                echo -e "${GREEN}✅ 改善施策の要素確認${NC}"
            fi
            ;;
    esac
done

# クッキーファイルをクリーンアップ
rm -f "$COOKIE_JAR"

echo -e "\n${YELLOW}=================================="
echo -e "テスト完了${NC}"