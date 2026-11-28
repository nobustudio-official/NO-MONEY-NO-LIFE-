// =========================
// プレイヤーcontents
// =========================

const　PLAYER_CONTENTS = {

   1: {
        name: "戦士",
        graphColor: "#8B5A2B",
        icon: "images/characters/player/icons/戦士-icon.webp",
        sprite: "images/characters/player/sprites/戦士.png",
        spriteDirections: {
            down: "images/characters/player/directions/戦士_front.webp",
            up: "images/characters/player/directions/戦士_back.webp",
            left: "images/characters/player/directions/戦士_left.webp",
            right: "images/characters/player/directions/戦士_right.webp"
        }
    },
    2: {
        name: "めぐみ",
        graphColor: "#9E9E9E",
        icon: "images/characters/player/icons/めぐみ-icon.webp",
        sprite: "images/characters/player/sprites/めぐみ.png",
        spriteDirections: {
            down: "images/characters/player/directions/めぐみ_front.webp",
            up: "images/characters/player/directions/めぐみ_back.webp",
            left: "images/characters/player/directions/めぐみ_left.webp",
            right: "images/characters/player/directions/めぐみ_right.webp"
        }
    },

    3: {
        name: "聖職者",
        graphColor: "#63C5FF",
        icon: "images/characters/player/icons/聖職者-icon.webp",
        sprite: "images/characters/player/sprites/聖職者.png",
        spriteDirections: {
            down: "images/characters/player/directions/聖職者_front.webp",
            up: "images/characters/player/directions/聖職者_back.webp",
            left: "images/characters/player/directions/聖職者_left.webp",
            right: "images/characters/player/directions/聖職者_right.webp"
        }
    },

    4: {
        name: "剣士",
        graphColor: "#E53935",
        icon: "images/characters/player/icons/剣士-icon.webp",
        sprite: "images/characters/player/sprites/剣士.png",
        spriteDirections: {
            down: "images/characters/player/directions/剣士_front.webp",
            up: "images/characters/player/directions/剣士_back.webp",
            left: "images/characters/player/directions/剣士_left.webp",
            right: "images/characters/player/directions/剣士_right.webp"
        }
    },

    5: {
        name: "騎士",
        graphColor: "#F2C94C",
        icon: "images/characters/player/icons/騎士-icon.webp",
        sprite: "images/characters/player/sprites/騎士.png",
        spriteDirections: {
            down: "images/characters/player/directions/騎士_front.webp",
            up: "images/characters/player/directions/騎士_back.webp",
            left: "images/characters/player/directions/騎士_left.webp",
            right: "images/characters/player/directions/騎士_right.webp"
        }
    },
    
    6: {
        name: "魔術師",
        graphColor: "#A66DFF",
        icon: "images/characters/player/icons/魔術師-icon.webp",
        sprite: "images/characters/player/sprites/魔術師.png",
        spriteDirections: {
            down: "images/characters/player/directions/魔術師_front.webp",
            up: "images/characters/player/directions/魔術師_back.webp",
            left: "images/characters/player/directions/魔術師_left.webp",
            right: "images/characters/player/directions/魔術師_right.webp"
        }
    },

    7: {
        name: "鍛冶士",
        icon: "images/characters/player/icons/鍛冶士-icon.png",
        sprite: "images/characters/player/sprites/鍛冶士.png",
        selectable: false
    },

    8: {
        name: "看護師",
        graphColor: "#FF69B4",
        icon: "images/characters/player/icons/看護師-icon.webp",
        sprite: "images/characters/player/sprites/看護師.png",
        spriteDirections: {
            down: "images/characters/player/directions/看護師_front.webp",
            up: "images/characters/player/directions/看護師_back.webp",
            left: "images/characters/player/directions/看護師_left.webp",
            right: "images/characters/player/directions/看護師_right.webp"
        }
    },

    9: {
        name: "獣人",
        graphColor: "#00C78A",
        icon: "images/characters/player/icons/獣人-icon.webp",
        sprite: "images/characters/player/sprites/獣人.png",
        spriteDirections: {
            down: "images/characters/player/directions/獣人_front.webp",
            up: "images/characters/player/directions/獣人_back.webp",
            left: "images/characters/player/directions/獣人_left.webp",
            right: "images/characters/player/directions/獣人_right.webp"
        }
    },

    10: {
        name: "エルフ",
        graphColor: "#FFFFFF",
        icon: "images/characters/player/icons/エルフ-icon.webp",
        sprite: "images/characters/player/sprites/エルフ.png",
        spriteDirections: {
            down: "images/characters/player/directions/エルフ_front.webp",
            up: "images/characters/player/directions/エルフ_back.webp",
            left: "images/characters/player/directions/エルフ_left.webp",
            right: "images/characters/player/directions/エルフ_right.webp"
        }
    },
    11: {
        name: "義賊",
        graphColor: "#006400",
        icon: "images/characters/player/icons/義賊-icon.webp",
        sprite: "images/characters/player/sprites/義賊.png",
        spriteDirections: {
            down: "images/characters/player/directions/義賊_front.webp",
            up: "images/characters/player/directions/義賊_back.webp",
            left: "images/characters/player/directions/義賊_left.webp",
            right: "images/characters/player/directions/義賊_right.webp"
        }
    },
    12: {
        name: "拳法",
        icon: "images/characters/player/icons/拳法-icon.png",
        sprite: "images/characters/player/sprites/拳法.png",
        selectable: false
    }

}   

// =========================
// お金 contents
// =========================

const MONEY_CONTENTS = {

    1: {

        rewards: [
            {
                amount: 5000,
                probability: 20
            },
            {
                amount: 8000,
                probability: 20
            },
            {
                amount: 10000,
                probability: 20
            },
            {
                amount: 15000,
                probability: 15
            },
            {
                amount: 20000,
                probability: 10
            },
            {
                amount: 30000,
                probability: 9
            },
            {
                amount: 50000,
                probability: 5
            },
            {
                amount: 70000,
                probability: 1
            }
        ]

    }

};

// =========================
// モンスター contents
// =========================

const MONSTER_CONTENTS = {

   1: {
        name: "スライム",
        icon: "images/characters/enemy/normal/スライム.webp",
        hp: 1000,
        attack: 2000,
        magicReward: 30,
        goldReward: 8000
    },

    2: {
        name: "アンデット",
        icon: "images/characters/enemy/normal/アンデット.webp",
        hp: 1100,
        attack: 3000,
        magicReward: 40,
        goldReward: 10000
    },

    3: {
        name: "デビルこうもり",
        icon:  "images/characters/enemy/normal/デビルこうもり.webp",
        hp: 1600,
        attack: 3200,
        magicReward: 60,
        goldReward: 15000
    },
    4: {
        name: "パックン",
        icon:  "images/characters/enemy/normal/パックン.webp",
        hp: 1800,
        attack: 3500,
        magicReward: 80,
        goldReward: 18000
    },
    5: {
        name: "マッシュル",
        icon:  "images/characters/enemy/normal/マッシュル.webp",
        hp: 1300,
        attack: 4000,
        magicReward: 70,
        goldReward: 16000
    },
    6: {
        name: "ウッディオ",
        icon:  "images/characters/enemy/normal/ウッディオ.webp",
        hp: 1700,
        attack: 2400,
        magicReward: 80,
        goldReward: 20000
    },
    7: {
        name: "チビリン",
        icon:  "images/characters/enemy/normal/チビリン.webp",
        hp: 1500,
        attack: 3600,
        magicReward: 80,
        goldReward: 18000
    },
    8: {
        name: "メタルゴーレム",
        icon:  "images/characters/enemy/normal/メタルゴーレム.webp",
        hp: 2700,
        attack: 4500,
        magicReward: 120,
        goldReward: 30000
    },
    9: {
        name: "アイソル",
        icon:  "images/characters/enemy/normal/アイソル.webp",
        hp: 1900,
        attack: 4000,
        magicReward: 110,
        goldReward: 28000
    },
    10: {
        name: "ゴースハット",
        icon:  "images/characters/enemy/normal/ゴースハット.webp",
        hp: 1500,
        attack: 4200,
        magicReward: 80,
        goldReward: 22000
    },
};

// =========================
// アイテム contents
// =========================

const ITEM_CONTENTS = {

     1: {
        name: "人力車",
        price: 15000,
        category: "move",
        diceCount: 2,
        effect: "サイコロを2個振れる",
        rank: 1
    },

    2: {
        name: "タクシーチケット",
        price: 30000,
        category: "move",
        diceCount: 3,
        effect: "サイコロを3個振れる",
        rank: 1
    },

    3: {
        name: "グリーン車",
        price: 80000,
        category: "move",
        diceCount: 4,
        effect: "サイコロを4個振れる",
        rank: 2
    },

    4: {
        name: "ビジネスクラス",
        price: 100000,
        category: "move",
        diceCount: 5,
        effect: "サイコロを5個振れる",
        rank: 3
    },

    5: {
        name: "ファーストクラス",
        price: 150000,
        category: "move",
        diceCount: 6,
        effect: "サイコロを6個振れる",
        rank: 3
    },

    6: {
        name: "プライベートジェット",
        price: 200000,
        category: "move",
        diceCount: 8,
        effect: "サイコロを8個振れる",
        rank: 99
    },

    7: {
        name: "走れ、メロス",
        price: 200000,
        category: "move",
        diceCount: 10,
        effect: "サイコロを10個振れる",
        rank: 4
    },

    8: {
        name: "どんぴ車",
        price: 100000,
        category: "move",
        effect: "6マス以内の好きなマスに止まれる",
        rank: 1
    },

    9: {
        name: "お守り",
        price: 10000,
        category: "passive",
        effect: "相手から受けるダメージ－500",
        effectType: "damageReduction",
        effectTarget: "self",
        effectValue: 500,
        effectDuration: "permanent",
        rank: 99
    },

    10: {
        name: "ダンベル",
        price: 20000,
        category: "passive",
        effect: "相手に与えるダメージ＋100",
        effectType: "damageBonus",
        effectTarget: "self",
        effectValue: 100,
        effectDuration: "permanent",
        rank: 99
    },

    11: {
        name: "幸運の財布",
        price: 0,
        category: "passive",
        effect: "3ターンの間、開始時10000G獲得",
        effectType: "goldGain",
        effectTarget: "self",
        effectValue: 10000,
        effectDuration: "3turn",
        rank: 1
    },

    12: {
        name: "免罪符",
        price: 20000,
        category: "passive",
        effect: "6ターンの間、ギルドのお姉さんのお仕置きを免除",
        effectType: "punishmentImmunity",
        effectTarget: "self",
        effectDuration: "6turn",
        rank: 99
    },
    13: {
        name: "ロスノート",
        price: 300000,
        category: "special",
        effect: "このノートに名前を書かれた者は〇ぬ",
        effectType: "bossCounterImmunity",
        effectTarget: "lossNote",
        effectDuration: "playe",
        rank: 99
    },
    14: {
    name: "近づきマス",
    price: 300000,
    category: "warp",
    effect: "ボスマスまであと1マスの場所へ移動する",
    effectType: "warpToBoss",
    effectTarget: "self",
    effectValue: 1,
    effectDuration: "instant",
    rank: 2
    },
    15: {
        name: "不運な財布",
        price: 0,
        category: "passive",
        effect: "3ターンの間、開始時-10000G",
        effectType: "goldGain",
        effectTarget: "self",
        effectValue:-10000,
        effectDuration: "3turn",
        rank: 1
    },
    16: {
        name: "強運の財布",
        price: 0,
        category: "passive",
        effect: "3ターンの間、開始時50000G獲得",
        effectType: "goldGain",
        effectTarget: "self",
        effectValue: 50000,
        effectDuration: "3turn",
        rank: 2
    },
    17: {
        name: "叩き派遣",
        price: 300000,
        category: "special",
        effect: "他のプレイヤーのアイテムをランダムで破壊",
        effectType: "destroyItems",
        effectTarget: "others",
        effectDuration: "instant",
        rank: 3
    },
    18: {
        name: "ロストマジック",
        price: 300000,
        category: "special",
        effect: "指定したプレイヤーの魔法を1つ選んで消失させる",
        effectType: "magicLoss",
        effectTarget: "otherPlayer",
        effectDuration: "instant",
        rank: 3
    },
    19: {
        name: "闇みずほ",
        price: 400000,
        category: "special",
        effect: "指定プレイヤーに対してゴールドを送金または強奪できる",
        effectType: "moneyTransfer",
        effectTarget: "otherPlayer",
        effectDuration: "instant",
        rank: 3
    },
     20: {
        name: "飛んできマス",
        price: 20000,
        category: "warp",
        effect: "マップのどこかしらにワープする",
        effectType: "warpToRandom",
        effectTarget: "self",
        effectValue: 1,
        effectDuration: "instant",
        rank: 1
    },
    21: {
        name: "闇ヤマト",
        price: 200000,
        category: "special",
        effect: "指定プレイヤーにアイテムを送付または強奪",
        effectType: "itemTransfer",
        effectTarget: "otherPlayer",
        effectDuration: "instant",
        rank: 3
    },
    22: {
        name: "闇スーモ",
        price: 300000,
        category: "special",
        effect: "指定プレイヤーに資産を贈与または強奪",
        effectType: "assetTransfer",
        effectTarget: "otherPlayer",
        effectDuration: "instant",
        rank: 3
    },
     23: {
        name: "ふっとばしマス",
        price: 80000,
        category: "warp",
        effect: "他プレイヤー全員をどこかのマスに飛ばす",
        effectType: "warpAllPlayersRandom",
        effectTarget: "otherPlayer",
        effectValue: 1,
        effectDuration: "instant",
        rank: 2
    },
    24: { name:'ランドマークワープ', price:200000, category:'special', effect:'選んだエリアのスタートマスへ移動する', effectType:'landmarkWarp', effectTarget:'self', effectDuration:'instant', rank:2 },
    25: { name:'みんなで平均値', price:100000, category:'special', effect:'全員の所持金を平均化する', effectType:'equalizeMoney', effectTarget:'all', effectDuration:'instant', rank:2 },
    26: { name:'アイテム封じ', price:200000, category:'special', effect:'指定した相手は3ターンアイテムを使用できなくなる', effectType:'sealItems', effectTarget:'otherPlayer', effectDuration:'instant', rank:3 },
    27: { name:'橋崩し', price:200000, category:'special', effect:'各エリアをつなぐ橋を3ターン通行止めにする', effectType:'bridgeCollapse', effectTarget:'all', effectDuration:'instant', rank:3 },
    28: { name:'6しか勝たん', price:150000, category:'special', effect:'次に振るサイコロの目が全て6になる', effectType:'nextRollAllSix', effectTarget:'self', effectDuration:'nextRoll', rank:2 },
    29: { name:'お楽しみ福袋', price:120000, category:'special', effect:'アイテムをランダムで3つ入手できる', effectType:'fukubukuro', effectTarget:'self', effectDuration:'instant', rank:1 },
    30: { name:'この世界の攻略本', price:0, category:'special', effect:'この世界で資産を格段に増やすノウハウが詰め込まれている。他冒険者は閲覧不可。', effectType:'guidebook', effectTarget:'self', effectDuration:'instant', rank:99, duplicable:false },
    31: { name:'無敵の加護', price:200000, category:'special', effect:'次の自分のターン開始まで、あらゆる不利益を受けない。', effectType:'disadvantageImmunity', effectTarget:'self', effectDuration:'nextTurnStart', rank:2 },
    32: { name:'複製さん', price:200000, category:'special', effect:'自分の所持アイテムを一つ複製できる', effectType:'duplicateItem', effectTarget:'self', effectDuration:'instant', rank:2 },
    33: { name:'攻略本2', price:0, category:'special', effect:'特別なアイテム', effectType:'specialRewardBook', effectTarget:'self', effectDuration:'instant', rank:99, duplicable:false },


};

const ITEM_DUPLICATION_BLOCKED_MESSAGE = 'このアイテムは複製できません';
function isItemDuplicable(item) {
    // Rank 99 is reserved for special items. Use duplicable:false for exceptions at other ranks.
    return Boolean(item && Number(item.rank) < 99 && item.duplicable !== false);
}

// =========================
// 魔法 contents
// =========================

const MAGIC_CONTENTS = {

    1: {
        name: "ファイア",
        type: "attack",
        icon: "images/magic/icons/ファイア.webp",
        effect: "魔力の100%で攻撃",
        sound: "sounds/戦闘/火炎魔法1.mp3",
        powerRate: 1.0,
        costRate: 1.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null, 
        price: 1000,
        actionAfterUse: "end",
        rank: 0
    },

    2: {
        name: "ブリザド",
        icon: "images/magic/icons/ブリザド.webp",
        type: "attack",
        effect: "魔力の200％で攻撃",
        sound: "sounds/戦闘/氷魔法1.mp3",
        powerRate: 2.0,
        costRate: 2.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 50000,
        actionAfterUse: "end",
        rank: 0
    },
    3: {
        name: "サンダー",
        type: "attack",
        icon: "images/magic/icons/サンダー.webp",
        effect: "魔力の300％で攻撃",
        sound: "sounds/戦闘/雷魔法2.mp3",
        powerRate: 3.0,
        costRate: 3.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 100000,
        actionAfterUse: "end",
        rank: 0
    },
    4: {
        name: "Dチェーン",
        type: "attack",
        icon: "images/magic/icons/dark-chain-icon.png",
        effect: "魔力の500％で攻撃",
        sound: "sounds/戦闘/ダークスパイク.mp3",
        powerRate: 5.0,
        costRate: 5.2,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 200000,
        actionAfterUse: "end",
        rank: 0
    },

    5: {
        name: "メテオ",
        type: "attack",
        icon: "images/magic/icons/メテオ.webp",
        effect: "魔力の600％で攻撃",
        icon: "images/magic/icons/メテオ.webp",
        sound: "sounds/戦闘/爆発1.mp3",
        powerRate: 6.0,
        costRate: 6.5,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 400000,
        actionAfterUse: "end",
        rank: 0
    },

    6: {
        name: "パワアプ",
        type: "buff",
        icon: "images/magic/icons/パワアプ.webp",
        effect: "戦闘中の魔法の威力が2倍になる",
        sound: "sounds/戦闘/パワーチャージ.mp3",
        powerRate: null,
        costRate: 2.0,
        buffTarget: "self",
        buffStat: "magicPower",
        buffRate: 2.0,
        buffDuration: "1turn",
        price: 300000,
        actionAfterUse: "continue",
        rank: 0
    },

    7: {
        name: "ディフェアプ",
        type: "buff",
        icon: "images/magic/icons/ディフェアプ.webp",
        effect: "戦闘中の相手の攻撃力を半分",
        sound: "sounds/戦闘/詠唱1.mp3",
        powerRate: null,
        costRate: 0.1,
        buffTarget: "enemy",
        buffStat: "attackPower",
        buffRate: 0.5,
        buffDuration: "1turn",
        price: 100000,
        actionAfterUse: "continue",
        rank: 0
    },
    8: {
        name: "スピッファ",
        type: "attack",
        icon: "images/magic/icons/スピファ.webp",
        effect: "魔力の800％で攻撃",
        sound: "sounds/戦闘/重機関銃を乱射1.mp3",
        powerRate: 8.0,
        costRate: 10.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 500000,
        actionAfterUse: "end",
        rank: 0
    },

    9: {
        name: "クレーバー",
        type: "attack",
        icon: "images/magic/icons/クレーバー.webp",
        effect: "魔力の1000％で攻撃",
        sound: "sounds/戦闘/クレーバー.mp3",
        powerRate: 10.0,
        costRate: 10.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 0,
        actionAfterUse: "end",
        rank: 4
    },
    
    10: {
        name: "トルネード",
        type: "attack",
        icon: "images/magic/icons/トルネード.webp",
        effect: "魔力の400％で攻撃",
        sound: "sounds/戦闘/竜巻.mp3",
        powerRate: 4.0,
        costRate: 3.0,
        buffTarget: null,
        buffStat: null,
        buffRate: null,
        buffDuration: null,
        price: 0,
        actionAfterUse: "end",
        rank: 2
    }
    

};

// =========================
// 魔力 contents
// =========================

const POWER_CONTENTS = {

    1: {
        effect: "魔力＋50",
        price: 20000,
        rank: 0
    },

    2: {
        effect: "魔力＋500",
        price: 200000,
        rank: 0
    },

    3: {
        effect: "魔力＋5000",
        price: 2000000,
        rank: 0
    }

};

// =========================
// モブ資産生成
// =========================

function createMobAssets(startId, endId) {

    const assets = {};

    for (let id = startId; id <= endId; id++) {

        assets[id] = {
            name: "モブ",
            price: 10000,
            yield: 50,
            owner: null
        };

    }

    return assets;
}

// =========================
// 資産 contents
// =========================

const ASSET_CONTENTS = {
    1: { name: "フリーレソ", price: 100000, yield: 25, typeId: 1, owner: null },
    2: { name: "フェルソ", price: 150000, yield: 25, typeId: 1, owner: null },
    3: { name: "ショタルク", price: 90000, yield: 30, typeId: 1, owner: null },
    4: { name: "ヒソメル", price: 60000, yield: 30, typeId: 1, owner: null },
    5: { name: "ナイター", price: 50000, yield: 40, typeId: 1, owner: null },
    6: { name: "アイセン", price: 30000, yield: 45, typeId: 1, owner: null },
    7: { name: "セーリエ", price: 20000, yield: 50, typeId: 1, owner: null },
    8: { name: "ヌーデウス", price: 300000, yield: 25, typeId: 2, owner: null },
    9: { name: "ロシシー", price: 100000, yield: 25, typeId: 2, owner: null },
    10: { name: "シルフィネット", price: 70000, yield: 30, typeId: 2, owner: null },
    11: { name: "エリヌ", price: 60000, yield: 30, typeId: 2, owner: null },
    12: { name: "ハウロ", price: 40000, yield: 40, typeId: 2, owner: null },
    13: { name: "セニス", price: 30000, yield: 45, typeId: 2, owner: null },
    14: { name: "ナナハチ", price: 20000, yield: 50, typeId: 2, owner: null },
    15: { name: "ヌバル", price: 700000, yield: 10, typeId: 3, owner: null },
    16: { name: "笑みリア", price: 200000, yield: 25, typeId: 3, owner: null },
    17: { name: "檸夢", price: 90000, yield: 30, typeId: 3, owner: null },
    18: { name: "羅夢", price: 70000, yield: 30, typeId: 3, owner: null },
    19: { name: "ベアトニス", price: 50000, yield: 40, typeId: 3, owner: null },
    20: { name: "ナインハルト", price: 30000, yield: 45, typeId: 3, owner: null },
    21: { name: "パク", price: 20000, yield: 50, typeId: 3, owner: null },
    22: { name: "アタイ", price: 200000, yield: 25, typeId: 4, owner: null },
    23: { name: "マリンアクア", price: 90000, yield: 30, typeId: 4, owner: null },
    24: { name: "ルビー石", price: 70000, yield: 30, typeId: 4, owner: null },
    25: { name: "あれまかな", price: 50000, yield: 40, typeId: 4, owner: null },
    26: { name: "白川あかね", price: 40000, yield: 40, typeId: 4, owner: null },
    27: { name: "Mちょ", price: 20000, yield: 50, typeId: 4, owner: null },
    28: { name: "ミナコ社長", price: 20000, yield: 50, typeId: 4, owner: null },
    29: { name: "ルフェ", price: 1000000, yield: 5, typeId: 5, owner: null },
    30: { name: "ゾノ", price: 200000, yield: 25, typeId: 5, owner: null },
    31: { name: "ナミィ", price: 90000, yield: 30, typeId: 5, owner: null },
    32: { name: "ウンップ", price: 70000, yield: 30, typeId: 5, owner: null },
    33: { name: "サンシ", price: 50000, yield: 40, typeId: 5, owner: null },
    34: { name: "チッパー", price: 40000, yield: 40, typeId: 5, owner: null },
    35: { name: "ロビソ", price: 20000, yield: 50, typeId: 5, owner: null },
    36: { name: "ナルコ", price: 900000, yield: 5, typeId: 6, owner: null },
    37: { name: "サステ", price: 200000, yield: 25, typeId: 6, owner: null },
    38: { name: "サクハ", price: 90000, yield: 30, typeId: 6, owner: null },
    39: { name: "ガガシ", price: 70000, yield: 30, typeId: 6, owner: null },
    40: { name: "シカマルン", price: 50000, yield: 40, typeId: 6, owner: null },
    41: { name: "ピナタ", price: 40000, yield: 40, typeId: 6, owner: null },
    42: { name: "我愛裸", price: 20000, yield: 50, typeId: 6, owner: null },
    43: { name: "デクノボウ", price: 900000, yield: 5, typeId: 7, owner: null },
    44: { name: "爆音", price: 200000, yield: 25, typeId: 7, owner: null },
    45: { name: "轟消灯", price: 90000, yield: 30, typeId: 7, owner: null },
    46: { name: "お茶の子", price: 70000, yield: 30, typeId: 7, owner: null },
    47: { name: "飯田天天", price: 50000, yield: 40, typeId: 7, owner: null },
    48: { name: "カエル", price: 30000, yield: 45, typeId: 7, owner: null },
    49: { name: "オールナイト", price: 20000, yield: 50, typeId: 7, owner: null },
    50: { name: "坂田銀", price: 600000, yield: 15, typeId: 8, owner: null },
    51: { name: "めがね", price: 150000, yield: 25, typeId: 8, owner: null },
    52: { name: "チャイナ娘", price: 80000, yield: 30, typeId: 8, owner: null },
    53: { name: "土方十四郎助", price: 60000, yield: 30, typeId: 8, owner: null },
    54: { name: "沖田総悟太", price: 50000, yield: 40, typeId: 8, owner: null },
    55: { name: "ズラ", price: 30000, yield: 45, typeId: 8, owner: null },
    56: { name: "デカ犬", price: 20000, yield: 50, typeId: 8, owner: null },
    57: { name: "エレ", price: 800000, yield: 5, typeId: 9, owner: null },
    58: { name: "ミサカ", price: 200000, yield: 25, typeId: 9, owner: null },
    59: { name: "ナイミン", price: 90000, yield: 30, typeId: 9, owner: null },
    60: { name: "リヴァ", price: 70000, yield: 30, typeId: 9, owner: null },
    61: { name: "エルウィン", price: 50000, yield: 40, typeId: 9, owner: null },
    62: { name: "サショ", price: 30000, yield: 45, typeId: 9, owner: null },
    63: { name: "ハンシ", price: 20000, yield: 50, typeId: 9, owner: null },
    64: { name: "たぬきえもん", price: 600000, yield: 15, typeId: 10, owner: null },
    65: { name: "のひ太", price: 150000, yield: 25, typeId: 10, owner: null },
    66: { name: "しすかちゃん", price: 80000, yield: 30, typeId: 10, owner: null },
    67: { name: "シャイアン", price: 60000, yield: 30, typeId: 10, owner: null },
    68: { name: "ヒザ夫", price: 50000, yield: 40, typeId: 10, owner: null },
    69: { name: "良杉", price: 30000, yield: 45, typeId: 10, owner: null },
    70: { name: "シャイ子", price: 20000, yield: 50, typeId: 10, owner: null },
    71: { name: "ロイホ", price: 700000, yield: 10, typeId: 11, owner: null },
    72: { name: "サーニャ", price: 200000, yield: 25, typeId: 11, owner: null },
    73: { name: "ヨヌ", price: 90000, yield: 30, typeId: 11, owner: null },
    74: { name: "ポンド", price: 70000, yield: 30, typeId: 11, owner: null },
    75: { name: "ユーニ", price: 50000, yield: 40, typeId: 11, owner: null },
    76: { name: "エレガント先生", price: 30000, yield: 45, typeId: 11, owner: null },
    77: { name: "タミアン", price: 20000, yield: 50, typeId: 11, owner: null },
    78: { name: "日向翔陰", price: 700000, yield: 10, typeId: 12, owner: null },
    79: { name: "影山飛雌", price: 200000, yield: 25, typeId: 12, owner: null },
    80: { name: "澤村平地", price: 90000, yield: 30, typeId: 12, owner: null },
    81: { name: "梶原孝支", price: 70000, yield: 30, typeId: 12, owner: null },
    82: { name: "西谷朝", price: 50000, yield: 40, typeId: 12, owner: null },
    83: { name: "月島小樽", price: 30000, yield: 45, typeId: 12, owner: null },
    84: { name: "清水潔", price: 20000, yield: 50, typeId: 12, owner: null },
    85: { name: "チェンソー男", price: 700000, yield: 10, typeId: 13, owner: null },
    86: { name: "速河アキ", price: 200000, yield: 25, typeId: 13, owner: null },
    87: { name: "パワ子", price: 90000, yield: 30, typeId: 13, owner: null },
    88: { name: "マキマキ", price: 70000, yield: 30, typeId: 13, owner: null },
    89: { name: "コペニ", price: 50000, yield: 40, typeId: 13, owner: null },
    90: { name: "レセ", price: 30000, yield: 45, typeId: 13, owner: null },
    91: { name: "ポチ", price: 20000, yield: 50, typeId: 13, owner: null },
    92: { name: "二刀流黒剣士チートニキ", price: 700000, yield: 10, typeId: 14, owner: null },
    93: { name: "アスラ", price: 150000, yield: 25, typeId: 14, owner: null },
    94: { name: "リファ", price: 90000, yield: 30, typeId: 14, owner: null },
    95: { name: "シオン", price: 60000, yield: 30, typeId: 14, owner: null },
    96: { name: "ヌイ", price: 50000, yield: 40, typeId: 14, owner: null },
    97: { name: "フライン", price: 30000, yield: 45, typeId: 14, owner: null },
    98: { name: "リスヘット", price: 20000, yield: 50, typeId: 14, owner: null },
    99: { name: "ヒキニート", price: 400000, yield: 20, typeId: 15, owner: null },
    100: { name: "トイレの女神様", price: 150000, yield: 25, typeId: 15, owner: null },
    101: { name: "爆裂娘", price: 80000, yield: 30, typeId: 15, owner: null },
    102: { name: "ララティー", price: 60000, yield: 30, typeId: 15, owner: null },
    103: { name: "貧乏店主", price: 40000, yield: 40, typeId: 15, owner: null },
    104: { name: "ゆむゆむ", price: 30000, yield: 45, typeId: 15, owner: null },
    105: { name: "真女神", price: 20000, yield: 50, typeId: 15, owner: null },
    106: { name: "アインス", price: 300000, yield: 25, typeId: 16, owner: null },
    107: { name: "アルベドン", price: 100000, yield: 25, typeId: 16, owner: null },
    108: { name: "シャルティアン", price: 70000, yield: 30, typeId: 16, owner: null },
    109: { name: "デミウルゴスン", price: 60000, yield: 30, typeId: 16, owner: null },
    110: { name: "コキュートスン", price: 40000, yield: 40, typeId: 16, owner: null },
    111: { name: "オウラ", price: 30000, yield: 45, typeId: 16, owner: null },
    112: { name: "ナーレ", price: 20000, yield: 50, typeId: 16, owner: null },
    113: { name: "リムルン", price: 300000, yield: 25, typeId: 17, owner: null },
    114: { name: "ベニマルン", price: 100000, yield: 25, typeId: 17, owner: null },
    115: { name: "シス", price: 70000, yield: 30, typeId: 17, owner: null },
    116: { name: "スナ", price: 60000, yield: 30, typeId: 17, owner: null },
    117: { name: "ニオン", price: 40000, yield: 40, typeId: 17, owner: null },
    118: { name: "ノウエイ", price: 30000, yield: 45, typeId: 17, owner: null },
    119: { name: "クロロウ", price: 20000, yield: 50, typeId: 17, owner: null },
    120: { name: "五宮かぐや", price: 600000, yield: 15, typeId: 18, owner: null },
    121: { name: "黒金御行", price: 150000, yield: 25, typeId: 18, owner: null },
    122: { name: "藤原千沙", price: 90000, yield: 30, typeId: 18, owner: null },
    123: { name: "石下祐", price: 60000, yield: 30, typeId: 18, owner: null },
    124: { name: "伊野巫女", price: 50000, yield: 40, typeId: 18, owner: null },
    125: { name: "早坂彩", price: 30000, yield: 45, typeId: 18, owner: null },
    126: { name: "柏木海", price: 20000, yield: 50, typeId: 18, owner: null },
    127: { name: "マウマウ", price: 200000, yield: 25, typeId: 19, owner: null },
    128: { name: "シンシ", price: 90000, yield: 30, typeId: 19, owner: null },
    129: { name: "ダオシュン", price: 70000, yield: 30, typeId: 19, owner: null },
    130: { name: "シスヒ", price: 50000, yield: 40, typeId: 19, owner: null },
    131: { name: "リパク", price: 40000, yield: 40, typeId: 19, owner: null },
    132: { name: "ラカソ", price: 20000, yield: 50, typeId: 19, owner: null },
    133: { name: "やぶ医者", price: 20000, yield: 50, typeId: 19, owner: null },
    134: { name: "伝説の山田先輩", price: 300000, yield: 25, typeId: 20, owner: null },
    135: { name: "どやんすさくら", price: 100000, yield: 25, typeId: 20, owner: null },
    136: { name: "伝説の特攻隊長", price: 80000, yield: 30, typeId: 20, owner: null },
    137: { name: "伝説の平成アイドル", price: 60000, yield: 30, typeId: 20, owner: null },
    138: { name: "伝説の昭和アイドル", price: 40000, yield: 40, typeId: 20, owner: null },
    139: { name: "伝説の花魁", price: 30000, yield: 45, typeId: 20, owner: null },
    140: { name: "伝説の天才子役", price: 20000, yield: 50, typeId: 20, owner: null },
    141: { name: "夜神太陽", price: 800000, yield: 5, typeId: 21, owner: null },
    142: { name: "R", price: 200000, yield: 25, typeId: 21, owner: null },
    143: { name: "天音海砂", price: 90000, yield: 30, typeId: 21, owner: null },
    144: { name: "ニアニア", price: 70000, yield: 30, typeId: 21, owner: null },
    145: { name: "メロメロ", price: 50000, yield: 40, typeId: 21, owner: null },
    146: { name: "高田汚美", price: 30000, yield: 45, typeId: 21, owner: null },
    147: { name: "松田桃", price: 20000, yield: 50, typeId: 21, owner: null },
    148: { name: "五条ワカ", price: 250000, yield: 25, typeId: 22, owner: null },
    149: { name: "喜多川マリ", price: 90000, yield: 30, typeId: 22, owner: null },
    150: { name: "犬井紗寿叶", price: 70000, yield: 30, typeId: 22, owner: null },
    151: { name: "乾心", price: 50000, yield: 40, typeId: 22, owner: null },
    152: { name: "アキラ", price: 40000, yield: 40, typeId: 22, owner: null },
    153: { name: "五条燻", price: 20000, yield: 50, typeId: 22, owner: null },
    154: { name: "姫野あま", price: 20000, yield: 50, typeId: 22, owner: null },
    155: { name: "江戸川コウナン", price: 600000, yield: 15, typeId: 23, owner: null },
    156: { name: "毛井蘭", price: 150000, yield: 25, typeId: 23, owner: null },
    157: { name: "博士", price: 80000, yield: 30, typeId: 23, owner: null },
    158: { name: "灰薔薇愛", price: 60000, yield: 30, typeId: 23, owner: null },
    159: { name: "歩知", price: 50000, yield: 40, typeId: 23, owner: null },
    160: { name: "元太郎", price: 30000, yield: 45, typeId: 23, owner: null },
    161: { name: "四津彦", price: 20000, yield: 50, typeId: 23, owner: null },
    162: { name: "ガガロット", price: 1000000, yield: 5, typeId: 24, owner: null },
    163: { name: "ベージタ", price: 200000, yield: 25, typeId: 24, owner: null },
    164: { name: "ご飯", price: 90000, yield: 30, typeId: 24, owner: null },
    165: { name: "クリリソ", price: 70000, yield: 30, typeId: 24, owner: null },
    166: { name: "ピコッロ", price: 50000, yield: 40, typeId: 24, owner: null },
    167: { name: "ブルマ", price: 40000, yield: 40, typeId: 24, owner: null },
    168: { name: "トランクス", price: 20000, yield: 50, typeId: 24, owner: null },
    169: { name: "炭三郎", price: 900000, yield: 5, typeId: 25, owner: null },
    170: { name: "小豆子", price: 200000, yield: 25, typeId: 25, owner: null },
    171: { name: "雷逸", price: 90000, yield: 30, typeId: 25, owner: null },
    172: { name: "井伊之介", price: 70000, yield: 30, typeId: 25, owner: null },
    173: { name: "富岡", price: 50000, yield: 40, typeId: 25, owner: null },
    174: { name: "練炭獄", price: 40000, yield: 40, typeId: 25, owner: null },
    175: { name: "鬼譜寿司無飯", price: 20000, yield: 50, typeId: 25, owner: null },
    176: { name: "板取雄二", price: 900000, yield: 5, typeId: 26, owner: null },
    177: { name: "伏黒廻", price: 200000, yield: 25, typeId: 26, owner: null },
    178: { name: "五条智", price: 500000, yield: 20, typeId: 26, owner: null },
    179: { name: "釘宮薔薇", price: 70000, yield: 30, typeId: 26, owner: null },
    180: { name: "八海健斗", price: 50000, yield: 40, typeId: 26, owner: null },
    181: { name: "夏油啜る", price: 40000, yield: 40, typeId: 26, owner: null },
    182: { name: "ぱんだ", price: 20000, yield: 50, typeId: 26, owner: null },
    183: { name: "エトワート", price: 100000, yield: 25, typeId: 27, owner: null },
    184: { name: "アルフィンス", price: 100000, yield: 25, typeId: 27, owner: null },
    185: { name: "ウェンリ", price: 50000, yield: 40, typeId: 27, owner: null },
    186: { name: "プラトニー", price: 50000, yield: 40, typeId: 27, owner: null },
    187: { name: "フリード", price: 50000, yield: 40, typeId: 27, owner: null },
    188: { name: "キンク", price: 100000, yield: 25, typeId: 27, owner: null },
    189: { name: "勘のいいガキ", price: 500000, yield: 20, typeId: 27, owner: null },
    190: { name: "黒崎みかん", price: 800000, yield: 5, typeId: 28, owner: null },
    191: { name: "岩田雨龍", price: 200000, yield: 25, typeId: 28, owner: null },
    192: { name: "猪上舞姫", price: 90000, yield: 30, typeId: 28, owner: null },
    193: { name: "茶道高虎", price: 70000, yield: 30, typeId: 28, owner: null },
    194: { name: "ポン", price: 50000, yield: 40, typeId: 28, owner: null },
    195: { name: "朽木ルキナ", price: 30000, yield: 45, typeId: 28, owner: null },
    196: { name: "世田谷冬次郎", price: 20000, yield: 50, typeId: 28, owner: null },
    197: { name: "西方仗助", price: 800000, yield: 5, typeId: 29, owner: null },
    198: { name: "狭瀬紘一", price: 200000, yield: 25, typeId: 29, owner: null },
    199: { name: "虹町億貴", price: 90000, yield: 30, typeId: 29, owner: null },
    200: { name: "岸部同伴", price: 70000, yield: 30, typeId: 29, owner: null },
    201: { name: "空城承次郎", price: 50000, yield: 40, typeId: 29, owner: null },
    202: { name: "吉裸吉鍋", price: 30000, yield: 45, typeId: 29, owner: null },
    203: { name: "シゲにー", price: 20000, yield: 50, typeId: 29, owner: null },
    204: { name: "怒り紳士", price: 800000, yield: 5, typeId: 30, owner: null },
    205: { name: "早泣きレイ", price: 200000, yield: 25, typeId: 30, owner: null },
    206: { name: "アスナ・ナンナウェイ", price: 90000, yield: 30, typeId: 30, owner: null },
    207: { name: "葛城ミサコ", price: 70000, yield: 30, typeId: 30, owner: null },
    208: { name: "怒り剣道", price: 50000, yield: 40, typeId: 30, owner: null },
    209: { name: "青木リツコ", price: 30000, yield: 45, typeId: 30, owner: null },
    210: { name: "マミ・ミステリアス", price: 20000, yield: 50, typeId: 30, owner: null },
    211: { name: "コン", price: 700000, yield: 10, typeId: 31, owner: null },
    212: { name: "キヌア", price: 200000, yield: 25, typeId: 31, owner: null },
    213: { name: "レダリオ", price: 90000, yield: 30, typeId: 31, owner: null },
    214: { name: "クラビカ", price: 70000, yield: 30, typeId: 31, owner: null },
    215: { name: "ヒッソリカ", price: 50000, yield: 40, typeId: 31, owner: null },
    216: { name: "オオムギ", price: 30000, yield: 45, typeId: 31, owner: null },
    217: { name: "ネビルピトー", price: 20000, yield: 50, typeId: 31, owner: null },
    218: { name: "いちかわ", price: 700000, yield: 10, typeId: 32, owner: null },
    219: { name: "たーやま", price: 200000, yield: 25, typeId: 32, owner: null },
    220: { name: "彼氏さん", price: 90000, yield: 30, typeId: 32, owner: null },
    221: { name: "萌えピ", price: 70000, yield: 30, typeId: 32, owner: null },
    222: { name: "セリア", price: 50000, yield: 40, typeId: 32, owner: null },
    223: { name: "お姉", price: 30000, yield: 45, typeId: 32, owner: null },
    224: { name: "あたち", price: 20000, yield: 50, typeId: 32, owner: null },
    225: { name: "倫次郎", price: 600000, yield: 15, typeId: 33, owner: null },
    226: { name: "まゆみ", price: 150000, yield: 25, typeId: 33, owner: null },
    227: { name: "タル", price: 90000, yield: 30, typeId: 33, owner: null },
    228: { name: "クリスタル", price: 60000, yield: 30, typeId: 33, owner: null },
    229: { name: "音々羽", price: 50000, yield: 40, typeId: 33, owner: null },
    230: { name: "フェリス・ワンワン", price: 30000, yield: 45, typeId: 33, owner: null },
    231: { name: "漆塗りするか", price: 20000, yield: 50, typeId: 33, owner: null },
    232: { name: "宮美ショータ", price: 600000, yield: 15, typeId: 34, owner: null },
    233: { name: "三井陽射", price: 150000, yield: 25, typeId: 34, owner: null },
    234: { name: "赤森ゴリ", price: 80000, yield: 30, typeId: 34, owner: null },
    235: { name: "櫻木薔薇道", price: 60000, yield: 30, typeId: 34, owner: null },
    236: { name: "流川奏", price: 50000, yield: 40, typeId: 34, owner: null },
    237: { name: "安産先生", price: 30000, yield: 45, typeId: 34, owner: null },
    238: { name: "水戸洋太", price: 20000, yield: 50, typeId: 34, owner: null },
    239: { name: "りんのすけ", price: 600000, yield: 15, typeId: 35, owner: null },
    240: { name: "ぬさえ", price: 150000, yield: 25, typeId: 35, owner: null },
    241: { name: "ひろち", price: 80000, yield: 30, typeId: 35, owner: null },
    242: { name: "ヒマワリ", price: 60000, yield: 30, typeId: 35, owner: null },
    243: { name: "笠間", price: 50000, yield: 40, typeId: 35, owner: null },
    244: { name: "ポーちゃん", price: 30000, yield: 45, typeId: 35, owner: null },
    245: { name: "まさ子", price: 20000, yield: 50, typeId: 35, owner: null },
    246: { name: "煙猫", price: 200000, yield: 25, typeId: 36, owner: null },
    247: { name: "酒猫", price: 30000, yield: 45, typeId: 36, owner: null },
    248: { name: "＊猫", price: 30000, yield: 45, typeId: 36, owner: null },
    249: { name: "薬猫", price: 30000, yield: 45, typeId: 36, owner: null },
    250: { name: "笑猫", price: 30000, yield: 45, typeId: 36, owner: null },
    251: { name: "辰郎", price: 30000, yield: 45, typeId: 36, owner: null },
    252: { name: "ヒロイン", price: 500000, yield: 20, typeId: 36, owner: null },
    253: { name: "ハゲヒーロー", price: 500000, yield: 20, typeId: 37, owner: null },
    254: { name: "シェノス", price: 150000, yield: 25, typeId: 37, owner: null },
    255: { name: "かまいたち", price: 80000, yield: 30, typeId: 37, owner: null },
    256: { name: "ゴールドファング", price: 60000, yield: 30, typeId: 37, owner: null },
    257: { name: "プラチナライダー", price: 40000, yield: 40, typeId: 37, owner: null },
    258: { name: "黄金バット", price: 30000, yield: 45, typeId: 37, owner: null },
    259: { name: "俊足のパニック", price: 20000, yield: 50, typeId: 37, owner: null },
    260: { name: "金森研", price: 500000, yield: 20, typeId: 38, owner: null },
    261: { name: "霧島桜花", price: 150000, yield: 25, typeId: 38, owner: null },
    262: { name: "神代梨花", price: 80000, yield: 30, typeId: 38, owner: null },
    263: { name: "東尾 錦", price: 60000, yield: 30, typeId: 38, owner: null },
    264: { name: "真賭呉尾", price: 40000, yield: 40, typeId: 38, owner: null },
    265: { name: "口笛雛", price: 30000, yield: 45, typeId: 38, owner: null },
    266: { name: "亜門金太郎", price: 20000, yield: 50, typeId: 38, owner: null },
    267: { name: "科学使い", price: 500000, yield: 20, typeId: 39, owner: null },
    268: { name: "メンタリスト", price: 150000, yield: 25, typeId: 39, owner: null },
    269: { name: "船乗り", price: 80000, yield: 30, typeId: 39, owner: null },
    270: { name: "石集め好き太郎", price: 60000, yield: 30, typeId: 39, owner: null },
    271: { name: "メロン", price: 40000, yield: 40, typeId: 39, owner: null },
    272: { name: "格闘家", price: 30000, yield: 45, typeId: 39, owner: null },
    273: { name: "琥珀", price: 20000, yield: 50, typeId: 39, owner: null },
    274: { name: "エナ", price: 500000, yield: 20, typeId: 40, owner: null },
    275: { name: "ノイマン", price: 150000, yield: 25, typeId: 40, owner: null },
    276: { name: "ライ", price: 80000, yield: 30, typeId: 40, owner: null },
    277: { name: "イサベラ", price: 60000, yield: 30, typeId: 40, owner: null },
    278: { name: "シローネ", price: 40000, yield: 40, typeId: 40, owner: null },
    279: { name: "フェル", price: 30000, yield: 45, typeId: 40, owner: null },
    280: { name: "ポニー", price: 20000, yield: 50, typeId: 40, owner: null },
    281: { name: "ヴァイオレンス", price: 500000, yield: 20, typeId: 41, owner: null },
    282: { name: "クラウティア", price: 150000, yield: 25, typeId: 41, owner: null },
    283: { name: "キルベルト", price: 80000, yield: 30, typeId: 41, owner: null },
    284: { name: "カトレーヌ", price: 60000, yield: 30, typeId: 41, owner: null },
    285: { name: "ベネフィット", price: 40000, yield: 40, typeId: 41, owner: null },
    286: { name: "エリナ", price: 30000, yield: 45, typeId: 41, owner: null },
    287: { name: "アリス", price: 20000, yield: 50, typeId: 41, owner: null },
    288: { name: "まじか", price: 500000, yield: 20, typeId: 42, owner: null },
    289: { name: "ほむか", price: 150000, yield: 25, typeId: 42, owner: null },
    290: { name: "マジ", price: 80000, yield: 30, typeId: 42, owner: null },
    291: { name: "さわやか", price: 60000, yield: 30, typeId: 42, owner: null },
    292: { name: "明日子", price: 40000, yield: 40, typeId: 42, owner: null },
    293: { name: "許せないマスコット", price: 30000, yield: 45, typeId: 42, owner: null },
    294: { name: "なにさ", price: 20000, yield: 50, typeId: 42, owner: null },
    295: { name: "山沢結衣", price: 500000, yield: 20, typeId: 43, owner: null },
    296: { name: "春山澪", price: 150000, yield: 25, typeId: 43, owner: null },
    297: { name: "田中律", price: 80000, yield: 30, typeId: 43, owner: null },
    298: { name: "寿紬", price: 60000, yield: 30, typeId: 43, owner: null },
    299: { name: "高野梓", price: 40000, yield: 40, typeId: 43, owner: null },
    300: { name: "谷中さわ男", price: 30000, yield: 45, typeId: 43, owner: null },
    301: { name: "真鍋賑やか", price: 20000, yield: 50, typeId: 43, owner: null },
    302: { name: "ぼっち", price: 400000, yield: 20, typeId: 44, owner: null },
    303: { name: "虹菜", price: 150000, yield: 25, typeId: 44, owner: null },
    304: { name: "リュウ", price: 80000, yield: 30, typeId: 44, owner: null },
    305: { name: "喜田ちゃん", price: 60000, yield: 30, typeId: 44, owner: null },
    306: { name: "歌星", price: 40000, yield: 40, typeId: 44, owner: null },
    307: { name: "きくし", price: 30000, yield: 45, typeId: 44, owner: null },
    308: { name: "音響さん", price: 20000, yield: 50, typeId: 44, owner: null },
    309: { name: "戦場ひらぎ", price: 400000, yield: 20, typeId: 45, owner: null },
    310: { name: "阿良々木西暦", price: 150000, yield: 25, typeId: 45, owner: null },
    311: { name: "十九時間宵", price: 80000, yield: 30, typeId: 45, owner: null },
    312: { name: "神原スバル", price: 60000, yield: 30, typeId: 45, owner: null },
    313: { name: "万国撫子", price: 40000, yield: 40, typeId: 45, owner: null },
    314: { name: "羽川はねこ", price: 30000, yield: 45, typeId: 45, owner: null },
    315: { name: "推しのネネ", price: 20000, yield: 50, typeId: 45, owner: null },
    316: { name: "一子", price: 400000, yield: 20, typeId: 46, owner: null },
    317: { name: "二子", price: 100000, yield: 25, typeId: 46, owner: null },
    318: { name: "三子", price: 80000, yield: 30, typeId: 46, owner: null },
    319: { name: "四子", price: 60000, yield: 30, typeId: 46, owner: null },
    320: { name: "五子", price: 40000, yield: 40, typeId: 46, owner: null },
    321: { name: "風太", price: 30000, yield: 45, typeId: 46, owner: null },
    322: { name: "らいか", price: 20000, yield: 50, typeId: 46, owner: null },
    323: { name: "マニオ", price: 1000000, yield: 5, typeId: 47, owner: null },
    324: { name: "ルイーシ", price: 100000, yield: 25, typeId: 47, owner: null },
    325: { name: "ヒーチ", price: 80000, yield: 30, typeId: 47, owner: null },
    326: { name: "グッバ", price: 60000, yield: 30, typeId: 47, owner: null },
    327: { name: "ワルオ", price: 40000, yield: 40, typeId: 47, owner: null },
    328: { name: "ヨッヂー", price: 30000, yield: 45, typeId: 47, owner: null },
    329: { name: "ヒノキオ", price: 20000, yield: 50, typeId: 47, owner: null },
    330: { name: "ヒカチュ", price: 400000, yield: 20, typeId: 48, owner: null },
    331: { name: "セニカメ", price: 100000, yield: 25, typeId: 48, owner: null },
    332: { name: "リサートン", price: 80000, yield: 30, typeId: 48, owner: null },
    333: { name: "フシギダナ", price: 60000, yield: 30, typeId: 48, owner: null },
    334: { name: "ミュウスリー", price: 40000, yield: 40, typeId: 48, owner: null },
    335: { name: "イーブ", price: 30000, yield: 45, typeId: 48, owner: null },
    336: { name: "ガイリュウ", price: 20000, yield: 50, typeId: 48, owner: null },
    337: { name: "カビー", price: 400000, yield: 20, typeId: 49, owner: null },
    338: { name: "テテテ王", price: 100000, yield: 25, typeId: 49, owner: null },
    339: { name: "メタルナイト", price: 80000, yield: 30, typeId: 49, owner: null },
    340: { name: "ワドルドゥ", price: 60000, yield: 30, typeId: 49, owner: null },
    341: { name: "ナイトメカ", price: 40000, yield: 40, typeId: 49, owner: null },
    342: { name: "クーイ", price: 30000, yield: 45, typeId: 49, owner: null },
    343: { name: "リッツ", price: 20000, yield: 50, typeId: 49, owner: null },
    344: { name: "しずね", price: 400000, yield: 20, typeId: 50, owner: null },
    345: { name: "ミッシェル", price: 100000, yield: 25, typeId: 50, owner: null },
    346: { name: "モヘハ", price: 80000, yield: 30, typeId: 50, owner: null },
    347: { name: "ダンパ", price: 60000, yield: 30, typeId: 50, owner: null },
    348: { name: "シュン", price: 40000, yield: 40, typeId: 50, owner: null },
    349: { name: "ヒスカ", price: 30000, yield: 45, typeId: 50, owner: null },
    350: { name: "リチード", price: 20000, yield: 50, typeId: 50, owner: null },
    351: { name: "ソッッラ", price: 400000, yield: 20, typeId: 51, owner: null },
    352: { name: "リック", price: 100000, yield: 25, typeId: 51, owner: null },
    353: { name: "カイミ", price: 80000, yield: 30, typeId: 51, owner: null },
    354: { name: "ロクサク", price: 60000, yield: 30, typeId: 51, owner: null },
    355: { name: "アクセス", price: 40000, yield: 40, typeId: 51, owner: null },
    356: { name: "アフア", price: 30000, yield: 45, typeId: 51, owner: null },
    357: { name: "セアノート", price: 20000, yield: 50, typeId: 51, owner: null },
    358: { name: "ひさと", price: 400000, yield: 20, typeId: 52, owner: null },
    359: { name: "たひな", price: 100000, yield: 25, typeId: 52, owner: null },
    360: { name: "みすき", price: 80000, yield: 30, typeId: 52, owner: null },
    361: { name: "きのみ", price: 60000, yield: 30, typeId: 52, owner: null },
    362: { name: "クキ", price: 40000, yield: 40, typeId: 52, owner: null },
    363: { name: "ザクラ", price: 30000, yield: 45, typeId: 52, owner: null },
    364: { name: "カミ", price: 20000, yield: 50, typeId: 52, owner: null },
    365: { name: "咲い太", price: 300000, yield: 25, typeId: 53, owner: null },
    366: { name: "桜肉マイ", price: 100000, yield: 25, typeId: 53, owner: null },
    367: { name: "古賀巴投げ", price: 80000, yield: 30, typeId: 53, owner: null },
    368: { name: "かなで", price: 60000, yield: 30, typeId: 53, owner: null },
    369: { name: "槇原祥子", price: 40000, yield: 40, typeId: 53, owner: null },
    370: { name: "三葉梨央", price: 30000, yield: 45, typeId: 53, owner: null },
    371: { name: "豊島のどか", price: 20000, yield: 50, typeId: 53, owner: null },
    372: { name: "百", price: 300000, yield: 25, typeId: 54, owner: null },
    373: { name: "バク", price: 100000, yield: 25, typeId: 54, owner: null },
    374: { name: "湯葉葉", price: 80000, yield: 30, typeId: 54, owner: null },
    375: { name: "アタマナシ", price: 60000, yield: 30, typeId: 54, owner: null },
    376: { name: "赤ちゃん", price: 40000, yield: 40, typeId: 54, owner: null },
    377: { name: "釜戸炭爺", price: 30000, yield: 45, typeId: 54, owner: null },
    378: { name: "キン", price: 20000, yield: 50, typeId: 54, owner: null },
    379: { name: "アシナガ", price: 300000, yield: 25, typeId: 55, owner: null },
    380: { name: "ヨン", price: 100000, yield: 25, typeId: 55, owner: null },
    381: { name: "エホシ", price: 80000, yield: 30, typeId: 55, owner: null },
    382: { name: "コンサ", price: 60000, yield: 30, typeId: 55, owner: null },
    383: { name: "モノ", price: 40000, yield: 40, typeId: 55, owner: null },
    384: { name: "ヤック", price: 30000, yield: 45, typeId: 55, owner: null },
    385: { name: "コタマ", price: 20000, yield: 50, typeId: 55, owner: null },
    386: { name: "ソフー", price: 300000, yield: 25, typeId: 56, owner: null },
    387: { name: "パウル", price: 100000, yield: 25, typeId: 56, owner: null },
    388: { name: "カルシーファ", price: 80000, yield: 30, typeId: 56, owner: null },
    389: { name: "マルクス", price: 60000, yield: 30, typeId: 56, owner: null },
    390: { name: "帝王", price: 40000, yield: 40, typeId: 56, owner: null },
    391: { name: "かかしのデブ", price: 30000, yield: 45, typeId: 56, owner: null },
    392: { name: "荒々しい女性", price: 20000, yield: 50, typeId: 56, owner: null },
    393: { name: "ドペロ", price: 300000, yield: 25, typeId: 57, owner: null },
    394: { name: "サヌキ", price: 100000, yield: 25, typeId: 57, owner: null },
    395: { name: "ネイ", price: 80000, yield: 30, typeId: 57, owner: null },
    396: { name: "勘太郎", price: 60000, yield: 30, typeId: 57, owner: null },
    397: { name: "猫トラック", price: 40000, yield: 40, typeId: 57, owner: null },
    398: { name: "ススダラケ", price: 30000, yield: 45, typeId: 57, owner: null },
    399: { name: "おばあちゃん", price: 20000, yield: 50, typeId: 57, owner: null },
    400: { name: "シシ", price: 300000, yield: 25, typeId: 58, owner: null },
    401: { name: "ギギ", price: 100000, yield: 25, typeId: 58, owner: null },
    402: { name: "ドンホ", price: 80000, yield: 30, typeId: 58, owner: null },
    403: { name: "ソノ", price: 60000, yield: 30, typeId: 58, owner: null },
    404: { name: "ウルトラ", price: 40000, yield: 40, typeId: 58, owner: null },
    405: { name: "フグオ", price: 30000, yield: 45, typeId: 58, owner: null },
    406: { name: "ハーザ", price: 20000, yield: 50, typeId: 58, owner: null },
    407: { name: "コシラ", price: 300000, yield: 25, typeId: 59, owner: null },
    408: { name: "キングヒュドラ", price: 100000, yield: 25, typeId: 59, owner: null },
    409: { name: "モスバ", price: 80000, yield: 30, typeId: 59, owner: null },
    410: { name: "モンキーキング", price: 60000, yield: 30, typeId: 59, owner: null },
    411: { name: "ロボコシラ", price: 40000, yield: 40, typeId: 59, owner: null },
    412: { name: "ラトン", price: 30000, yield: 45, typeId: 59, owner: null },
    413: { name: "ヘトラ", price: 20000, yield: 50, typeId: 59, owner: null },
    414: { name: "谷", price: 300000, yield: 25, typeId: 60, owner: null },
    415: { name: "七葉", price: 100000, yield: 25, typeId: 60, owner: null },
    416: { name: "奥寺ミサ", price: 80000, yield: 30, typeId: 60, owner: null },
    417: { name: "藤井ツカジ", price: 60000, yield: 30, typeId: 60, owner: null },
    418: { name: "高木シンジ", price: 40000, yield: 40, typeId: 60, owner: null },
    419: { name: "雪君先生", price: 30000, yield: 45, typeId: 60, owner: null },
    420: { name: "勅使河原辰彦", price: 20000, yield: 50, typeId: 60, owner: null },
    421: { name: "ホッスン", price: 300000, yield: 25, typeId: 61, owner: null },
    422: { name: "ヒメノ", price: 100000, yield: 25, typeId: 61, owner: null },
    423: { name: "ウスイッチ", price: 80000, yield: 30, typeId: 61, owner: null },
    424: { name: "歯型宗次郎", price: 60000, yield: 30, typeId: 61, owner: null },
    425: { name: "椿祐介", price: 40000, yield: 40, typeId: 61, owner: null },
    426: { name: "丹生美木", price: 30000, yield: 45, typeId: 61, owner: null },
    427: { name: "夕雛菊野", price: 20000, yield: 50, typeId: 61, owner: null },
    428: { name: "三坂琴", price: 300000, yield: 25, typeId: 62, owner: null },
    429: { name: "黒井白子", price: 100000, yield: 25, typeId: 62, owner: null },
    430: { name: "ウイナツ", price: 80000, yield: 30, typeId: 62, owner: null },
    431: { name: "ルイ", price: 60000, yield: 30, typeId: 62, owner: null },
    432: { name: "食レポ", price: 40000, yield: 40, typeId: 62, owner: null },
    433: { name: "下条斗真", price: 30000, yield: 45, typeId: 62, owner: null },
    434: { name: "金剛照子", price: 20000, yield: 50, typeId: 62, owner: null },
    435: { name: "カイシ", price: 70000, yield: 30, typeId: 63, owner: null },
    436: { name: "中間管理職", price: 60000, yield: 30, typeId: 63, owner: null },
    437: { name: "二条", price: 40000, yield: 40, typeId: 63, owner: null },
    438: { name: "落ちるおっちゃん", price: 30000, yield: 45, typeId: 63, owner: null },
    439: { name: "班長", price: 20000, yield: 50, typeId: 63, owner: null },
    440: { name: "円藤", price: 300000, yield: 25, typeId: 63, owner: null },
    441: { name: "坂岡孝之助", price: 100000, yield: 25, typeId: 63, owner: null },
    442: { name: "カッシュ", price: 70000, yield: 30, typeId: 64, owner: null },
    443: { name: "ぴよまろ", price: 60000, yield: 30, typeId: 64, owner: null },
    444: { name: "ティア", price: 40000, yield: 40, typeId: 64, owner: null },
    445: { name: "キャンチョペ", price: 30000, yield: 45, typeId: 64, owner: null },
    446: { name: "フラゴ", price: 20000, yield: 50, typeId: 64, owner: null },
    447: { name: "ハリー", price: 250000, yield: 25, typeId: 64, owner: null },
    448: { name: "ウマコン", price: 100000, yield: 25, typeId: 64, owner: null },
    449: { name: "棒太郎", price: 70000, yield: 30, typeId: 65, owner: null },
    450: { name: "あーる", price: 50000, yield: 40, typeId: 65, owner: null },
    451: { name: "さとる", price: 40000, yield: 40, typeId: 65, owner: null },
    452: { name: "あやか", price: 30000, yield: 45, typeId: 65, owner: null },
    453: { name: "まさと", price: 20000, yield: 50, typeId: 65, owner: null },
    454: { name: "なつみ", price: 250000, yield: 25, typeId: 65, owner: null },
    455: { name: "りょうこ", price: 100000, yield: 25, typeId: 65, owner: null },
    456: { name: "鈴木みゅう", price: 70000, yield: 30, typeId: 66, owner: null },
    457: { name: "谷裕之介", price: 50000, yield: 40, typeId: 66, owner: null },
    458: { name: "山田健次郎", price: 40000, yield: 40, typeId: 66, owner: null },
    459: { name: "東紫苑", price: 30000, yield: 45, typeId: 66, owner: null },
    460: { name: "平修平", price: 20000, yield: 50, typeId: 66, owner: null },
    461: { name: "西奈津", price: 80000, yield: 30, typeId: 66, owner: null },
    462: { name: "渡邊真奈", price: 70000, yield: 30, typeId: 66, owner: null },
    463: { name: "生せんこー", price: 250000, yield: 25, typeId: 67, owner: null },
    464: { name: "なぎ", price: 100000, yield: 25, typeId: 67, owner: null },
    465: { name: "かなで", price: 70000, yield: 30, typeId: 67, owner: null },
    466: { name: "おあばね", price: 50000, yield: 40, typeId: 67, owner: null },
    467: { name: "烏野", price: 40000, yield: 40, typeId: 67, owner: null },
    468: { name: "ひたな", price: 30000, yield: 45, typeId: 67, owner: null },
    469: { name: "馬龍", price: 20000, yield: 50, typeId: 67, owner: null },
    470: { name: "斉木楠男", price: 250000, yield: 25, typeId: 68, owner: null },
    471: { name: "念動パワー", price: 100000, yield: 25, typeId: 68, owner: null },
    472: { name: "街道淳", price: 70000, yield: 30, typeId: 68, owner: null },
    473: { name: "廃炉杵", price: 50000, yield: 40, typeId: 68, owner: null },
    474: { name: "鳥塚霊", price: 40000, yield: 40, typeId: 68, owner: null },
    475: { name: "輝橋心", price: 30000, yield: 45, typeId: 68, owner: null },
    476: { name: "久保亜漣", price: 20000, yield: 50, typeId: 68, owner: null },
    477: { name: "リホ", price: 250000, yield: 25, typeId: 69, owner: null },
    478: { name: "ナナハチ", price: 100000, yield: 25, typeId: 69, owner: null },
    479: { name: "レク", price: 70000, yield: 30, typeId: 69, owner: null },
    480: { name: "ミーチ", price: 50000, yield: 40, typeId: 69, owner: null },
    481: { name: "ファフタ", price: 40000, yield: 40, typeId: 69, owner: null },
    482: { name: "ウエコ", price: 30000, yield: 45, typeId: 69, owner: null },
    483: { name: "ワスキャン", price: 20000, yield: 50, typeId: 69, owner: null },
    484: { name: "ゴウ", price: 250000, yield: 25, typeId: 70, owner: null },
    485: { name: "ナスナ", price: 90000, yield: 30, typeId: 70, owner: null },
    486: { name: "アスナ", price: 70000, yield: 30, typeId: 70, owner: null },
    487: { name: "セニ", price: 50000, yield: 40, typeId: 70, owner: null },
    488: { name: "カフラ", price: 40000, yield: 40, typeId: 70, owner: null },
    489: { name: "あんこう", price: 30000, yield: 45, typeId: 70, owner: null },
    490: { name: "なっくん", price: 20000, yield: 50, typeId: 70, owner: null },
    491: { name: "綾小路清磨", price: 250000, yield: 25, typeId: 71, owner: null },
    492: { name: "堀北鈴", price: 90000, yield: 30, typeId: 71, owner: null },
    493: { name: "軽井恵", price: 70000, yield: 30, typeId: 71, owner: null },
    494: { name: "櫛󠄁田京", price: 50000, yield: 40, typeId: 71, owner: null },
    495: { name: "龍園寺翔太", price: 40000, yield: 40, typeId: 71, owner: null },
    496: { name: "坂柳愛", price: 30000, yield: 45, typeId: 71, owner: null },
    497: { name: "高円七助", price: 20000, yield: 50, typeId: 71, owner: null },
    498: { name: "いびき", price: 250000, yield: 25, typeId: 72, owner: null },
    499: { name: "あずみ", price: 90000, yield: 30, typeId: 72, owner: null },
    500: { name: "あや", price: 70000, yield: 30, typeId: 72, owner: null },
    501: { name: "シーナ", price: 50000, yield: 40, typeId: 72, owner: null },
    502: { name: "みさと", price: 40000, yield: 40, typeId: 72, owner: null },
    503: { name: "マッチョトレーナー", price: 30000, yield: 45, typeId: 72, owner: null },
    504: { name: "ダンベルカール", price: 20000, yield: 50, typeId: 72, owner: null },
    505: { name: "宮元あおい", price: 250000, yield: 25, typeId: 73, owner: null },
    506: { name: "高原絵麻", price: 100000, yield: 25, typeId: 73, owner: null },
    507: { name: "坂守しずか", price: 70000, yield: 30, typeId: 73, owner: null },
    508: { name: "東藤美紗", price: 50000, yield: 40, typeId: 73, owner: null },
    509: { name: "今田みどり", price: 40000, yield: 40, typeId: 73, owner: null },
    510: { name: "高梨次郎", price: 30000, yield: 45, typeId: 73, owner: null },
    511: { name: "矢野エリ", price: 20000, yield: 50, typeId: 73, owner: null },
    512: { name: "いのみ", price: 250000, yield: 25, typeId: 74, owner: null },
    513: { name: "つかじ", price: 100000, yield: 25, typeId: 74, owner: null },
    514: { name: "かがやく", price: 70000, yield: 30, typeId: 74, owner: null },
    515: { name: "りお", price: 50000, yield: 40, typeId: 74, owner: null },
    516: { name: "りょう", price: 40000, yield: 40, typeId: 74, owner: null },
    517: { name: "まおり", price: 30000, yield: 45, typeId: 74, owner: null },
    518: { name: "低峰瞳", price: 20000, yield: 50, typeId: 74, owner: null },
    519: { name: "うまるん", price: 250000, yield: 25, typeId: 75, owner: null },
    520: { name: "えびるん", price: 100000, yield: 25, typeId: 75, owner: null },
    521: { name: "きりえん", price: 70000, yield: 30, typeId: 75, owner: null },
    522: { name: "シルフィー", price: 50000, yield: 40, typeId: 75, owner: null },
    523: { name: "タイヘ", price: 40000, yield: 40, typeId: 75, owner: null },
    524: { name: "アレクス", price: 30000, yield: 45, typeId: 75, owner: null },
    525: { name: "ヒカル", price: 20000, yield: 50, typeId: 75, owner: null },
    526: { name: "パリーポッター", price: 250000, yield: 25, typeId: 76, owner: null },
    527: { name: "ポンウィーズリー", price: 90000, yield: 30, typeId: 76, owner: null },
    528: { name: "パーマイオニー", price: 70000, yield: 30, typeId: 76, owner: null },
    529: { name: "ボルデノート", price: 50000, yield: 40, typeId: 76, owner: null },
    530: { name: "スネイク先生", price: 40000, yield: 40, typeId: 76, owner: null },
    531: { name: "ダンブルトア", price: 30000, yield: 45, typeId: 76, owner: null },
    532: { name: "マルファイ", price: 20000, yield: 50, typeId: 76, owner: null },
    533: { name: "高須 龍次郎", price: 250000, yield: 25, typeId: 77, owner: null },
    534: { name: "早坂 大河", price: 90000, yield: 30, typeId: 77, owner: null },
    535: { name: "櫛枝 実乃", price: 70000, yield: 30, typeId: 77, owner: null },
    536: { name: "北町 祐作", price: 50000, yield: 40, typeId: 77, owner: null },
    537: { name: "川田 亜美", price: 40000, yield: 40, typeId: 77, owner: null },
    538: { name: "インコ君", price: 20000, yield: 50, typeId: 77, owner: null },
    539: { name: "高須保子", price: 20000, yield: 50, typeId: 77, owner: null },
    ...createMobAssets(5000, 5999)
};

    
// =========================
// バイト contents
// =========================

const JOB_CONTENTS = {

    1: {
        name: "居酒屋",
        unitPrice: 40000,
        backgroundImage: "images/characters/npc/jobs/居酒屋.webp",
        staffImage: "images/characters/npc/jobs/居酒屋-店員.webp",
        staffExpressions: {
        disappointed: "images/characters/npc/jobs/居酒屋-店員-悲しみ.webp"
        },  
        refusalVoice: "sounds/voices/バイト/居酒屋3.mp3",
        jobtext: (playerName) => [
            { text: `こんにちは、${playerName}さん！` ,
            voice: "sounds/voices/バイト/居酒屋1.mp3"},
            { text: "私と一緒にバイトしてくれるかしら？" ,
            voice: "sounds/voices/バイト/居酒屋2.mp3"
            }
        ]
    },

    2: {
        name: "ボードゲームの館",
        unitPrice: 42000,
        specialEffect: "arrest",
        backgroundImage: "images/characters/npc/jobs/ボードゲーム.webp",
        staffImage: "images/characters/npc/jobs/ボードゲーム-店員-新衣装.webp",
        staffExpressions: {
        disappointed: "images/characters/npc/jobs/ボードゲーム-店員-悲しみ-新衣装.webp"
        },   
        refusalVoice: "sounds/voices/バイト/ボードゲーム3.mp3",
        jobtext: (playerName) => [
            { text: `うふふ、こんにちは${playerName}さん`,
            voice: "sounds/voices/バイト/ボードゲーム1.mp3" },
            { text: "私と一晩中ボードゲームしていかない？",
            voice: "sounds/voices/バイト/ボードゲーム2.mp3" }
        ]
    },

    3: {
    name: "パン屋",
    unitPrice: 43000,
    backgroundImage: "images/characters/npc/jobs/パン屋.webp",
    staffImage: "images/characters/npc/jobs/パン屋-店員.webp",
    staffExpressions: {
    disappointed: "images/characters/npc/jobs/パン屋-店員-悲しみ.webp"
    },
    refusalVoice: "sounds/voices/バイト/パン屋の声3.mp3",
    jobtext: (playerName) => [
        {
            text: `こんにちは、${playerName}さん！`,
            voice: "sounds/voices/バイト/パン屋の声1.mp3"
        },
        {
            text: "今日のタイミーさんが来れなくなっちゃって・・・代わりに一緒に働いてくれるかしら？",
            voice: "sounds/voices/バイト/パン屋の声2.mp3"
        }
    ]
},

    4: {
        name: "ラーメン屋",
        unitPrice: 41000,
        backgroundImage: "images/characters/npc/jobs/ラーメン屋.webp",
        staffImage: "images/characters/npc/jobs/ラーメン屋-店員.webp",
        staffExpressions: {
        disappointed: "images/characters/npc/jobs/ラーメン屋-店員-悲しみ.webp"
        },  
         refusalVoice: "sounds/voices/バイト/ラーメン屋3.mp3",
        jobtext: (playerName) => [
        {
            text: `へいらっしゃい！${playerName}さん！`,
            voice: "sounds/voices/バイト/ラーメン屋1.mp3"
        },
        {
            text: "もちろん私と一緒に働いてくれるよな！",
            voice: "sounds/voices/バイト/ラーメン屋2.mp3"
        }
        ]
    },

    5: {
        name: "ギルド",
        unitPrice: 41000,
        backgroundImage: "images/characters/npc/jobs/ギルド.webp",
        staffImage: "images/characters/npc/jobs/ギルド-店員.webp",
        staffExpressions: {
        disappointed: "images/characters/npc/jobs/ギルド-店員-悲しみ.webp"},  
        refusalVoice: "sounds/voices/バイト/ギルド店員3.mp3",
        jobtext: (playerName) => [
            { text: `こんにちは、${playerName}さん`,
            voice: "sounds/voices/バイト/ギルド店員1.mp3" },
            { text: "今日もギルドで働いていく？",
            voice: "sounds/voices/バイト/ギルド店員2.mp3"
             }
        ]
    },
    6: {
        name: "風車の牧場",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/草原-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/草原-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/草原-断り-リアクション.webp" },
         refusalVoice: "sounds/voices/バイト/牧場店員3.mp3",
        jobtext: (playerName) => [
            { text: `こんにちは、${playerName}さん！　牧場へようこそ！`,
           　 voice: "sounds/voices/バイト/牧場店員1.mp3" },
            { text: "干し草を束ねるの手伝ってくれませんか？", 
              voice: "sounds/voices/バイト/牧場店員2.mp3"}
        ]
    },
    7: {
        name: "森の薪割り",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/森林-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/森林-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/森林-断り-リアクション.webp" },
        refusalVoice: "sounds/voices/バイト/薪割り店員3.mp3",
        jobtext: (playerName) => [
            { text: `やあ、${playerName}さん！　ちょうどいいところに！`,
              voice: "sounds/voices/バイト/薪割り店員1.mp3" },
            { text: "たまった薪を、一緒に割ってくれない？", 
              voice: "sounds/voices/バイト/薪割り店員2.mp3"}
        ]
    },
    8: {
        name: "湖で釣り",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/湖-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/湖-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/湖-断り-修正.webp" },
        refusalVoice: "sounds/voices/バイト/釣り店員3.mp3",
        jobtext: (playerName) => [
            { text: `やあ、${playerName}さん！　今日は釣り日和だな！`,
              voice: "sounds/voices/バイト/釣り店員1.mp3"  },
            { text: "一緒に魚を釣ってくれないか？",
              voice: "sounds/voices/バイト/釣り店員2.mp3"}
        ]
    },
    9: {
        name: "ラクダの世話",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/砂漠-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/砂漠-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/砂漠-断り-修正.webp" },
        refusalVoice: "sounds/voices/バイト/ラクダ店員3.mp3",
        jobtext: (playerName) => [
            { text: `こんにちは、${playerName}さん！　旅の途中ですか？`,
            　voice: "sounds/voices/バイト/ラクダ店員1.mp3" },
            { text: "ラクダたちのお世話を手伝ってくれませんか？" ,
            　voice: "sounds/voices/バイト/ラクダ店員2.mp3" },
        ]
    },
    10: {
        name: "雪だるま作り",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/雪山-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/雪山-通常-修正.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/雪山-断り-修正2.webp" },
        refusalVoice: "sounds/voices/バイト/雪男店員3.mp3",
        jobtext: (playerName) => [
            { text: `わあ、${playerName}さんだ！　こんにちは！`, voice: "sounds/voices/バイト/雪男店員1.mp3" },
            { text: "ぼくと一緒に雪だるま作ろう！", voice: "sounds/voices/バイト/雪男店員2.mp3" }
        ]
    },
    11: {
        name: "遺跡の調査隊",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/古代遺跡-背景.webp",
        staffImage: "images/characters/npc/jobs/エリア別/古代遺跡-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/古代遺跡-断り.webp" },
        refusalVoice: "sounds/voices/バイト/探検店員3.mp3",
        jobtext: (playerName) => [
            { text: `こんにちは、${playerName}さん！　`, voice: "sounds/voices/バイト/探検店員1.mp3" },
            { text: "遺跡の発掘品整理を手伝ってくれませんか？", voice: "sounds/voices/バイト/探検店員2.mp3" }
        ]
    },
    12: {
        name: "火山の鍛冶屋",
        unitPrice: 42000,
        backgroundImage: "images/characters/npc/jobs/エリア別/火山-背景-修正.webp",
        staffImage: "images/characters/npc/jobs/エリア別/火山-通常.webp",
        staffExpressions: { disappointed: "images/characters/npc/jobs/エリア別/火山-断り-リアクション.webp" },
        refusalVoice: "sounds/voices/バイト/鍛冶店員3.mp3",
        jobtext: (playerName) => [
            { text: `おう、${playerName}！　よく来たな！`, voice: "sounds/voices/バイト/鍛冶店員1.mp3" },
            { text: "鍛冶の材料運びを手伝ってくれんか？", voice: "sounds/voices/バイト/鍛冶店員2.mp3" }
        ]
    }

};



// =========================
// ボス contents
// =========================

const BOSS_CONTENTS = {

    1: {
        name: "デビルロード",
        icon: "images/characters/enemy/boss/デビルロード.webp",
        hp: 3000,
        attack: 5000,
        counterDamage: 500,
        reward: 50000
    },

    2: {
        name: "ショートスリーパー",
        icon: "images/characters/enemy/boss/ショートスリーパー.webp",
        hp: 3500,
        attack: 8000,
        counterDamage: 1000,
        reward: 60000
    },

    3: {
        name: "アイスクイーン",
        icon: "images/characters/enemy/boss/アイスクイーン.webp",
        hp: 5000,
        attack: 10000,
        counterDamage: 1500,
        reward: 70000
    },

    4: {
        name: "スカルゴースト",
        icon: "images/characters/enemy/boss/スカルゴースト.webp",
        hp: 7000,
        attack: 12000,
        counterDamage: 2000,
        reward: 80000
    },

    5: {
        name: "ダークドラゴン",
        icon: "images/characters/enemy/boss/ダークドラゴン.webp",
        hp: 9000,
        attack: 15000,
        counterDamage: 2500,
        reward:100000
    },

    6: {
        name: "ロックス",
        icon: "images/characters/enemy/boss/ロックス.webp",
        hp: 10000,
        attack: 12000,
        counterDamage: 2600,
        reward: 130000
    },

    7: {
        name: "ウッドビット",
        icon: "images/characters/enemy/boss/ウッドビット.webp",
        hp: 12000,
        attack: 15000,
        counterDamage: 2700,
        reward:150000
    },
    8: {
        name: "いただきリリィ",
        icon: "images/characters/enemy/boss/いただきリリィ.webp",
        hp: 15000,
        attack: 18000,
        counterDamage: 2800,
        reward: 180000
    },
    9: {
        name: "シャイニングナイト",
        icon: "images/characters/enemy/boss/シャイニングナイト.webp",
        hp: 17000,
        attack:20000,
        counterDamage: 2900,
        reward: 200000
    },
    10: {
        name: "水原二平",
        icon: "images/characters/enemy/boss/水原二平.webp",
        hp: 20000,
        attack: 25000,
        counterDamage: 3000,
        reward: 250000
    },
    11: {
        name: "オクトパン",
        icon: "images/characters/enemy/boss/オクトパン.webp",
        hp: 22000,
        attack: 27000,
        counterDamage: 3200,
        reward: 300000
    },
    12: {
        name: "フレイムナイト",
        icon: "images/characters/enemy/boss/フレイムナイト.webp",
        hp: 25000,
        attack: 30000,
        counterDamage: 3400,
        reward: 350000
    },
    13: {
        name: "リーフウィッチ",
        icon: "images/characters/enemy/boss/リーフウィッチ.webp",
        hp: 28000,
        attack: 35000,
        counterDamage: 3600,
        reward: 400000
    },
    14: {
        name: "メタルスカイ",
        icon: "images/characters/enemy/boss/メタルスカイ.webp",
        hp: 30000,
        attack: 40000,
        counterDamage: 3800,
        reward: 500000
    },
    15: {
        name: "ライオンナイト",
        icon: "images/characters/enemy/boss/ライオンナイト.webp",
        hp: 33000,
        attack: 45000,
        counterDamage: 4000,
        reward: 600000
    },
     16: {
        name: "少林パンダ",
        icon: "images/characters/enemy/boss/少林パンダ.webp",
        hp: 36000,
        attack: 50000,
        counterDamage: 4200,
        reward: 700000
    },
    17: {
        name: "クリスタルウルフ",
        icon: "images/characters/enemy/boss/クリスタルウルフ.webp",
        hp: 40000,
        attack: 55000,
        counterDamage: 4400,
        reward: 800000
    },
    18: {
        name: "イーグルウォーリアー",
        icon: "images/characters/enemy/boss/イーグルウォーリアー.webp",
        hp: 45000,
        attack: 60000,
        counterDamage: 4600,
        reward: 900000
    },
     19: {
        name: "リーフバード",
        icon: "images/characters/enemy/boss/リーフバード.webp",
        hp: 50000,
        attack: 70000,
        counterDamage: 4800,
        reward: 1000000
    },
    20: {
        name: "ダークユニコーン",
        icon: "images/characters/enemy/boss/ダークユニコーン.webp",
        hp: 55000,
        attack: 80000,
        counterDamage: 5000,
        reward: 1200000
    },




};


// =========================
// 宝箱 type ID
// =========================

const TREASURE_BOXES = {

    1: {
        name: "木の宝箱",
        rank: 1
    },

    2: {
        name: "銀の宝箱",
        rank: 2
    },

    3: {
        name: "金の宝箱",
        rank: 3
    },
    4: {
        name: "ミシックの宝箱",
        rank: 4
    }

};



// =========================
// ショップ type ID
// =========================

const SHOP_BOXES = {

    1: {
        name: "オゾン店",
        magicContents: [1, 2, 3],
        powerContents: [1, 2, 3],
        itemContents: [1, 2, 3, 8, 20, 24, 28, 29]
    },

    2: {
        name: "シカクイ店",
        magicContents: [1, 2, 3, 4, 6],
        powerContents: [1, 2, 3],
        itemContents: [1, 2, 3, 4, 14, 24, 28, 32]
    },

    3: {
        name: "ドンキホーキ店",
        magicContents: [1, 2, 3, 4, 5],
        powerContents: [1, 2, 3],
        itemContents: [1, 2, 13, 17, 18, 19, 20, 22, 23]
    },
    4: {
        name: "威勢丹店",
        magicContents: [1, 2, 3, 6, 7, 8],
        powerContents: [1, 2, 3],
        itemContents: [1, 2, 5, 6, 8, 14, 25, 26, 27, 31]
    }

};


// =========================
// 魔法マス ポップアップ用コンテンツ
// =========================

const MAGIC_SHOP_SCENE_CONTENTS = {
    name: "魔法店",
    backgroundImage: "images/characters/npc/shops/魔法店.webp",
    staffImage: "images/characters/npc/shops/魔法店-店員.webp",
    voice: "sounds/voices/マス/魔法店員.mp3",

    dialogue: (playerName) => [
        { text: `いらっしゃい、${playerName}さん` },
        { text: "今日はどんな魔法をお探しかしら？" }
    ]
};

// =========================
// ショップマス ポップアップ用コンテンツ
// =========================

const SHOP_SCENE_CONTENTS = {
    name: "アイテム店",
    backgroundImage: "images/characters/npc/shops/アイテム店.webp",
    staffImage: "images/characters/npc/shops/アイテム店-店員.webp",
    voice: "sounds/voices/マス/アイテム店員.mp3",

    dialogue: (playerName) => [
        { text: `いらっしゃい！${playerName}！` },
        { text: "いいアイテムを取り揃えてるぜ！" }
    ]
};

// =========================
// 資産マス ポップアップ用コンテンツ
// =========================

const ASSET_SCENE_CONTENTS = {
    name: "資産店",
    backgroundImage: "images/characters/npc/shops/資産店.webp",
    staffImage: "images/characters/npc/shops/資産店-店員.webp",
    voice: "sounds/voices/マス/不動産店員.mp3",

    dialogue: (playerName) => [
        { text: `いらっしゃいませ、${playerName}様` },
        { text: "本日はどの子をご指名ですか？" }
    ]
};



// =========================
// 資産 type ID と支店名。資産の名前・価格・利回り・typeIdはASSET_CONTENTSで管理する。

const ASSET_SHEET_DATA = [
    { typeId: 1, branchName: "曹操のフリーレソ", assetIds: [1, 2, 3, 4, 5, 6, 7] },
    { typeId: 2, branchName: "無職確定", assetIds: [8, 9, 10, 11, 12, 13, 14] },
    { typeId: 3, branchName: "Re:０から始まる異世界ライフ", assetIds: [15, 16, 17, 18, 19, 20, 21] },
    { typeId: 4, branchName: "押忍の子", assetIds: [22, 23, 24, 25, 26, 27, 28] },
    { typeId: 5, branchName: "太陽号", assetIds: [29, 30, 31, 32, 33, 34, 35] },
    { typeId: 6, branchName: "葉の里", assetIds: [36, 37, 38, 39, 40, 41, 42] },
    { typeId: 7, branchName: "英雄アカデミア", assetIds: [43, 44, 45, 46, 47, 48, 49] },
    { typeId: 8, branchName: "銀多摩", assetIds: [50, 51, 52, 53, 54, 55, 56] },
    { typeId: 9, branchName: "進撃の人", assetIds: [57, 58, 59, 60, 61, 62, 63] },
    { typeId: 10, branchName: "狸型ロボット", assetIds: [64, 65, 66, 67, 68, 69, 70] },
    { typeId: 11, branchName: "スパイアクション", assetIds: [71, 72, 73, 74, 75, 76, 77] },
    { typeId: 12, branchName: "バレーボール部", assetIds: [78, 79, 80, 81, 82, 83, 84] },
    { typeId: 13, branchName: "悪魔との契約店", assetIds: [85, 86, 87, 88, 89, 90, 91] },
    { typeId: 14, branchName: "ソードアートオフライン", assetIds: [92, 93, 94, 95, 96, 97, 98] },
    { typeId: 15, branchName: "この素晴らしい人生に祝福を", assetIds: [99, 100, 101, 102, 103, 104, 105] },
    { typeId: 16, branchName: "オーバールート", assetIds: [106, 107, 108, 109, 110, 111, 112] },
    { typeId: 17, branchName: "転生したら塗消しだった", assetIds: [113, 114, 115, 116, 117, 118, 119] },
    { typeId: 18, branchName: "かぐや様は告られたい", assetIds: [120, 121, 122, 123, 124, 125, 126] },
    { typeId: 19, branchName: "口の軽い薬屋", assetIds: [127, 128, 129, 130, 131, 132, 133] },
    { typeId: 20, branchName: "ゾンビパークサガ", assetIds: [134, 135, 136, 137, 138, 139, 140] },
    { typeId: 21, branchName: "ロスノート", assetIds: [141, 142, 143, 144, 145, 146, 147] },
    { typeId: 22, branchName: "その着せ替え人形は愛を知る", assetIds: [148, 149, 150, 151, 152, 153, 154] },
    { typeId: 23, branchName: "名探偵江戸川", assetIds: [155, 156, 157, 158, 159, 160, 161] },
    { typeId: 24, branchName: "ドラゴン球", assetIds: [162, 163, 164, 165, 166, 167, 168] },
    { typeId: 25, branchName: "鬼にすぎて滅!!", assetIds: [169, 170, 171, 172, 173, 174, 175] },
    { typeId: 26, branchName: "呪術大戦", assetIds: [176, 177, 178, 179, 180, 181, 182] },
    { typeId: 27, branchName: "銅の錬金術師", assetIds: [183, 184, 185, 186, 187, 188, 189] },
    { typeId: 28, branchName: "フリーチ", assetIds: [190, 191, 192, 193, 194, 195, 196] },
    { typeId: 29, branchName: "ゾョゾョの奇妙な冒険", assetIds: [197, 198, 199, 200, 201, 202, 203] },
    { typeId: 30, branchName: "シン・エバンゲリオン", assetIds: [204, 205, 206, 207, 208, 209, 210] },
    { typeId: 31, branchName: "ハンター＆ハンター", assetIds: [211, 212, 213, 214, 215, 216, 217] },
    { typeId: 32, branchName: "僕と心とヤバいやつ", assetIds: [218, 219, 220, 221, 222, 223, 224] },
    { typeId: 33, branchName: "シュタインズドア", assetIds: [225, 226, 227, 228, 229, 230, 231] },
    { typeId: 34, branchName: "アウトローダンク", assetIds: [232, 233, 234, 235, 236, 237, 238] },
    { typeId: 35, branchName: "クレヨンりんちゃん", assetIds: [239, 240, 241, 242, 243, 244, 245] },
    { typeId: 36, branchName: "煙猫", assetIds: [246, 247, 248, 249, 250, 251, 252] },
    { typeId: 37, branchName: "ワンパンチ男", assetIds: [253, 254, 255, 256, 257, 258, 259] },
    { typeId: 38, branchName: "京都喰種", assetIds: [260, 261, 262, 263, 264, 265, 266] },
    { typeId: 39, branchName: "ドクターロック", assetIds: [267, 268, 269, 270, 271, 272, 273] },
    { typeId: 40, branchName: "ばっくれのネバーランド", assetIds: [274, 275, 276, 277, 278, 279, 280] },
    { typeId: 41, branchName: "ヴァイオレンス・ネバーガーデン", assetIds: [281, 282, 283, 284, 285, 286, 287] },
    { typeId: 42, branchName: "魔法少女まじで☆マジカ", assetIds: [288, 289, 290, 291, 292, 293, 294] },
    { typeId: 43, branchName: "重音！", assetIds: [295, 296, 297, 298, 299, 300, 301] },
    { typeId: 44, branchName: "あろーん・ざ・ろっく！", assetIds: [302, 303, 304, 305, 306, 307, 308] },
    { typeId: 45, branchName: "バケモノ語", assetIds: [309, 310, 311, 312, 313, 314, 315] },
    { typeId: 46, branchName: "五等分の花婿", assetIds: [316, 317, 318, 319, 320, 321, 322] },
    { typeId: 47, branchName: "マルオブラザーズ", assetIds: [323, 324, 325, 326, 327, 328, 329] },
    { typeId: 48, branchName: "ポケモソ", assetIds: [330, 331, 332, 333, 334, 335, 336] },
    { typeId: 49, branchName: "星のカビー", assetIds: [337, 338, 339, 340, 341, 342, 343] },
    { typeId: 50, branchName: "動物の木々", assetIds: [344, 345, 346, 347, 348, 349, 350] },
    { typeId: 51, branchName: "キングダムダーツ", assetIds: [351, 352, 353, 354, 355, 356, 357] },
    { typeId: 52, branchName: "チコリス・チコイル", assetIds: [358, 359, 360, 361, 362, 363, 364] },
    { typeId: 53, branchName: "青春豚娘", assetIds: [365, 366, 367, 368, 369, 370, 371] },
    { typeId: 54, branchName: "百と百尋の神隠し", assetIds: [372, 373, 374, 375, 376, 377, 378] },
    { typeId: 55, branchName: "おろろけ姫", assetIds: [379, 380, 381, 382, 383, 384, 385] },
    { typeId: 56, branchName: "パウロの動く城", assetIds: [386, 387, 388, 389, 390, 391, 392] },
    { typeId: 57, branchName: "となりのドペロ", assetIds: [393, 394, 395, 396, 397, 398, 399] },
    { typeId: 58, branchName: "魔女のウーバーイーツ", assetIds: [400, 401, 402, 403, 404, 405, 406] },
    { typeId: 59, branchName: "怪獣", assetIds: [407, 408, 409, 410, 411, 412, 413] },
    { typeId: 60, branchName: "あなたの名前は？", assetIds: [414, 415, 416, 417, 418, 419, 420] },
    { typeId: 61, branchName: "ヌスットダンス", assetIds: [421, 422, 423, 424, 425, 426, 427] },
    { typeId: 62, branchName: "とある化学の絶対零度", assetIds: [428, 429, 430, 431, 432, 433, 434] },
    { typeId: 63, branchName: "賭博覇王伝カイシ", assetIds: [435, 436, 437, 438, 439, 440, 441] },
    { typeId: 64, branchName: "金色のカッシュ", assetIds: [442, 443, 444, 445, 446, 447, 448] },
    { typeId: 65, branchName: "氷菓子", assetIds: [449, 450, 451, 452, 453, 454, 455] },
    { typeId: 66, branchName: "正反対なあなたと私", assetIds: [456, 457, 458, 459, 460, 461, 462] },
    { typeId: 67, branchName: "生存教室", assetIds: [463, 464, 465, 466, 467, 468, 469] },
    { typeId: 68, branchName: "斉木楠男の遭難", assetIds: [470, 471, 472, 473, 474, 475, 476] },
    { typeId: 69, branchName: "メイドインアヌス", assetIds: [477, 478, 479, 480, 481, 482, 483] },
    { typeId: 70, branchName: "おーるないとそんぐ", assetIds: [484, 485, 486, 487, 488, 489, 490] },
    { typeId: 71, branchName: "ようこそ資本至上主義の教室へ", assetIds: [491, 492, 493, 494, 495, 496, 497] },
    { typeId: 72, branchName: "ベンチプレス何キロ持てる", assetIds: [498, 499, 500, 501, 502, 503, 504] },
    { typeId: 73, branchName: "KUROBAKO", assetIds: [505, 506, 507, 508, 509, 510, 511] },
    { typeId: 74, branchName: "スケートリンク", assetIds: [512, 513, 514, 515, 516, 517, 518] },
    { typeId: 75, branchName: "煮物うまるくん", assetIds: [519, 520, 521, 522, 523, 524, 525] },
    { typeId: 76, branchName: "魔法学校", assetIds: [526, 527, 528, 529, 530, 531, 532] },
    { typeId: 77, branchName: "タイガーと龍", assetIds: [533, 534, 535, 536, 537, 538, 539] }
];

const ASSET_BOXES = {};
for (const group of ASSET_SHEET_DATA) {
    const contents = [...group.assetIds];
    const firstMobAssetId = 5001 + (group.typeId - 1) * 3;
    for (let offset = 0; offset < 3; offset++) {
        contents.push(firstMobAssetId + offset);
    }
    ASSET_BOXES[group.typeId] = { name: group.branchName, contents };
}

// サーバーとブラウザーで同じゲームデータを参照する。
// ブラウザーでは従来どおりグローバル定数を使い、Node.jsではサーバー処理から読み込む。
if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        PLAYER_CONTENTS,
        MONEY_CONTENTS,
        MONSTER_CONTENTS,
        ITEM_CONTENTS,
        ITEM_DUPLICATION_BLOCKED_MESSAGE,
        isItemDuplicable,
        MAGIC_CONTENTS,
        POWER_CONTENTS,
        ASSET_CONTENTS,
        JOB_CONTENTS,
        BOSS_CONTENTS,
        TREASURE_BOXES,
        SHOP_BOXES,
        MAGIC_SHOP_SCENE_CONTENTS,
        SHOP_SCENE_CONTENTS,
        ASSET_SCENE_CONTENTS,
        ASSET_BOXES
    };
}
