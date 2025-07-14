const fs = require('fs');
const path = require('path');

class ScheduledChatworkSender {
  constructor() {
    this.scheduledTime = { hour: 9, minute: 0 }; // 朝9時
    this.isScheduled = false;
    this.settingsFile = path.join(__dirname, '../settings.json');
  }

  // スケジュール開始
  startSchedule() {
    if (this.isScheduled) return;
    
    this.isScheduled = true;
    this.scheduleNextSend();
    console.log('🕐 自動チャットワーク送信スケジュールを開始しました');
  }

  // 次回送信のスケジュール
  scheduleNextSend() {
    const now = new Date();
    const nextSend = new Date();
    
    nextSend.setHours(this.scheduledTime.hour, this.scheduledTime.minute, 0, 0);
    
    // 今日の9時を過ぎている場合は明日に設定
    if (nextSend <= now) {
      nextSend.setDate(nextSend.getDate() + 1);
    }
    
    const timeUntilSend = nextSend.getTime() - now.getTime();
    
    setTimeout(() => {
      this.sendDailyReport();
      this.scheduleNextSend(); // 次回分をスケジュール
    }, timeUntilSend);
    
    console.log(`📅 次回チャットワーク送信予定: ${nextSend.toLocaleString('ja-JP')}`);
  }

  // 設定を読み込み
  loadSettings() {
    try {
      if (fs.existsSync(this.settingsFile)) {
        const data = fs.readFileSync(this.settingsFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('設定ファイル読み込みエラー:', error);
    }
    return null;
  }

  // アクティブなアラートを取得
  getActiveAlerts() {
    try {
      const alertHistoryFile = path.join(__dirname, '../data/alert_history.json');
      if (fs.existsSync(alertHistoryFile)) {
        const data = fs.readFileSync(alertHistoryFile, 'utf8');
        const history = JSON.parse(data);
        return history.filter(alert => alert.status === 'active');
      }
    } catch (error) {
      console.error('アラート履歴読み込みエラー:', error);
    }
    return [];
  }

  // 確認事項ルールを読み込み
  loadChecklistRules() {
    try {
      const checklistRulesFile = path.join(__dirname, 'checklistRules.js');
      if (fs.existsSync(checklistRulesFile)) {
        delete require.cache[require.resolve('./checklistRules')];
        return require('./checklistRules');
      }
    } catch (error) {
      console.error('確認事項ルール読み込みエラー:', error);
    }
    return {};
  }

  // 改善施策ルールを読み込み
  loadImprovementStrategiesRules() {
    try {
      const strategiesRulesFile = path.join(__dirname, 'improvementStrategiesRules.js');
      if (fs.existsSync(strategiesRulesFile)) {
        delete require.cache[require.resolve('./improvementStrategiesRules')];
        return require('./improvementStrategiesRules');
      }
    } catch (error) {
      console.error('改善施策ルール読み込みエラー:', error);
    }
    return {};
  }

  // 日次レポート送信
  async sendDailyReport() {
    try {
      const alerts = this.getActiveAlerts();
      
      // アラートがない場合は送信しない
      if (alerts.length === 0) {
        console.log('✅ アクティブなアラートがないため、レポート送信をスキップしました');
        return;
      }

      const message = this.formatDailyReportMessage(alerts);
      await this.sendToChatwork(message);
      
      console.log('📤 日次レポートを送信しました:', new Date().toLocaleString('ja-JP'));
    } catch (error) {
      console.error('❌ 日次レポート送信エラー:', error);
    }
  }

  // メッセージフォーマット
  formatDailyReportMessage(alerts) {
    let message = '[info][title]Meta広告 日次レポート[/title]';
    message += `\n送信日時: ${new Date().toLocaleString('ja-JP')}\n`;
    
    // アラート内容
    message += '\n【🚨 アラート内容】\n';
    alerts.forEach(alert => {
      message += `• ${alert.metric}: ${alert.message}\n`;
    });
    
    // 確認事項と改善施策
    const checklistRules = this.loadChecklistRules();
    const improvementStrategiesRules = this.loadImprovementStrategiesRules();
    
    message += '\n【📋 確認事項 & 🔧 改善施策】\n';
    
    alerts.forEach(alert => {
      const metric = alert.metric;
      const checklistItems = checklistRules[metric]?.items || [];
      const strategiesForMetric = improvementStrategiesRules[metric] || {};
      
      if (checklistItems.length > 0) {
        message += `\n■ ${metric}\n`;
        
        checklistItems.forEach(checklistItem => {
          const strategiesForItem = strategiesForMetric[checklistItem.title] || [];
          
          if (strategiesForItem.length > 0) {
            message += `\n▼確認事項\n`;
            message += `${checklistItem.priority}. ${checklistItem.title}\n`;
            if (checklistItem.description) {
              message += `→${checklistItem.description.replace(/\n/g, '\n→')}\n`;
            }
            
            message += `\n▼改善施策\n`;
            strategiesForItem.forEach((action, index) => {
              message += `${index + 1}. ${action}\n`;
            });
          }
        });
      }
    });
    
    message += '\n[/info]';
    return message;
  }

  // チャットワーク送信
  async sendToChatwork(message) {
    try {
      const settings = this.loadSettings();
      if (!settings || !settings.chatwork || !settings.chatwork.apiToken || !settings.chatwork.roomId) {
        console.error('❌ チャットワーク設定が不完全です');
        return;
      }

      const chatworkApi = require('./chatworkApi');
      const result = await chatworkApi.sendMessage(settings.chatwork.roomId, message);
      
      if (result.success) {
        console.log('✅ チャットワーク送信成功');
      } else {
        console.error('❌ チャットワーク送信失敗:', result.error);
      }
    } catch (error) {
      console.error('❌ チャットワーク送信エラー:', error);
    }
  }

  // スケジュール停止
  stopSchedule() {
    this.isScheduled = false;
    console.log('🛑 自動チャットワーク送信スケジュールを停止しました');
  }
}

module.exports = new ScheduledChatworkSender(); 