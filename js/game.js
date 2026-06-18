// game.js - 游戏主入口
(function() {
    const Config = window.GameConfig;
    const Input = window.InputManager;
    const Entity = window.EntityManager;
    const Resource = window.ResourceManager;
    const Render = window.RenderManager;
    const Story = window.StoryManager;

    // ========== 基础元素 ==========
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const camera = { x: 0, y: 0 };
    let shootCooldown = 0;

    // ========== 自适应画布 ==========
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ========== 构建当前区域地图 ==========
    function buildCurrentAreaMap() {
        Entity.clearAreaEntities();
        const areaEvents = window.gameEvents[Resource.gameState.progress.currentArea];
        Entity.buildEventPoints(areaEvents, Resource.gameState.progress.triggeredEvents);
        
        // 玩家重置到入口
        Entity.collections.player.resetToSpawn();
        camera.x = 0;
        camera.y = Config.WORLD_HEIGHT / 2 - canvas.height / 2;
        Input.updateCamera(camera);
    }

    // ========== 相机跟随更新 ==========
    function updateCamera() {
        const player = Entity.collections.player;
        camera.x = player.x - canvas.width / 2 + player.size / 2;
        camera.y = player.y - canvas.height / 2 + player.size / 2;
        // 边界限制
        camera.x = Math.max(0, Math.min(Config.WORLD_WIDTH - canvas.width, camera.x));
        camera.y = Math.max(0, Math.min(Config.WORLD_HEIGHT - canvas.height, camera.y));
    }

    // ========== 战斗逻辑更新 ==========
    function updateCombat() {
        const player = Entity.collections.player;
        const state = Resource.gameState;

        // 射击冷却递减
        if (shootCooldown > 0) shootCooldown--;

        // 射击判定
        if (Input.mouse.down && shootCooldown === 0 && state.player.ammo > 0) {
            Entity.spawnBullet(player, Input.mouse.worldX, Input.mouse.worldY);
            shootCooldown = Config.combat.shootCooldown;
            state.player.ammo--;
            Resource.updateStatusBar();
        }
    }

    // ========== 子弹更新与碰撞检测 ==========
    function updateBullets() {
        const bullets = Entity.collections.bullets;
        const monsters = Entity.collections.monsters;
        const state = Resource.gameState;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            const outOfBounds = b.update();
            if (outOfBounds) {
                bullets.splice(i, 1);
                continue;
            }
            // 命中检测
            for (let j = monsters.length - 1; j >= 0; j--) {
                const m = monsters[j];
                if (b.checkCollision(m)) {
                    const isDead = m.takeDamage(1);
                    bullets.splice(i, 1);
                    if (isDead) {
                        monsters.splice(j, 1);
                        state.player.core++;
                        Resource.updateStatusBar();
                        Resource.showTip('击杀丧尸，获得晶核 ×1');
                    }
                    break;
                }
            }
        }
    }

    // ========== 怪物更新与碰撞检测 ==========
    function updateMonsters() {
        const player = Entity.collections.player;
        const monsters = Entity.collections.monsters;
        const state = Resource.gameState;
        const damage = Config.combat.monster.damage;
        const damageCD = Config.combat.monster.damageCD;

        monsters.forEach(mon => {
            mon.update(player);
            // 攻击判定
            if (mon.checkCollision(player) && mon.damageCD === 0) {
                state.player.hp -= damage;
                mon.damageCD = damageCD;
                Resource.updateStatusBar();
                Resource.showTip(`被丧尸攻击！生命值 -${damage}`);
                if (state.player.hp <= 0) {
                    Story.gameOver();
                }
            }
        });
    }

    // ========== 事件碰撞检测 ==========
    function checkEventCollision() {
        if (Resource.gameState.story.inTransition) return;
        const player = Entity.collections.player;
        const nearbyEvent = Entity.findNearbyEventPoint(player);
        const nearEndingPoint = Entity.isNearEndingPoint(player);

        Resource.setNearbyEventPoint(nearbyEvent);
        Resource.setNearEndingPoint(nearEndingPoint);
        if (!Resource.dom.optionArea || Resource.dom.optionArea.style.display !== 'flex') {
            Resource.gameState.story.canPressF = !!(nearbyEvent || nearEndingPoint);
        }

        if (Resource.gameState.escape.isCharging) {
            const result = Resource.updateEscapeCharge();
            if (result.wave) {
                Resource.showTip('能量波动增强，怪物被吸引过来了');
                Entity.spawnMonsters(Config.escape.waveMonsterCount, player, {
                    mode: 'cardinal',
                    speedMultiplier: Config.escape.monsterSpeedMultiplier
                });
            }
            if (result.completed) {
                Story.showEnding();
            }
        }
    }

    // ========== 输入事件绑定 ==========
    function bindGameInput() {
        Input.bindInput(canvas, camera);

        // 键盘特殊按键逻辑
        document.addEventListener('keydown', (e) => {
            const state = Resource.gameState;
            const k = e.key.toLowerCase();

            if ((e.ctrlKey || e.metaKey) && k === 's') {
                e.preventDefault();
                Resource.saveGame();
                return;
            }

            if (k === 'l') {
                Resource.loadGame();
                updateCamera();
                Input.updateCamera(camera);
                return;
            }

            // F 键确认
            if (k === 'f' && state.story.canPressF) {
                if (state.story.isGameOver) {
                    Resource.restartGame();
                    return;
                }

                if (state.story.inTransition) {
                    state.story.canPressF = false;
                    Resource.dom.continueTip.style.display = 'none';
                    state.story.inTransition = false;
                    buildCurrentAreaMap();
                    state.story.lockMove = false;
                    Resource.hideStoryPanel();
                    Resource.saveGame(true);
                } else if (state.interaction.nearbyEventPoint) {
                    state.story.canPressF = false;
                    Resource.dom.continueTip.style.display = 'none';
                    const point = state.interaction.nearbyEventPoint;
                    const index = Entity.collections.eventPoints.indexOf(point);
                    if (index >= 0) {
                        Entity.collections.eventPoints.splice(index, 1);
                    }
                    Resource.setNearbyEventPoint(null);
                    Story.triggerMapEvent(point.eventData);
                } else if (state.interaction.nearEndingPoint) {
                    state.story.canPressF = false;
                    Resource.dom.continueTip.style.display = 'none';
                    Resource.startEscapeCharge();
                } else if (state.progress.triggeredCount === 0 && Entity.collections.eventPoints.length === 0) {
                    state.story.canPressF = false;
                    Resource.dom.continueTip.style.display = 'none';
                    buildCurrentAreaMap();
                    state.story.lockMove = false;
                    Resource.hideStoryPanel();
                    Resource.saveGame(true);
                }
            }

            if (state.story.isGameOver) return;

            // 数字键选选项
            if (Resource.dom.optionArea.style.display === 'flex') {
                const num = parseInt(e.key);
                if (num >= 1 && num <= state.story.currentOptions.length) {
                    Story.selectOption(num - 1);
                }
            }
			if (k === 'b') {
			        Resource.toggleInventory();
			    }
        });
    }

    // ========== 主游戏循环 ==========
    function gameLoop() {
        const state = Resource.gameState;

        // 非锁定状态更新逻辑
        if (!state.story.lockMove && !state.story.isGameOver) {
            Entity.collections.player.update(Input.keys);
            updateCombat();
            updateBullets();
            updateMonsters();
            checkEventCollision();
            updateCamera();
        }

        // 渲染
        Render.render();
        requestAnimationFrame(gameLoop);
    }
 
    // ========== 游戏初始化 ==========
    function initGame() {
        // 初始化各模块
        Resource.initDom();
        Resource.initProgress();
        Entity.initPlayer();
        Render.init(ctx, camera);
        bindGameInput();

        const hasSave = Resource.loadGame(true);
        if (hasSave) {
            updateCamera();
            Input.updateCamera(camera);
            Resource.showTip('已自动读取上次存档');
        } else {
            Resource.initInventory();
            Resource.updateStatusBar();
            Story.showOpening();
        }
        // 启动主循环
        gameLoop();
    }

    // 页面加载完成启动
    window.onload = initGame;
})();
