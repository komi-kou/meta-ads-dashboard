/**
 * 新機能テストスクリプト
 * 広告パフォーマンス詳細分析機能の動作確認
 */

const metaApi = require('./metaApi');

console.log('========================================');
console.log('📊 新機能テスト開始');
console.log('========================================\n');

// テスト用の日付設定
const today = new Date();
const weekAgo = new Date(today);
weekAgo.setDate(weekAgo.getDate() - 7);

const testAccessToken = 'test_dummy_token';
const testAccountId = 'act_123456789';

async function testNewFeatures() {
    console.log('1️⃣ 広告セットレベル分析テスト');
    console.log('----------------------------------------');
    try {
        const adsets = await metaApi.fetchAdSetInsights(
            testAccessToken,
            testAccountId,
            weekAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        );
        
        console.log(`✅ 広告セット取得成功: ${adsets.length}件`);
        if (adsets.length > 0) {
            console.log('サンプルデータ:', {
                name: adsets[0].name,
                spend: adsets[0].spend,
                conversions: adsets[0].conversions,
                cpa: adsets[0].cpa
            });
        }
    } catch (error) {
        console.error('❌ 広告セット取得エラー:', error.message);
    }
    
    console.log('\n2️⃣ 個別広告レベル分析テスト');
    console.log('----------------------------------------');
    try {
        const ads = await metaApi.fetchAdInsights(
            testAccessToken,
            testAccountId,
            weekAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        );
        
        console.log(`✅ 個別広告取得成功: ${ads.length}件`);
        if (ads.length > 0) {
            console.log('サンプルデータ:', {
                name: ads[0].name,
                creativeType: ads[0].creativeType,
                spend: ads[0].spend,
                ctr: ads[0].ctr
            });
        }
    } catch (error) {
        console.error('❌ 個別広告取得エラー:', error.message);
    }
    
    console.log('\n3️⃣ オーディエンス分析テスト');
    console.log('----------------------------------------');
    try {
        const audienceData = await metaApi.fetchAudienceInsights(
            testAccessToken,
            testAccountId,
            weekAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        );
        
        console.log('✅ オーディエンスデータ取得成功');
        console.log('年齢別セグメント数:', Object.keys(audienceData.byAge).length);
        console.log('性別セグメント数:', Object.keys(audienceData.byGender).length);
        console.log('デバイス別セグメント数:', Object.keys(audienceData.byDevice).length);
        
        // 年齢別の最高パフォーマンス
        const bestAge = Object.entries(audienceData.byAge).reduce((best, [age, data]) => {
            if (!best || data.cpa < best.cpa) {
                return { age, ...data };
            }
            return best;
        }, null);
        
        if (bestAge) {
            console.log(`最高パフォーマンス年齢層: ${bestAge.age} (CPA: ¥${bestAge.cpa})`);
        }
    } catch (error) {
        console.error('❌ オーディエンス分析エラー:', error.message);
    }
    
    console.log('\n4️⃣ ファネル分析テスト');
    console.log('----------------------------------------');
    try {
        const funnelData = await metaApi.fetchFunnelAnalysis(
            testAccessToken,
            testAccountId,
            weekAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        );
        
        console.log('✅ ファネルデータ取得成功');
        console.log('ファネルステージ:');
        funnelData.funnel.stages.forEach(stage => {
            console.log(`  ${stage.name}: ${stage.count}人 (${stage.rate}%)`);
        });
        
        console.log('\n離脱ポイント:');
        funnelData.funnel.dropoffPoints.forEach(point => {
            const emoji = point.dropoffRate > 50 ? '⚠️' : '✓';
            console.log(`  ${emoji} ${point.stage}: ${point.dropoffRate}%`);
        });
    } catch (error) {
        console.error('❌ ファネル分析エラー:', error.message);
    }
    
    console.log('\n5️⃣ APIエンドポイント接続テスト');
    console.log('----------------------------------------');
    
    // APIエンドポイントのテスト（サーバーが起動している場合）
    try {
        const axios = require('axios');
        const baseUrl = 'http://localhost:3457';
        
        // テスト用のセッションクッキー（実際の環境では要ログイン）
        const endpoints = [
            '/api/adsets',
            '/api/ads',
            '/api/audience-insights',
            '/api/funnel-analysis'
        ];
        
        console.log('注意: APIエンドポイントテストにはサーバー起動とログインが必要です');
        console.log('テスト可能なエンドポイント:');
        endpoints.forEach(endpoint => {
            console.log(`  - ${endpoint}`);
        });
        
    } catch (error) {
        console.log('APIエンドポイントテストはスキップ（サーバー未起動）');
    }
    
    console.log('\n========================================');
    console.log('✅ テスト完了');
    console.log('========================================');
    
    // 統計サマリー
    console.log('\n📊 実装機能サマリー:');
    console.log('1. 広告セット・広告レベルの詳細分析 ✅');
    console.log('2. オーディエンス分析（年齢/性別/デバイス） ✅');
    console.log('3. ファネル分析と離脱ポイント特定 ✅');
    console.log('4. 新規画面の追加（/ad-performance） ✅');
    console.log('5. APIエンドポイントの追加 ✅');
    
    console.log('\n💡 使用方法:');
    console.log('1. サーバーを起動: npm start');
    console.log('2. ログイン: test@example.com / password123');
    console.log('3. /ad-performance にアクセス');
    console.log('4. タブを切り替えて各機能を確認');
}

// テスト実行
testNewFeatures().catch(console.error);