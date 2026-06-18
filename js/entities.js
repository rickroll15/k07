// entities.js - 游戏实体模块
window.EntityManager = (function() {
    const Config = window.GameConfig;

    // ========== 实体基类（预留扩展） ==========
    class Entity {
        constructor(x, y, size, color) {
            this.x = x;
            this.y = y;
            this.size = size;
            this.color = color;
        }

        // 碰撞检测通用方法
        checkCollision(other) {
            const dist = Math.sqrt((this.x - other.x) ** 2 + (this.y - other.y) ** 2);
            return dist < (this.size + other.size) / 2;
        }
    }

    // ========== 玩家实体 ==========
    class Player extends Entity {
        constructor() {
            super(
                Config.player.initX,
                Config.player.initY,
                Config.player.size,
                Config.player.color
            );
            this.speed = Config.player.speed;
        }

        // 移动更新
        update(keys) {
            if (keys.w && this.y > 0) this.y -= this.speed;
            if (keys.s && this.y < Config.WORLD_HEIGHT - this.size) this.y += this.speed;
            if (keys.a && this.x > 0) this.x -= this.speed;
            if (keys.d && this.x < Config.WORLD_WIDTH - this.size) this.x += this.speed;
        }

        // 重置到区域入口
        resetToSpawn() {
            this.x = 120;
            this.y = Config.WORLD_HEIGHT / 2;
        }
    }

    // ========== 怪物实体 ==========
    class Monster extends Entity {
        constructor(x, y, type = 'normal') {
            const cfg = Config.combat.monster;
            super(x, y, cfg.size, cfg.color);
            this.speed = cfg.baseSpeed + Math.random() * cfg.speedRandom;
            this.hp = cfg.baseHp;
            this.damageCD = 0;
            this.type = type;
        }

        // AI追踪更新
        update(player) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                this.x += (dx / dist) * this.speed;
                this.y += (dy / dist) * this.speed;
            }
            // 攻击冷却递减
            if (this.damageCD > 0) this.damageCD--;
        }

        // 受到伤害
        takeDamage(damage = 1) {
            this.hp -= damage;
            return this.hp <= 0;
        }
    }

    // ========== 子弹实体 ==========
    class Bullet extends Entity {
        constructor(x, y, angle) {
            super(x, y, Config.combat.bulletSize, Config.combat.bulletColor);
            this.vx = Math.cos(angle) * Config.combat.bulletSpeed;
            this.vy = Math.sin(angle) * Config.combat.bulletSpeed;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            // 返回是否出界
            return this.x < 0 || this.x > Config.WORLD_WIDTH ||
                   this.y < 0 || this.y > Config.WORLD_HEIGHT;
        }
    }

    // ========== 事件点实体 ==========
    class EventPoint extends Entity {
        constructor(id, eventData, x, y) {
            super(x, y, 20, '#ffffff');
            this.id = id;
            this.eventData = eventData;
            this.blinkTimer = Math.random() * 10;
            this.isNearby = false;
        }

        updateBlink() {
            this.blinkTimer += 0.05;
            return Math.sin(this.blinkTimer) * 0.4 + 0.6;
        }
    }

    // ========== 全局实体集合 ==========
    const collections = {
        player: null,
        monsters: [],
        bullets: [],
        eventPoints: [],
        endingPoint: null
    };

    // 初始化玩家
    function initPlayer() {
        collections.player = new Player();
        return collections.player;
    }

    // 生成怪物
    function spawnMonsters(count, playerRef, options = {}) {
        const cfg = Config.combat.monster;
        const mode = options.mode || 'radial';
        const random = options.random || Math.random;
        const speedMultiplier = options.speedMultiplier || 1;
        const directions = [
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 }
        ];

        for (let i = 0; i < count; i++) {
            const dist = cfg.spawnMinDist + random() * (cfg.spawnMaxDist - cfg.spawnMinDist);
            let x;
            let y;
            if (mode === 'cardinal') {
                const direction = directions[Math.floor(random() * directions.length)];
                const lateral = (random() - 0.5) * 40;
                x = playerRef.x + direction.x * dist + (direction.y !== 0 ? lateral : 0);
                y = playerRef.y + direction.y * dist + (direction.x !== 0 ? lateral : 0);
            } else {
                const angle = random() * Math.PI * 2;
                x = playerRef.x + Math.cos(angle) * dist;
                y = playerRef.y + Math.sin(angle) * dist;
            }
            // 限制在世界边界内
            x = Math.max(30, Math.min(Config.WORLD_WIDTH - 30, x));
            y = Math.max(30, Math.min(Config.WORLD_HEIGHT - 30, y));
            const monster = new Monster(x, y);
            monster.speed *= speedMultiplier;
            collections.monsters.push(monster);
        }
    }

    // 发射子弹
    function spawnBullet(playerRef, mouseWorldX, mouseWorldY) {
        const px = playerRef.x + playerRef.size / 2;
        const py = playerRef.y + playerRef.size / 2;
        const angle = Math.atan2(mouseWorldY - py, mouseWorldX - px);
        collections.bullets.push(new Bullet(px - 3, py - 3, angle));
    }

    // 生成事件点
    function buildEventPoints(areaEvents, triggeredIds) {
        collections.eventPoints = [];
        const untriggered = areaEvents.filter(e => !triggeredIds.includes(e.id));
        // 随机洗牌
        untriggered.sort(() => Math.random() - 0.5);
        untriggered.forEach(ev => {
            const x = 300 + Math.random() * (Config.WORLD_WIDTH - 500);
            const y = 150 + Math.random() * (Config.WORLD_HEIGHT - 300);
            collections.eventPoints.push(new EventPoint(ev.id, ev, x, y));
        });
    }

    function restoreEventPoints(areaEvents, triggeredIds, savedPoints) {
        collections.eventPoints = [];
        const savedById = new Map(
            savedPoints
                .filter(point => point && point.id)
                .map(point => [point.id, point])
        );
        const eventById = new Map(areaEvents.map(ev => [ev.id, ev]));
        const untriggered = areaEvents.filter(e => !triggeredIds.includes(e.id));

        savedPoints.forEach(saved => {
            const ev = eventById.get(saved.id);
            if (!ev || triggeredIds.includes(ev.id)) return;

            const x = Number(saved.x);
            const y = Number(saved.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;

            collections.eventPoints.push(new EventPoint(ev.id, ev, x, y));
        });

        if (collections.eventPoints.length !== untriggered.length) {
            buildEventPoints(areaEvents, triggeredIds);
        }
    }

    // 生成撤离点
    function spawnEndingPoint() {
        const blockSize = 18;
        const gap = 4;
        const blockCount = 6;
        const blockColumns = 3;
        const blockRows = 2;
        const width = blockColumns * blockSize + (blockColumns - 1) * gap;
        const height = blockRows * blockSize + (blockRows - 1) * gap;
        collections.endingPoint = {
            x: Config.WORLD_WIDTH / 2 - width / 2,
            y: Config.WORLD_HEIGHT / 2 - height / 2,
            size: blockSize,
            blockSize,
            blockGap: gap,
            blockCount,
            blockColumns,
            blockRows,
            blinkTimer: 0,
            isNearby: false,
            color: '#00ff66'
        };
    }

    function getDistance(a, b) {
        const ax = a.x + (a.size || 0) / 2;
        const ay = a.y + (a.size || 0) / 2;
        const bx = b.x + (b.size || 0) / 2;
        const by = b.y + (b.size || 0) / 2;
        return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
    }

    function getEndingCenter(point) {
        const blockSize = point.blockSize || point.size || 0;
        const blockCount = point.blockCount || 1;
        const blockColumns = point.blockColumns || 1;
        const blockRows = point.blockRows || Math.ceil(blockCount / blockColumns);
        const blockGap = point.blockGap || 0;
        const width = blockColumns * blockSize + (blockColumns - 1) * blockGap;
        const height = blockRows * blockSize + (blockRows - 1) * blockGap;
        return {
            x: point.x + width / 2,
            y: point.y + height / 2
        };
    }

    function findNearbyEventPoint(playerRef) {
        let nearest = null;
        let nearestDistance = Infinity;

        collections.eventPoints.forEach(point => {
            const distance = getDistance(playerRef, point);
            point.isNearby = distance <= Config.interaction.eventRange;
            if (point.isNearby && distance < nearestDistance) {
                nearest = point;
                nearestDistance = distance;
            }
        });

        return nearest;
    }

    function isNearEndingPoint(playerRef) {
        const point = collections.endingPoint;
        if (!point) return false;

        const playerCenter = {
            x: playerRef.x + (playerRef.size || 0) / 2,
            y: playerRef.y + (playerRef.size || 0) / 2
        };
        const endingCenter = getEndingCenter(point);
        point.isNearby = Math.sqrt(
            (playerCenter.x - endingCenter.x) ** 2 +
            (playerCenter.y - endingCenter.y) ** 2
        ) <= Config.interaction.endingRange;
        return point.isNearby;
    }

    // 清空所有实体（切换区域时调用）
    function clearAreaEntities() {
        collections.monsters = [];
        collections.bullets = [];
        collections.eventPoints = [];
    }

    // 预留：精英怪物、道具实体、NPC 扩展接口
    const extensions = {
        EliteMonster: class extends Monster {},
        ItemEntity: class extends Entity {},
        NPC: class extends Entity {}
    };

    return {
        Player,
        Monster,
        Bullet,
        EventPoint,
        collections,
        initPlayer,
        spawnMonsters,
        spawnBullet,
        buildEventPoints,
        restoreEventPoints,
        spawnEndingPoint,
        findNearbyEventPoint,
        isNearEndingPoint,
        clearAreaEntities,
        extensions
    };
})();
