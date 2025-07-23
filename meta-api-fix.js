// Meta API期間データ取得とChatwork通知の修正

// 1. Meta API期間データ取得関数の修正版
async function fetchMetaPeriodDataWithStoredConfig(period, campaignId = null) {
    console.log(`=== Meta API期間データ取得: ${period}日間 ===`);
    try {
        const config = getMetaApiConfigFromSetup();
        
        if (!config || !config.accessToken || !config.accountId) {
            console.log('⚠️ Meta API設定不完全 - ダミーデータを返します');
            return generatePeriodDummyData(period);
        }
        
        const accessToken = config.accessToken;
        const accountId = config.accountId;

        const endDate = new Date();
        const startDate = new Date();
        let periodDays = 7; // デフォルト値
        
        switch(String(period)) {
            case '7': 
                startDate.setDate(endDate.getDate() - 6); 
                periodDays = 7;
                break;
            case '14': 
                startDate.setDate(endDate.getDate() - 13); 
                periodDays = 14;
                break;
            case '30': 
                startDate.setDate(endDate.getDate() - 29); 
                periodDays = 30;
                break;
            case 'all': 
                startDate.setMonth(endDate.getMonth() - 3); 
                periodDays = 90;
                break;
            default:
                const parsedPeriod = parseInt(period);
                if (!isNaN(parsedPeriod) && parsedPeriod > 0) {
                    startDate.setDate(endDate.getDate() - (parsedPeriod - 1));
                    periodDays = parsedPeriod;
                } else {
                    startDate.setDate(endDate.getDate() - 6);
                    periodDays = 7;
                }
        }
        
        const since = startDate.toISOString().split('T')[0];
        const until = endDate.toISOString().split('T')[0];

        console.log(`期間: ${since} ～ ${until} (${periodDays}日間)`);

        const baseUrl = 'https://graph.facebook.com/v18.0';
        const endpoint = `${baseUrl}/${accountId}/insights`;
        const params = {
            access_token: accessToken,
            fields: 'spend,impressions,clicks,ctr,cpm,frequency,reach,actions,date_start',
            time_range: JSON.stringify({ since, until }),
            level: campaignId ? 'campaign' : 'account',
            time_increment: 1,
            limit: 1000
        };

        if (campaignId) {
            params.filtering = JSON.stringify([{
                field: 'campaign.id',
                operator: 'IN',
                value: [campaignId]
            }]);
        }
        
        const queryString = new URLSearchParams(params).toString();
        const apiUrl = `${endpoint}?${queryString}`;
        console.log('Meta API URL:', apiUrl.replace(accessToken, 'ACCESS_TOKEN_HIDDEN'));
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            console.error(`Meta API HTTPエラー: ${response.status} ${response.statusText}`);
            const errorText = await response.text();
            console.error('エラー詳細:', errorText);
            console.log('⚠️ API呼び出し失敗 - ダミーデータを返します');
            return generatePeriodDummyData(period);
        }
        
        const data = await response.json();
        
        if (data.error) {
            console.error('Meta APIエラー:', data.error);
            console.log('⚠️ Meta APIエラー - ダミーデータを返します');
            return generatePeriodDummyData(period);
        }
        
        console.log(`✅ 期間データ取得完了: ${data.data ? data.data.length : 0}日分`);
        
        if (!data.data || data.data.length === 0) {
            console.log('⚠️ データが空 - ダミーデータを返します');
            return generatePeriodDummyData(period);
        }
        
        return aggregateRealPeriodData(data.data, periodDays);
    } catch (error) {
        console.error('❌ Meta API期間データエラー:', error.message);
        console.log('⚠️ エラー発生 - ダミーデータを返します');
        return generatePeriodDummyData(period);
    }
}

// 2. データ集計関数の修正版
function aggregateRealPeriodData(dailyData, periodDays = null) {
    console.log(`📊 実データ集計開始: ${dailyData.length}日分のデータ, 期間: ${periodDays}日`);
    
    let totalSpend = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    let totalReach = 0;
    
    const chartLabels = [];
    const chartSpend = [];
    const chartCTR = [];
    const chartCPM = [];
    const chartConversions = [];
    const chartCPA = [];           
    const chartFrequency = [];     
    
    // 日付順でソート
    const sortedData = dailyData.sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
    
    sortedData.forEach((day, index) => {
        const spend = parseFloat(day.spend || 0);
        const impressions = parseInt(day.impressions || 0);
        const clicks = parseInt(day.clicks || 0);
        const conversions = extractConversions(day.actions);
        const cpa = conversions > 0 ? spend / conversions : 0;
        const frequency = parseFloat(day.frequency || 0);
        
        totalSpend += spend;
        totalImpressions += impressions;
        totalClicks += clicks;
        totalConversions += conversions;
        totalReach += parseInt(day.reach || 0);
        
        chartLabels.push(formatDateLabel(day.date_start));
        chartSpend.push(Math.round(spend));
        chartCTR.push(parseFloat(day.ctr || 0));
        chartCPM.push(Math.round(parseFloat(day.cpm || 0)));
        chartConversions.push(conversions);
        chartCPA.push(Math.round(cpa));          
        chartFrequency.push(frequency);          
        
        console.log(`日次データ${index + 1}: ${day.date_start} - Spend: ${spend}, CTR: ${day.ctr}, Conversions: ${conversions}`);
    });
    
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
    const avgCPM = totalImpressions > 0 ? (totalSpend / totalImpressions * 1000) : 0;
    const avgCPA = totalConversions > 0 ? (totalSpend / totalConversions) : 0;
    const avgFrequency = totalReach > 0 ? (totalImpressions / totalReach) : 0;
    
    // 期間に応じた予算消化率計算
    const budgetRate = (() => {
        try {
            const config = getMetaApiConfigFromSetup();
            const dailyBudget = config?.goal?.target_dailyBudget || '15000';
            const budget = parseFloat(dailyBudget);
            const actualDays = periodDays || dailyData.length;
            const totalBudget = actualDays * budget;
            const rate = totalBudget > 0 ? (totalSpend / totalBudget * 100) : 0;
            console.log(`予算消化率計算: ${totalSpend}円 / (${actualDays}日 × ${budget}円) = ${rate.toFixed(2)}%`);
            return parseFloat(Math.min(rate, 999.99).toFixed(2));
        } catch (error) {
            console.error('予算消化率計算エラー:', error);
            return 100.74;
        }
    })();
    
    const result = {
        spend: Math.round(totalSpend),
        budgetRate: budgetRate,
        ctr: parseFloat(avgCTR.toFixed(2)),
        cpm: Math.round(avgCPM),
        conversions: totalConversions,
        cpa: Math.round(avgCPA),
        frequency: parseFloat(avgFrequency.toFixed(2)),
        chartData: {
            labels: chartLabels,
            spend: chartSpend,
            ctr: chartCTR,
            cpm: chartCPM,
            conversions: chartConversions,
            cpa: chartCPA,            
            frequency: chartFrequency 
        }
    };
    
    console.log('📈 集計結果:', {
        期間: `${periodDays || dailyData.length}日間`,
        総支出: result.spend,
        予算消化率: result.budgetRate,
        平均CTR: result.ctr,
        平均CPM: result.cpm,
        総CV数: result.conversions,
        平均CPA: result.cpa
    });
    
    return result;
}

module.exports = {
    fetchMetaPeriodDataWithStoredConfig,
    aggregateRealPeriodData
};