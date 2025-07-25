// alertManager.js - アラート判定とデータ管理
const alertRules = require('./alertRules');

class AlertManager {
  constructor() {
    this.currentGoal = 'toC_newsletter'; // デフォルトゴール
    this.alertHistory = [];
  }
  
  // 現在のゴール設定
  setGoal(goalType) {
    if (alertRules.goals[goalType]) {
      this.currentGoal = goalType;
      return true;
    }
    return false;
  }
  
  // アラート判定（複数日のデータが必要）
  checkAlerts(recentData) {
    const alerts = [];
    const rules = alertRules.goals[this.currentGoal].rules;
    
    Object.keys(rules).forEach(metric => {
      const rule = rules[metric];
      const alert = this.evaluateRule(metric, rule, recentData);
      if (alert) {
        alerts.push(alert);
      }
    });
    
    return alerts;
  }
  
  // 個別ルールの評価
  evaluateRule(metric, rule, recentData) {
    const requiredDays = rule.days;
    const threshold = rule.threshold;
    const condition = rule.condition;
    
    // 必要な日数分のデータがあるかチェック
    if (recentData.length < requiredDays) {
      return null;
    }
    
    const relevantData = recentData.slice(-requiredDays);
    let isAlert = false;
    
    switch (condition) {
      case 'below':
        isAlert = relevantData.every(day => day[metric] < threshold);
        break;
      case 'above':
        isAlert = relevantData.every(day => day[metric] > threshold);
        break;
      case 'equal':
        isAlert = relevantData.every(day => day[metric] === threshold);
        break;
    }
    
    if (isAlert) {
      return {
        type: 'alert',
        metric: metric,
        message: this.generateAlertMessage(metric, rule, relevantData),
        severity: this.getSeverity(metric),
        checkItems: alertRules.checkItems[metric] || [],
        improvements: alertRules.improvements[metric] || [],
        data: relevantData,
        timestamp: new Date().toISOString()
      };
    }
    
    return null;
  }
  
  // アラートメッセージ生成
  generateAlertMessage(metric, rule, data) {
    const metricNames = {
      budgetRate: '予算消化率',
      ctr: 'CTR',
      cv: 'CV',
      cpa: 'CPA'
    };
    
    const conditions = {
      below: '以下',
      above: '以上',
      equal: 'が0'
    };
    
    const metricName = metricNames[metric] || metric;
    const conditionText = conditions[rule.condition] || rule.condition;
    
    if (rule.condition === 'equal' && rule.threshold === 0) {
      return `${metricName}が${rule.days}日間連続で0になっています`;
    }
    
    return `${metricName}が${rule.days}日間連続で${rule.threshold}${conditionText}になっています`;
  }
  
  // アラートの重要度判定
  getSeverity(metric) {
    const severityMap = {
      cv: 'high',
      budgetRate: 'medium',
      ctr: 'medium',
      cpa: 'high'
    };
    return severityMap[metric] || 'low';
  }
  
  // 現在のゴール情報取得
  getCurrentGoal() {
    return alertRules.goals[this.currentGoal];
  }
  
  // 全ゴール一覧取得
  getAllGoals() {
    return Object.keys(alertRules.goals).map(key => ({
      key,
      name: alertRules.goals[key].name
    }));
  }
}

module.exports = AlertManager; 