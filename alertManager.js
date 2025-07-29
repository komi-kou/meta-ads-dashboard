// alertManager.js - アラート判定とデータ管理
const alertRules = require('./alertRules');
const fs = require('fs');
const path = require('path');

class AlertManager {
  constructor() {
    this.currentGoal = this.loadGoalFromConfig(); // 設定ファイルから読み込み
    this.alertHistory = [];
  }

  // 設定ファイルからゴールタイプを読み込み
  loadGoalFromConfig() {
    try {
      // 優先順位1: ユーザー設定ファイルから読み込み
      const userSettingsPath = path.join(__dirname, 'data', 'user_settings.json');
      if (fs.existsSync(userSettingsPath)) {
        const userSettings = JSON.parse(fs.readFileSync(userSettingsPath, 'utf8'));
        if (Array.isArray(userSettings) && userSettings.length > 0) {
          // 最新のユーザー設定を使用
          const latestUserSetting = userSettings[userSettings.length - 1];
          if (latestUserSetting.service_goal || latestUserSetting.goal_type) {
            const goalType = latestUserSetting.service_goal || latestUserSetting.goal_type;
            console.log('✅ ゴールタイプ読み込み成功 (ユーザー設定):', goalType);
            return goalType;
          }
        }
      }

      // 優先順位2: setup.jsonから読み込み
      const setupPath = path.join(__dirname, 'config', 'setup.json');
      if (fs.existsSync(setupPath)) {
        const setupData = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
        if (setupData.goal && setupData.goal.type) {
          console.log('✅ ゴールタイプ読み込み成功 (setup.json):', setupData.goal.type);
          return setupData.goal.type;
        }
      }

      // 優先順位3: settings.jsonから読み込み
      const settingsPath = path.join(__dirname, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settingsData.goal && settingsData.goal.type) {
          console.log('✅ ゴールタイプ読み込み成功 (settings.json):', settingsData.goal.type);
          return settingsData.goal.type;
        }
      }

      console.log('⚠️ ゴールタイプが見つかりません。デフォルト値を使用: toC_newsletter');
      return 'toC_newsletter'; // デフォルト値
    } catch (error) {
      console.error('❌ ゴールタイプ読み込みエラー:', error.message);
      return 'toC_newsletter'; // エラー時のデフォルト値
    }
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
    const goalData = alertRules.goals[this.currentGoal];
    return {
      key: this.currentGoal,
      name: goalData?.name || this.currentGoal,
      ...goalData
    };
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