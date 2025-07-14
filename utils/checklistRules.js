const checklistRules = {
  '予算消化率': {
    title: '予算消化率の確認事項',
    items: [
      {
        priority: 1,
        title: '配信されているか確認',
        description: '広告がアクティブになっているか'
      },
      {
        priority: 2,
        title: '配信するクリエイティブが枯れている',
        description: 'CV数が0もしくは目標CPAの到達しておらず予算も消化されていない'
      },
      {
        priority: 3,
        title: '配信するユーザー層が悪いのか',
        description: '配信するユーザー層が悪いと表示されないケースがある'
      }
    ]
  },
  'CTR': {
    title: 'CTRの確認事項',
    items: [
      {
        priority: 1,
        title: '配信しているクリエイティブが刺さっていないor枯れている',
        description: 'ありきたりのクリエイティブでユーザーに見られていない\n7日間ベースでずっと配信していて、飽きられている'
      },
      {
        priority: 2,
        title: 'フリークエンシーが2.5%以上ある',
        description: '同じユーザーばかりに配信されていて、見飽きられている'
      },
      {
        priority: 3,
        title: '配信するユーザー層が見込み顧客ではない',
        description: 'サービスに合ったユーザー層に配信されていないので、スルーされている'
      }
    ]
  },
  'CPM': {
    title: 'CPMの確認事項',
    items: [
      {
        priority: 1,
        title: '最適なCPM値で配信できていない',
        description: 'クリエイティブが刺さっていないため入力したCPMから乖離している\n配信するユーザー層が悪いため入力したCPMから乖離している'
      }
    ]
  },
  'CV': {
    title: 'CVの確認事項',
    items: [
      {
        priority: 1,
        title: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
        description: '入口のクリエイティブで魅力的に魅せれていないor飽きられてしまっている'
      },
      {
        priority: 2,
        title: '配信するユーザー層がズレている',
        description: '購入見込みの低いユーザーに配信されている'
      },
      {
        priority: 3,
        title: 'LPで離脱されている',
        description: 'LPの内容がユーザーに刺さっていない'
      }
    ]
  },
  'CPA': {
    title: 'CPAの確認事項',
    items: [
      {
        priority: 1,
        title: 'クリエイティブが刺さっていないorクリエイティブが枯れている',
        description: ''
      },
      {
        priority: 2,
        title: '配信するユーザー層がズレている',
        description: '購入見込みの低いユーザーに配信されている'
      },
      {
        priority: 3,
        title: '学習データが適切ではない',
        description: 'ピクセルで学習しているデータが誤った方向に進んでいる'
      },
      {
        priority: 4,
        title: 'LPで離脱されている',
        description: 'LPの内容がユーザーに刺さっていない'
      }
    ]
  }
};

module.exports = { checklistRules }; 