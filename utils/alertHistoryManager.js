const fs = require('fs');
const path = require('path');

class AlertHistoryManager {
  constructor() {
    this.historyFile = path.join(__dirname, '../data/alert_history.json');
    this.ensureDataDirectory();
  }

  // データディレクトリの存在確認と作成
  ensureDataDirectory() {
    const dataDir = path.dirname(this.historyFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
  }

  // アラート履歴を追加
  addAlertToHistory(alert) {
    const history = this.getAlertHistory();
    const newAlert = {
      id: Date.now(),
      metric: alert.metric,
      message: alert.message,
      level: alert.level,
      timestamp: new Date().toISOString(),
      status: 'active'
    };
    
    history.unshift(newAlert); // 最新を先頭に
    
    // 過去30日分のみ保持
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filteredHistory = history.filter(item => 
      new Date(item.timestamp) > thirtyDaysAgo
    );
    
    this.saveAlertHistory(filteredHistory);
    return newAlert;
  }

  // アラート履歴を取得
  getAlertHistory() {
    try {
      if (!fs.existsSync(this.historyFile)) {
        return [];
      }
      const data = fs.readFileSync(this.historyFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('アラート履歴の取得エラー:', error);
      return [];
    }
  }

  // アラート履歴を保存
  saveAlertHistory(history) {
    try {
      fs.writeFileSync(this.historyFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.error('アラート履歴の保存エラー:', error);
    }
  }

  // 過去指定日数間の履歴をフィルター
  getHistoryByDateRange(days = 30) {
    const history = this.getAlertHistory();
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    
    return history.filter(item => 
      new Date(item.timestamp) > targetDate
    );
  }

  // アラート履歴をクリア
  clearHistory() {
    this.saveAlertHistory([]);
  }
}

module.exports = new AlertHistoryManager(); 