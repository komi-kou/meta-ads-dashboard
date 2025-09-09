// Google Sheets連携機能
// const { google } = require('googleapis'); // Google API認証が必要な場合のみ
const fs = require('fs');
const path = require('path');

class GoogleSheetsManager {
    constructor() {
        this.sheets = null;
        this.auth = null;
    }

    // 認証初期化
    async initialize(credentials, token) {
        try {
            const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
            const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
            
            oAuth2Client.setCredentials(token);
            this.auth = oAuth2Client;
            this.sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
            
            return true;
        } catch (error) {
            console.error('Google Sheets認証エラー:', error);
            return false;
        }
    }

    // スプレッドシート作成
    async createSpreadsheet(title = 'Meta広告レポート') {
        try {
            const resource = {
                properties: {
                    title: `${title}_${new Date().toISOString().split('T')[0]}`
                }
            };
            
            const spreadsheet = await this.sheets.spreadsheets.create({
                resource,
                fields: 'spreadsheetId,spreadsheetUrl'
            });
            
            return {
                spreadsheetId: spreadsheet.data.spreadsheetId,
                spreadsheetUrl: spreadsheet.data.spreadsheetUrl
            };
        } catch (error) {
            console.error('スプレッドシート作成エラー:', error);
            throw error;
        }
    }

    // データ書き込み
    async writeData(spreadsheetId, range, values) {
        try {
            const resource = {
                values
            };
            
            const result = await this.sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource
            });
            
            return result.data;
        } catch (error) {
            console.error('データ書き込みエラー:', error);
            throw error;
        }
    }

    // キャンペーンデータをスプレッドシートに出力
    async exportCampaignData(campaigns, dashboardData) {
        try {
            // 新しいスプレッドシートを作成
            const { spreadsheetId, spreadsheetUrl } = await this.createSpreadsheet('Meta広告キャンペーンレポート');
            
            // ヘッダー行
            const headers = [
                ['Meta広告レポート', '', '', '', '', '', '', ''],
                ['作成日時', new Date().toLocaleString('ja-JP'), '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['サマリー', '', '', '', '', '', '', ''],
                ['期間', '過去7日間', '', '', '', '', '', ''],
                ['総広告費', `${dashboardData.spend.toLocaleString()}円`, '', '', '', '', '', ''],
                ['CTR', `${dashboardData.ctr}%`, '', '', '', '', '', ''],
                ['CPM', `${dashboardData.cpm.toLocaleString()}円`, '', '', '', '', '', ''],
                ['CPA', dashboardData.cpa ? `${dashboardData.cpa.toLocaleString()}円` : '計算不可', '', '', '', '', '', ''],
                ['', '', '', '', '', '', '', ''],
                ['キャンペーン一覧', '', '', '', '', '', '', ''],
                ['ID', '名前', 'ステータス', '目的', '作成日', '更新日', '', '']
            ];
            
            // キャンペーンデータ
            const campaignRows = campaigns.map(c => [
                c.id,
                c.name,
                c.status,
                c.objective,
                c.created_time,
                c.updated_time,
                '',
                ''
            ]);
            
            const allData = [...headers, ...campaignRows];
            
            // データを書き込み
            await this.writeData(spreadsheetId, 'A1', allData);
            
            // フォーマット設定
            await this.formatSpreadsheet(spreadsheetId);
            
            return {
                success: true,
                spreadsheetUrl,
                spreadsheetId
            };
        } catch (error) {
            console.error('キャンペーンデータエクスポートエラー:', error);
            throw error;
        }
    }

    // スプレッドシートのフォーマット設定
    async formatSpreadsheet(spreadsheetId) {
        try {
            const requests = [
                // タイトル行の書式設定
                {
                    repeatCell: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 0,
                            endRowIndex: 1,
                            startColumnIndex: 0,
                            endColumnIndex: 8
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.2, green: 0.3, blue: 0.6 },
                                textFormat: {
                                    foregroundColor: { red: 1, green: 1, blue: 1 },
                                    fontSize: 14,
                                    bold: true
                                }
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat)'
                    }
                },
                // ヘッダー行の書式設定
                {
                    repeatCell: {
                        range: {
                            sheetId: 0,
                            startRowIndex: 11,
                            endRowIndex: 12,
                            startColumnIndex: 0,
                            endColumnIndex: 8
                        },
                        cell: {
                            userEnteredFormat: {
                                backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 },
                                textFormat: {
                                    bold: true
                                }
                            }
                        },
                        fields: 'userEnteredFormat(backgroundColor,textFormat)'
                    }
                },
                // 列幅の自動調整
                {
                    autoResizeDimensions: {
                        dimensions: {
                            sheetId: 0,
                            dimension: 'COLUMNS',
                            startIndex: 0,
                            endIndex: 8
                        }
                    }
                }
            ];

            await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: { requests }
            });

            return true;
        } catch (error) {
            console.error('フォーマット設定エラー:', error);
            return false;
        }
    }
}

// シンプルなCSVエクスポート機能（Google認証不要）
function exportToCSV(campaigns, dashboardData, period = 'last_7d') {
    const csvRows = [];
    
    console.log('=== exportToCSV デバッグ ===');
    console.log('period:', period);
    console.log('dashboardData.chartData:', dashboardData.chartData ? 'あり' : 'なし');
    if (dashboardData.chartData) {
        console.log('chartData.labels:', dashboardData.chartData.labels);
        console.log('labels数:', dashboardData.chartData.labels ? dashboardData.chartData.labels.length : 0);
    }
    
    // ヘッダー行（スクリーンショットの形式に合わせる）
    csvRows.push(['日付', 'インプレッション', '広告費', 'クリック数', 'コンバージョン数', 'インプレッション単価', 'クリック率', 'クリック単価', 'コンバージョン率', 'コンバージョン単価']);
    
    // 日付別データを生成（chartDataがある場合はそれを使用）
    if (dashboardData.chartData && dashboardData.chartData.labels) {
        const labels = dashboardData.chartData.labels;
        const spendData = dashboardData.chartData.spend || [];
        const ctrData = dashboardData.chartData.ctr || [];
        const cpmData = dashboardData.chartData.cpm || [];
        const conversionsData = dashboardData.chartData.conversions || [];
        const cpaData = dashboardData.chartData.cpa || [];
        
        labels.forEach((date, index) => {
            const spend = spendData[index] || 0;
            const ctr = parseFloat(ctrData[index]) || 0;
            const cpm = cpmData[index] || 0;
            const conversions = conversionsData[index] || 0;
            const cpa = cpaData[index] || null;
            
            // インプレッションとクリック数を逆算
            const impressions = cpm > 0 ? Math.round((spend / cpm) * 1000) : 0;
            const clicks = impressions > 0 ? Math.round(impressions * ctr / 100) : 0;
            const cpc = clicks > 0 ? Math.round(spend / clicks) : 0;
            const cvr = clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) : '0.00';
            
            csvRows.push([
                date,
                impressions.toLocaleString(),
                `¥${spend.toLocaleString()}`,
                clicks.toString(),
                conversions.toString(),  // 明示的に文字列に変換
                cpm.toLocaleString(),
                `${ctr.toFixed(2)}%`,
                cpc > 0 ? `¥${cpc.toLocaleString()}` : '¥0',
                `${cvr}%`,
                conversions > 0 && cpa ? `¥${Math.round(cpa).toLocaleString()}` : '0'
            ]);
        });
    } else {
        // chartDataがない場合は期間に応じた日数分のダミーデータを生成
        const days = period === 'today' ? 1 : 
                    period === 'yesterday' ? 1 :
                    period === 'last_3d' ? 3 :
                    period === 'last_14d' ? 14 :
                    period === 'last_30d' ? 30 : 7;
        
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i - 1));
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            
            // 総計から日割り計算
            const dailySpend = Math.round((dashboardData.spend || 0) / days);
            const dailyImpressions = Math.round((dashboardData.impressions || 1000) / days);
            const dailyClicks = Math.round((dashboardData.clicks || 10) / days);
            const dailyConversions = Math.round((dashboardData.conversions || 0) / days);
            
            const dailyCtr = dailyImpressions > 0 ? ((dailyClicks / dailyImpressions) * 100).toFixed(2) : '0.00';
            const dailyCpm = dailyImpressions > 0 ? Math.round((dailySpend / dailyImpressions) * 1000) : 0;
            const dailyCpc = dailyClicks > 0 ? Math.round(dailySpend / dailyClicks) : 0;
            const dailyCvr = dailyClicks > 0 ? ((dailyConversions / dailyClicks) * 100).toFixed(2) : '0.00';
            const dailyCpa = dailyConversions > 0 ? Math.round(dailySpend / dailyConversions) : null;
            
            csvRows.push([
                dateStr,
                dailyImpressions.toLocaleString(),
                `¥${dailySpend.toLocaleString()}`,
                dailyClicks.toString(),
                dailyConversions.toString(),  // 明示的に文字列に変換
                dailyCpm.toLocaleString(),
                `${dailyCtr}%`,
                `¥${dailyCpc.toLocaleString()}`,
                `${dailyCvr}%`,
                dailyConversions > 0 && dailyCpa ? `¥${dailyCpa.toLocaleString()}` : '0'
            ]);
        }
    }
    
    // CSV文字列に変換
    const csvContent = csvRows.map(row => 
        row.map(cell => {
            // セル内の値に改行やカンマが含まれる場合の処理
            const cellStr = String(cell || '');
            if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
            }
            return cellStr;
        }).join(',')
    ).join('\n');
    
    // BOM付きUTF-8として返す
    return '\uFEFF' + csvContent;
}

module.exports = {
    GoogleSheetsManager,
    exportToCSV
};