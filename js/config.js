// config.js - 全局配置常量
window.GameConfig = {
    // ========== 世界地图配置 ==========
    WORLD_WIDTH: 3200,
    WORLD_HEIGHT: 1800,
    GRID_SIZE: 40,

    // ========== 玩家配置 ==========
    player: {
        initX: 150,
        initY: 900,
        size: 22,
        speed: 2.8,
        color: '#ffdd00',
        maxHp: 100,
        // 初始资源
        initResources: {
            hp: 100,
            crystal: 0,
            food: 5,
            ammo: 60,
            core: 0,
            strongCore: 0,
            ore: 0,
            highOre: 0,
            electric: 0,
            medkit: 2,
            bandage: 0
        }
    },

    // ========== 战斗配置 ==========
    combat: {
        shootCooldown: 18,
        bulletSpeed: 7,
        bulletSize: 6,
        bulletColor: '#00d4ff',
        // 怪物基础属性
        monster: {
            size: 18,
            baseSpeed: 0.7,
            speedRandom: 0.5,
            color: '#ff2222',
            baseHp: 2,
            damage: 8,
            damageCD: 70,
            spawnMinDist: 180,
            spawnMaxDist: 400
        }
    },

    // ========== 资源提纯配置 ==========
    purify: {
        corePerUnit: 2,
        strongCorePerUnit: 1,
        orePerUnit: 5,
        highOrePerUnit: 2,
        electricPerUnit: 5,
        energyPerCrystal: 100
    },

    // ========== 交互与撤离配置 ==========
    interaction: {
        eventRange: 58,
        endingRange: 150
    },

    escape: {
        crystalGoal: 30,
        chargeDurationFrames: 600,
        waveIntervalFrames: 120,
        wavePulseFrames: 42,
        waveMonsterCount: 1,
        auraRadius: 150,
        monsterSpeedMultiplier: 1.25
    },

    // ========== 区域配置 ==========
    areas: {
        order: ['south', 'industry', 'road', 'mine'],
        names: {
            south: '南部着陆区',
            industry: '城郊工业区',
            road: '中部公路带',
            mine: '北部矿山区'
        }
    },

    // ========== UI 配置 ==========
    ui: {
        minimap: {
            margin: 15,
            width: 240,
            height: 135,
            borderColor: '#00d4ff'
        },
        typeSpeed: 18,
        tipDuration: 2000
    },

    // ========== 预留扩展位 ==========
    extensions: {
        // 物品配置表
        items: {
            // 消耗品（可主动使用）
            medkit: {
                id: 'medkit',
                name: '医疗包',
                type: 'consumable',
                maxStack: 10,
                useEffect: { hp: 50 },
                desc: '使用后恢复50点生命值'
            },
            bandage: {
                id: 'bandage',
                name: '绷带',
                type: 'consumable',
                maxStack: 20,
                useEffect: { hp: 20 },
                desc: '使用后恢复20点生命值'
            },
            food: {
                id: 'food',
                name: '压缩食物',
                type: 'consumable',
                maxStack: 50,
                useEffect: { hp: 5 },
                desc: '食用后恢复少量生命值'
            },
            // 材料类（不可使用，用于提纯）
            ore: { id: 'ore', name: '普通矿石', type: 'material', maxStack: 999 },
            highOre: { id: 'highOre', name: '高纯度矿石', type: 'material', maxStack: 999 },
            core: { id: 'core', name: '普通晶核', type: 'material', maxStack: 999 },
            strongCore: { id: 'strongCore', name: '强化晶核', type: 'material', maxStack: 999 },
            electric: { id: 'electric', name: '电能单元', type: 'material', maxStack: 999 },
            ammo: { id: 'ammo', name: '子弹', type: 'material', maxStack: 999 },
            crystal: { id: 'crystal', name: '星能晶块', type: 'material', maxStack: 999 }
        },
        // 怪物类型配置占位
        monsterTypes: {},
        // 永久建筑配置占位
        buildings: {},
        // 音效配置占位
        audio: {}
    }
};
