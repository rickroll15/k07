// resource.js - 资源与状态管理模块
window.ResourceManager = (function() {
    const Config = window.GameConfig;
    const SAVE_KEY = 'waste-star-k07-save-v1';
    const SAVE_VERSION = 1;
    const BACKPACK_ORDER = ['food', 'ammo', 'medkit', 'bandage', 'crystal', 'ore', 'highOre', 'core', 'strongCore', 'electric'];

    // ========== DOM 元素缓存 ==========
    const dom = {};

    // ========== 游戏核心状态 ==========
    const gameState = {
		inventory: [],
        player: { ...Config.player.initResources },
        progress: {
            triggeredEvents: [],
            currentArea: Config.areas.order[0],
            triggeredCount: 0,
            halfCount: 0 // 初始化时计算
        },
        story: {
            currentOptions: [],
            isGameOver: false,
            lockMove: true,
            inTransition: false,
            canPressF: false
        },
        interaction: {
            nearbyEventPoint: null,
            nearEndingPoint: false
        },
        escape: {
            isCharging: false,
            charge: 0,
            waveTimer: 0,
            wavePulse: 0,
            completed: false
        },
        // 预留：永久解锁内容、存档数据、道具背包
        extensions: {
            unlockedBuildings: [],
            inventory: [],
            achievements: []
        },
		 
    };

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getStorage() {
        try {
            return window.localStorage || null;
        } catch (err) {
            return null;
        }
    }

    function normalizeInventory(items) {
        if (!Array.isArray(items)) return [];

        return items
            .filter(item => item && Config.extensions.items[item.id])
            .map(item => {
                const itemConfig = Config.extensions.items[item.id];
                const count = Math.max(0, Math.min(Number(item.count) || 0, itemConfig.maxStack));
                return { id: item.id, count };
            })
            .filter(item => item.count > 0);
    }

    function buildInventoryFromPlayer() {
        return BACKPACK_ORDER
            .filter(itemId => Config.extensions.items[itemId] && gameState.player.hasOwnProperty(itemId))
            .map(itemId => {
                const itemConfig = Config.extensions.items[itemId];
                const count = Math.max(0, Math.min(Number(gameState.player[itemId]) || 0, itemConfig.maxStack));
                return { id: itemId, count };
            })
            .filter(item => item.count > 0);
    }

    function syncInventoryFromPlayer() {
        gameState.inventory = buildInventoryFromPlayer();
    }

    function getEffectCosts(effect = {}) {
        return Object.entries(effect)
            .filter(([key, value]) =>
                gameState.player.hasOwnProperty(key) &&
                typeof value === 'number' &&
                value < 0
            )
            .map(([key, value]) => ({ id: key, count: Math.abs(value) }));
    }

    function canAffordEffect(effect = {}) {
        return getEffectCosts(effect).every(cost => (gameState.player[cost.id] || 0) >= cost.count);
    }

    function describeEffectCosts(effect = {}) {
        return getEffectCosts(effect)
            .map(cost => {
                const item = Config.extensions.items[cost.id];
                const name = item ? item.name : cost.id;
                return `${name} ×${cost.count}`;
            })
            .join('、');
    }

    function createSaveSnapshot() {
        const Entity = window.EntityManager;
        const playerEntity = Entity && Entity.collections.player
            ? {
                x: Entity.collections.player.x,
                y: Entity.collections.player.y
            }
            : null;
        const eventPoints = Entity
            ? Entity.collections.eventPoints.map(point => ({
                id: point.id,
                x: point.x,
                y: point.y
            }))
            : [];

        return {
            version: SAVE_VERSION,
            savedAt: new Date().toISOString(),
            player: deepClone(gameState.player),
            inventory: buildInventoryFromPlayer(),
            progress: {
                triggeredEvents: [...gameState.progress.triggeredEvents],
                currentArea: gameState.progress.currentArea,
                triggeredCount: gameState.progress.triggeredCount,
                halfCount: gameState.progress.halfCount
            },
            story: {
                isGameOver: gameState.story.isGameOver
            },
            escape: deepClone(gameState.escape),
            extensions: deepClone(gameState.extensions),
            playerEntity,
            eventPoints,
            hasEndingPoint: !!(Entity && Entity.collections.endingPoint)
        };
    }

    function setEscapeReadyForTest() {
        gameState.player.crystal = Config.escape.crystalGoal;
        gameState.escape.isCharging = false;
        gameState.escape.charge = 0;
        gameState.escape.waveTimer = 0;
        gameState.escape.wavePulse = 0;
        gameState.escape.completed = false;
        syncInventoryFromPlayer();
        updateStatusBar();
        saveGame(true);
        return true;
    }

    function rebuildWorldAfterLoad(snapshot) {
        const Entity = window.EntityManager;
        if (!Entity || !Entity.collections.player) return;

        Entity.clearAreaEntities();
        const areaEvents = window.gameEvents[gameState.progress.currentArea] || [];
        if (Array.isArray(snapshot.eventPoints) && snapshot.eventPoints.length > 0) {
            Entity.restoreEventPoints(
                areaEvents,
                gameState.progress.triggeredEvents,
                snapshot.eventPoints
            );
        } else {
            Entity.buildEventPoints(areaEvents, gameState.progress.triggeredEvents);
        }

        if (snapshot.hasEndingPoint ||
            gameState.player.crystal >= Config.escape.crystalGoal) {
            Entity.spawnEndingPoint();
        } else {
            Entity.collections.endingPoint = null;
        }

        if (snapshot.playerEntity) {
            Entity.collections.player.x = Number(snapshot.playerEntity.x) || Config.player.initX;
            Entity.collections.player.y = Number(snapshot.playerEntity.y) || Config.player.initY;
        } else {
            Entity.collections.player.resetToSpawn();
        }
    }

	// 获取物品数量
	function getItemCount(itemId) {
	    if (gameState.player.hasOwnProperty(itemId)) {
	        return Math.max(0, Number(gameState.player[itemId]) || 0);
	    }
	    const item = gameState.inventory.find(i => i.id === itemId);
	    return item ? item.count : 0;
	}
	
	// 添加物品
	function addItem(itemId, count = 1) {
	    const itemConfig = Config.extensions.items[itemId];
	    if (!itemConfig) return false;

	    if (gameState.player.hasOwnProperty(itemId)) {
	        gameState.player[itemId] = Math.min(
	            getItemCount(itemId) + Math.max(0, count),
	            itemConfig.maxStack
	        );
	        syncInventoryFromPlayer();
	    } else {
	        const existItem = gameState.inventory.find(i => i.id === itemId);
	        if (existItem) {
	            existItem.count = Math.min(existItem.count + count, itemConfig.maxStack);
	        } else {
	            gameState.inventory.push({
	                id: itemId,
	                count: Math.min(count, itemConfig.maxStack)
	            });
	        }
	    }
	    updateStatusBar();
		if (dom.inventoryPanel && dom.inventoryPanel.style.display === 'block') {
		        renderInventory();
		    }
	    return true;
	}
	
	// 减少物品
	function removeItem(itemId, count = 1) {
	    if (gameState.player.hasOwnProperty(itemId)) {
	        if (getItemCount(itemId) < count) return false;
	        gameState.player[itemId] -= count;
	        syncInventoryFromPlayer();
	    } else {
	        const existItem = gameState.inventory.find(i => i.id === itemId);
	        if (!existItem || existItem.count < count) return false;
	        
	        existItem.count -= count;
	        if (existItem.count <= 0) {
	            const index = gameState.inventory.indexOf(existItem);
	            gameState.inventory.splice(index, 1);
	        }
	    }
	    updateStatusBar();
		 if (dom.inventoryPanel && dom.inventoryPanel.style.display === 'block') {
		        renderInventory();
		    }
	    return true;
	}
	
	// 使用消耗品
	function useItem(itemId) {
	    const itemConfig = Config.extensions.items[itemId];
	    if (!itemConfig || itemConfig.type !== 'consumable') return false;
	    
	    if (!removeItem(itemId, 1)) return false;
	    
	    // 应用使用效果
	    if (itemConfig.useEffect) {
	        applyEffect(itemConfig.useEffect);
	    }
	    
	    showTip(`使用了 ${itemConfig.name}`);
	    return true;
	}
	// 切换背包显隐
	function toggleInventory() {
	    if (dom.inventoryPanel.style.display === 'block') {
	        hideInventory();
	    } else {
	        showInventory();
	    }
	}
	
	// 显示背包
	function showInventory() {
	    renderInventory();
	    dom.inventoryPanel.style.display = 'block';
	}
	
	// 隐藏背包
	function hideInventory() {
	    dom.inventoryPanel.style.display = 'none';
	}
	
	// 渲染背包物品列表
	function renderInventory() {
	    if (!dom.inventoryList) return;
	    dom.inventoryList.innerHTML = '';
	
	    const sections = [
	        {
	            title: '消耗品',
	            items: Object.values(Config.extensions.items).filter(item => item.type === 'consumable' && getItemCount(item.id) > 0),
	        },
	        {
	            title: '材料',
	            items: Object.values(Config.extensions.items).filter(item => item.type === 'material' && getItemCount(item.id) > 0),
	        }
	    ];

	    const hasItems = sections.some(section => section.items.length > 0);
	    if (!hasItems) {
	        dom.inventoryList.innerHTML = '<div style="text-align:center;color:#666;padding:30px;">背包为空</div>';
	        return;
	    }

	    sections.forEach(section => {
	        const sectionEl = document.createElement('div');
	        sectionEl.className = 'inventory-section';
	        sectionEl.innerHTML = `<div class="inventory-section-title">${section.title}</div>`;

	        section.items.forEach(itemConfig => {
	            const itemEl = document.createElement('div');
	            itemEl.className = 'inventory-item';
	            itemEl.innerHTML = `
	                <div class="item-info">
	                    <div class="item-name">${itemConfig.name}</div>
	                    ${itemConfig.desc ? `<div class="item-desc">${itemConfig.desc}</div>` : ''}
	                </div>
	                <div class="item-count">×${getItemCount(itemConfig.id)}</div>
	            `;

	            if (itemConfig.type === 'consumable') {
	                itemEl.onclick = () => {
	                    useItem(itemConfig.id);
	                    renderInventory();
	                };
	            }

	            sectionEl.appendChild(itemEl);
	        });

	        dom.inventoryList.appendChild(sectionEl);
	    });
	}  
    // 初始化 DOM 引用
    function initDom() {
        dom.hp = document.getElementById('hp');
        dom.crystal = document.getElementById('crystal');
        dom.food = document.getElementById('food');
        dom.ammo = document.getElementById('ammo');
        dom.core = document.getElementById('core');
        dom.progress = document.getElementById('progress');
        dom.total = document.getElementById('total');
        dom.storyText = document.getElementById('story-text');
        dom.storyPanel = document.getElementById('story-panel');
        dom.continueTip = document.getElementById('continue-tip');
        dom.optionArea = document.getElementById('option-area');
        dom.systemTip = document.getElementById('system-tip');
		dom.inventoryPanel = document.getElementById('inventory-panel');
		dom.inventoryList = document.getElementById('inventory-list');
        dom.debugGrantCrystals = document.getElementById('debug-grant-crystals');
        if (dom.debugGrantCrystals) {
            dom.debugGrantCrystals.onclick = () => {
                setEscapeReadyForTest();
                showTip('测试资源已补足：星能晶块 ×30，绿色飞船已出现');
            };
        }
    }

    // 初始化进度计算
    function initProgress() {
        gameState.progress.halfCount = Math.ceil(window.totalEventCount / 2);
        dom.total.textContent = String(Config.escape.crystalGoal);
    }

    // 更新状态栏
    function updateStatusBar() {
        dom.hp.textContent = String(gameState.player.hp);
        dom.crystal.textContent = String(gameState.player.crystal);
        dom.food.textContent = String(gameState.player.food);
        dom.ammo.textContent = String(gameState.player.ammo);
        dom.core.textContent = String(gameState.player.core);
        dom.progress.textContent = String(gameState.player.crystal);
        if (dom.total) {
            dom.total.textContent = String(Config.escape.crystalGoal);
        }
        if (gameState.player.crystal >= Config.escape.crystalGoal && !window.EntityManager.collections.endingPoint) {
            window.EntityManager.spawnEndingPoint();
            showTip('星能晶块已满 30，绿色飞船已出现');
        }
    }

    // 显示系统提示
    function showTip(text) {
        dom.systemTip.textContent = text;
        dom.systemTip.classList.add('show');
        setTimeout(() => {
            dom.systemTip.classList.remove('show');
        }, Config.ui.tipDuration);
    }

    function showStoryPanel() {
        if (dom.storyPanel) {
            dom.storyPanel.style.display = 'block';
        }
    }

    function hideStoryPanel() {
        if (!dom.storyPanel) return;
        dom.storyText.innerHTML = '';
        dom.continueTip.style.display = 'none';
        dom.optionArea.style.display = 'none';
        dom.storyPanel.style.display = 'none';
    }

    // 应用事件效果
	function applyEffect(effect) {
        if (!canAffordEffect(effect)) return false;
        for (const [key, value] of Object.entries(effect)) {
            // 跳过特殊字段
            if (['permanent', 'progressBonus'].includes(key)) continue;
            // 预留：资源不足校验接口
            if (gameState.player.hasOwnProperty(key)) {
                gameState.player[key] += value;
                // 生命值不超过上限
                if (key === 'hp') {
                    gameState.player.hp = Math.min(gameState.player.hp, gameState.player.maxHp);
                }
            }
        }
        // 进度加成
        if (effect.progressBonus) {
            gameState.progress.triggeredCount += effect.progressBonus;
        }
        // 预留：永久建筑解锁处理
        if (effect.permanent) {
            gameState.extensions.unlockedBuildings.push(effect.permanent);
        }
        updateStatusBar();
        syncInventoryFromPlayer();
        return true;
    }

    // 自动提纯资源
    function autoPurify() {
        const p = gameState.player;
        const cfg = Config.purify;
        let crystalGain = 0;

        if (p.ore >= cfg.orePerUnit) {
            const use = Math.floor(p.ore / cfg.orePerUnit);
            crystalGain += use;
            p.ore -= use * cfg.orePerUnit;
        }
        if (p.highOre >= cfg.highOrePerUnit) {
            const use = Math.floor(p.highOre / cfg.highOrePerUnit);
            crystalGain += use * 2;
            p.highOre -= use * cfg.highOrePerUnit;
        }
        if (p.core >= cfg.corePerUnit) {
            const use = Math.floor(p.core / cfg.corePerUnit);
            crystalGain += use;
            p.core -= use * cfg.corePerUnit;
        }
        if (p.strongCore >= cfg.strongCorePerUnit) {
            const use = Math.floor(p.strongCore / cfg.strongCorePerUnit);
            crystalGain += use * 2;
            p.strongCore -= use * cfg.strongCorePerUnit;
        }
        if (p.electric >= cfg.electricPerUnit) {
            const use = Math.floor(p.electric / cfg.electricPerUnit);
            crystalGain += use;
            p.electric -= use * cfg.electricPerUnit;
        }

        if (crystalGain > 0) {
            p.crystal += crystalGain;
            showTip(`自动提纯完成：星能晶块 ×${crystalGain}`);
        }
        updateStatusBar();
        syncInventoryFromPlayer();
    }
	// 初始化背包（同步初始资源）
    function initInventory() {
	    syncInventoryFromPlayer();
	}

    function saveGame(silent = false) {
        const storage = getStorage();
        if (!storage) {
            if (!silent) showTip('当前浏览器不支持本地存档');
            return false;
        }

        try {
            storage.setItem(SAVE_KEY, JSON.stringify(createSaveSnapshot()));
            if (!silent) showTip('存档成功');
            return true;
        } catch (err) {
            if (!silent) showTip('存档失败：浏览器存储不可用');
            return false;
        }
    }

    function loadGame(silent = false) {
        const storage = getStorage();
        if (!storage) {
            if (!silent) showTip('当前浏览器不支持本地存档');
            return false;
        }

        const raw = storage.getItem(SAVE_KEY);
        if (!raw) {
            if (!silent) showTip('没有可读取的存档');
            return false;
        }

        try {
            const snapshot = JSON.parse(raw);
            if (!snapshot || snapshot.version !== SAVE_VERSION) {
                if (!silent) showTip('存档版本不兼容');
                return false;
            }

            const savedArea = snapshot.progress && snapshot.progress.currentArea;
            const currentArea = Config.areas.order.includes(savedArea)
                ? savedArea
                : Config.areas.order[0];

            gameState.player = {
                ...Config.player.initResources,
                ...(snapshot.player || {})
            };
            gameState.inventory = normalizeInventory(snapshot.inventory);
            gameState.progress = {
                triggeredEvents: Array.isArray(snapshot.progress.triggeredEvents)
                    ? [...snapshot.progress.triggeredEvents]
                    : [],
                currentArea,
                triggeredCount: Number(snapshot.progress.triggeredCount) || 0,
                halfCount: Math.ceil(window.totalEventCount / 2)
            };
            gameState.story = {
                currentOptions: [],
                isGameOver: !!(snapshot.story && snapshot.story.isGameOver),
                lockMove: !!(snapshot.story && snapshot.story.isGameOver),
                inTransition: false,
                canPressF: false
            };
            gameState.interaction = {
                nearbyEventPoint: null,
                nearEndingPoint: false
            };
            gameState.escape = {
                isCharging: false,
                charge: 0,
                waveTimer: 0,
                wavePulse: 0,
                completed: false,
                ...(snapshot.escape || {})
            };
            gameState.extensions = {
                unlockedBuildings: [],
                inventory: [],
                achievements: [],
                ...(snapshot.extensions || {})
            };

            syncInventoryFromPlayer();
            rebuildWorldAfterLoad(snapshot);
            updateStatusBar();
            if (dom.inventoryPanel && dom.inventoryPanel.style.display === 'block') {
                renderInventory();
            }
            if (!silent) showTip('读档成功');
            return true;
        } catch (err) {
            if (!silent) showTip('读档失败：存档已损坏');
            return false;
        }
    }

    function setNearbyEventPoint(point) {
        gameState.interaction.nearbyEventPoint = point || null;
    }

    function setNearEndingPoint(isNear) {
        gameState.interaction.nearEndingPoint = !!isNear;
    }

    function startEscapeCharge() {
        if (gameState.player.crystal < Config.escape.crystalGoal) {
            showTip(`需要 ${Config.escape.crystalGoal} 个星能晶块才能启动飞船`);
            return false;
        }
        if (gameState.escape.isCharging) return false;
        if (gameState.escape.completed) return false;

        gameState.escape.isCharging = true;
        gameState.escape.charge = 0;
        gameState.escape.waveTimer = 0;
        gameState.escape.wavePulse = 0;
        showTip('飞船正在充能，守住信标');
        return true;
    }

    function cancelEscapeCharge() {
        gameState.escape.isCharging = false;
        gameState.escape.charge = 0;
        gameState.escape.waveTimer = 0;
        gameState.escape.wavePulse = 0;
    }

    function restartGame() {
        const storage = getStorage();
        if (storage) {
            storage.removeItem(SAVE_KEY);
        }
        const locationObject = window.location;
        if (locationObject && typeof locationObject.reload === 'function') {
            locationObject.reload();
            return true;
        }
        return false;
    }

    function updateEscapeCharge(frames = 1) {
        if (!gameState.escape.isCharging || gameState.escape.completed) {
            return { wave: false, completed: false, inRange: false };
        }

        const Entity = window.EntityManager;
        const player = Entity && Entity.collections.player;
        const inRange = !!(player && Entity && Entity.isNearEndingPoint(player));
        if (!inRange) {
            gameState.escape.charge = 0;
            gameState.escape.waveTimer = 0;
            gameState.escape.wavePulse = 0;
            return { wave: false, completed: false, inRange: false };
        }

        const frameCount = Math.max(1, Number(frames) || 1);
        let wave = false;

        for (let i = 0; i < frameCount; i++) {
            gameState.escape.charge = Math.min(
                Config.escape.chargeDurationFrames,
                gameState.escape.charge + 1
            );
            gameState.escape.waveTimer += 1;

            if (gameState.escape.waveTimer >= Config.escape.waveIntervalFrames) {
                gameState.escape.waveTimer = 0;
                gameState.escape.wavePulse = Config.escape.wavePulseFrames;
                wave = true;
            } else if (gameState.escape.wavePulse > 0) {
                gameState.escape.wavePulse -= 1;
            }

            if (gameState.escape.charge >= Config.escape.chargeDurationFrames) {
                gameState.escape.completed = true;
                gameState.escape.isCharging = false;
                return { wave, completed: true, inRange: true };
            }
        }

        return { wave, completed: false, inRange: true };
    }

       return {
           gameState,
           dom,
           initDom,
           initProgress,
           updateStatusBar,
           showTip,
           showStoryPanel,
           hideStoryPanel,
           canAffordEffect,
           describeEffectCosts,
           applyEffect,
           autoPurify,
           setEscapeReadyForTest,
           setNearbyEventPoint,
           setNearEndingPoint,
           startEscapeCharge,
           cancelEscapeCharge,
           restartGame,
           updateEscapeCharge,
           useItem,
           initInventory,
           saveGame,
           loadGame,
           // 新增背包方法
           toggleInventory,
           showInventory,
           hideInventory,
           renderInventory
       };
})();
