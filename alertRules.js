// alertRules.js - アラート定義とルール
const alertRules = {
  // ゴール別アラート設定
  goals: {
    'toC_newsletter': {
      name: 'toC（メルマガ登録）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 2.5, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 2, condition: 'equal' },
        cpa: { threshold: 2000, days: 3, condition: 'above' }
      }
    },
    'toC_line': {
      name: 'toC（LINE登録）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 2.5, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 2, condition: 'equal' },
        cpa: { threshold: 1000, days: 3, condition: 'above' }
      }
    },
    'toB_newsletter': {
      name: 'toB（メルマガ登録）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        dailyBudget: { threshold: 1000, days: 1, condition: 'above' },
        ctr: { threshold: 1.5, days: 3, condition: 'below' },
        cpm: { threshold: 6000, days: 3, condition: 'above' },
        cv: { threshold: 0, days: 3, condition: 'equal' },
        cpa: { threshold: 15000, days: 3, condition: 'above' }
      }
    },
    'toC_phone': {
      name: 'toC（電話ボタン）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 2.0, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 2, condition: 'equal' },
        cpa: { threshold: 3000, days: 3, condition: 'above' }
      }
    },
    'toC_purchase': {
      name: 'toC（購入）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 1.8, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 2, condition: 'equal' },
        cpa: { threshold: 5000, days: 3, condition: 'above' }
      }
    },
    'toB_line': {
      name: 'toB（LINE登録）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 1.5, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 3, condition: 'equal' },
        cpa: { threshold: 12000, days: 3, condition: 'above' }
      }
    },
    'toB_phone': {
      name: 'toB（電話ボタン）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 1.2, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 3, condition: 'equal' },
        cpa: { threshold: 20000, days: 3, condition: 'above' }
      }
    },
    'toB_purchase': {
      name: 'toB（購入）',
      rules: {
        budgetRate: { threshold: 80, days: 3, condition: 'below' },
        ctr: { threshold: 1.0, days: 3, condition: 'below' },
        cv: { threshold: 0, days: 3, condition: 'equal' },
        cpa: { threshold: 30000, days: 3, condition: 'above' }
      }
    }
  },
  
  // 確認事項の定義
  checkItems: {
    budgetRate: [
      '配信状況の確認（配信は正常に動いているか？）',
      'クリエイティブの確認（適切なクリエイティブが配信されているか？）',
      'ユーザー層の確認（想定しているユーザー層に配信されているか？）'
    ],
    dailyBudget: [
      '予算設定の確認（適切な日予算が設定されているか？）',
      '配信ペースの確認（予算が早期消化されていないか？）',
      '競合状況の確認（入札競争が激しくなっていないか？）'
    ],
    ctr: [
      'クリエイティブの確認（魅力的で関心を引くクリエイティブか？）',
      'フリークエンシーの確認（同じユーザーに何回配信されているか？）',
      'ターゲティングの確認（適切なユーザーに配信されているか？）'
    ],
    cpm: [
      'ターゲティングの確認（CPMの高いセグメントに配信していないか？）',
      'クリエイティブの確認（魅力的で関連性の高いクリエイティブか？）',
      '配信時間の確認（効率の良い時間帯に配信されているか？）'
    ],
    cv: [
      'クリエイティブの確認（コンバージョンを促すクリエイティブか？）',
      'ターゲティングの確認（CVしやすいユーザーに配信されているか？）',
      'LP（ランディングページ）の確認（CVしやすいページになっているか？）'
    ],
    cpa: [
      'クリエイティブの確認（効果的なクリエイティブか？）',
      'ターゲティングの確認（CPAの良いユーザー層に配信されているか？）',
      'LP（ランディングページ）の確認（CVRは適切か？）'
    ]
  },
  
  // 改善施策の定義
  improvements: {
    budgetRate: [
      'クリエイティブの改善・追加',
      'ターゲティングの見直し・拡張',
      '配信時間の調整',
      '予算配分の見直し'
    ],
    dailyBudget: [
      '予算配分の最適化',
      '配信スケジュールの調整',
      '入札戦略の見直し',
      'ターゲティングの精度向上'
    ],
    ctr: [
      '新しいクリエイティブの作成・テスト',
      'ターゲティングの精度向上',
      'フリークエンシーキャップの調整',
      'クリエイティブローテーションの実装'
    ],
    cpm: [
      'ターゲティングの最適化',
      'クリエイティブの改善',
      '配信時間の調整',
      '入札額の見直し'
    ],
    cv: [
      'CVに特化したクリエイティブの作成',
      'リターゲティング施策の強化',
      'LPの改善・A/Bテスト',
      'カスタマージャーニーの見直し'
    ],
    cpa: [
      '高CVRクリエイティブの作成',
      'ターゲティング精度の向上',
      'LPのCVR改善',
      '自動入札戦略の見直し'
    ]
  }
};

module.exports = alertRules; 