// story.js - 剧情系统模块
window.StoryManager = (function() {
    const Resource = window.ResourceManager;
    const Entity = window.EntityManager;
    const Config = window.GameConfig;
    const dom = Resource.dom;
    const state = Resource.gameState;

    let shootCooldownRef = 0; // 射击冷却引用（主循环维护）

    // 设置射击冷却引用（主游戏传入）
    function setShootCooldownRef(ref) {
        shootCooldownRef = ref;
    }

    // 打字机效果
    function typeText(text, callback) {
        Resource.showStoryPanel();
        dom.storyText.innerHTML = '';
        let index = 0;
        const speed = Config.ui.typeSpeed;

        function type() {
            if (index < text.length) {
                if (text[index] === '<') {
                    const endIndex = text.indexOf('>', index);
                    dom.storyText.innerHTML += text.substring(index, endIndex + 1);
                    index = endIndex + 1;
                } else {
                    dom.storyText.innerHTML += text[index];
                    index++;
                }
                setTimeout(type, speed);
            } else {
                if (callback) callback();
            }
        }
        type();
    }
	
    // 开场剧情
    function showOpening() {
        const opening = `冰冷的警报声刺破耳膜，驾驶舱的红色警示灯疯狂闪烁。
你在剧烈的颠簸中睁开眼，大脑一片混沌——上一秒你还在出租屋里刷着星际探险漫剧，下一秒就出现在了这艘锈迹斑斑的勘探船驾驶舱里。
<span class="system">【系统正在绑定宿主…】</span>
<span class="system">【身份核验通过：星际勘探者 编号EX-079】</span>
<span class="system">【当前星域：失落星域 K区】</span>
<span class="danger">【警告：船体受损严重，主引擎能源剩余12%】</span>
<span class="danger">【警告：遭遇空间乱流，强制迫降最近宜居星球】</span>
随着一声巨响，飞船重重砸在荒原上，扬起漫天尘土。
你正式踏上了废土星 K-07 的土地。
<span class="system">【操作说明：WASD 移动 · 鼠标瞄准 · 左键射击 · 触碰白色发光点触发事件】</span>
<span class="system">【提示：只有选择战斗选项才会刷怪，安全探索不会遭遇敌人】</span>
<span class="system">【目标：收集足够能源，前往东北绿色撤离点启动跃迁】</span>
<span class="system">【主线任务激活：采集能源原料，提纯星能晶块，重启跃迁系统】</span>`;

        typeText(opening, () => {
            dom.continueTip.textContent = '按 F 开始探索';
            dom.continueTip.style.display = 'block';
            state.story.canPressF = true;
        });
    }

    // 区域过渡剧情
    function showAreaTransition() {
        state.story.inTransition = true;
        state.story.lockMove = true;
        const areaName = Config.areas.names[state.progress.currentArea];
        const text = `你一路向北推进，正式进入了【${areaName}】。
这里的环境更加复杂，丧尸密度明显提升，但能源资源也更加丰富。
<span class="system">【系统提示：危险等级提升，建议谨慎探索】</span>`;

        typeText(text, () => {
            dom.continueTip.textContent = '按 F 继续前进';
            dom.continueTip.style.display = 'block';
            state.story.canPressF = true;
        });
    }

    // 显示选项
    function showOptions(options) {
        Resource.showStoryPanel();
        state.story.currentOptions = options;
        dom.optionArea.innerHTML = '';
        dom.optionArea.style.display = 'flex';
        dom.continueTip.style.display = 'none';

        options.forEach((opt, index) => {
            const btn = document.createElement('div');
            btn.className = 'option-btn';
            const canAfford = Resource.canAffordEffect(opt.effect || {});
            if (!canAfford) {
                btn.className += ' disabled';
            }
            const costText = Resource.describeEffectCosts(opt.effect || {});
            const suffix = costText ? ` <span class="cost">(${costText})</span>` : '';
            btn.innerHTML = `<span class="key">[${index + 1}]</span>${opt.text}${suffix}`;
            btn.onclick = () => {
                if (!canAfford) {
                    Resource.showTip('资源不足，无法选择');
                    return;
                }
                selectOption(index);
            };
            dom.optionArea.appendChild(btn);
        });
    }

    // 选择选项
    function selectOption(index) {
        const option = state.story.currentOptions[index];
        if (!Resource.applyEffect(option.effect)) {
            Resource.showTip('资源不足，无法选择');
            return false;
        }
        dom.optionArea.style.display = 'none';

        // 战斗选项刷怪
        if (option.spawnMonsters && option.spawnMonsters > 0) {
            Entity.spawnMonsters(option.spawnMonsters, Entity.collections.player);
            Resource.showTip(`警报：${option.spawnMonsters} 只敌人出现！`);
        }

        typeText(option.result, () => {
            // 生命值检测
            if (state.player.hp <= 0) {
                gameOver();
                return;
            }

            Resource.autoPurify();

            // 检查区域是否探索完毕
            const areaEvents = window.gameEvents[state.progress.currentArea];
            const remain = areaEvents.filter(e => !state.progress.triggeredEvents.includes(e.id));
            
            if (remain.length === 0) {
                const currentIndex = Config.areas.order.indexOf(state.progress.currentArea);
                if (currentIndex < Config.areas.order.length - 1) {
                    state.progress.currentArea = Config.areas.order[currentIndex + 1];
                    showAreaTransition();
                    return;
                } else {
                    // 全区域探索完成
                    dom.continueTip.textContent = '全区域探索完成，前往绿色撤离点撤离';
                    dom.continueTip.style.display = 'block';
                    state.story.lockMove = false;
                    Resource.hideStoryPanel();
                    return;
                }
            }

            // 解锁移动继续探索
            dom.continueTip.textContent = '继续探索地图';
            dom.continueTip.style.display = 'block';
            state.story.lockMove = false;
            Resource.hideStoryPanel();
            Resource.saveGame(true);
            return true;
        });

        return true;
    }

    // 触发地图事件
    function triggerMapEvent(event) {
        state.story.lockMove = true;
        state.progress.triggeredEvents.push(event.id);
        state.progress.triggeredCount++;
        Resource.updateStatusBar();

        const fullText = `【${event.title}】\n\n${event.desc}`;
        typeText(fullText, () => {
            showOptions(event.options);
        });
    }

    // 通关结局
    function showEnding() {
        state.story.lockMove = true;
        const ending = `你走到了绿色飞船的信标前，白色能量圈还在一圈圈扩散。
飞船已经完成充能，舱体发出低沉的轰鸣。
<span class="system">【系统提示：充能完成，轨道窗口已打开】</span>
你望着远处仍未探索完的废土，短暂犹豫后还是选择登舱撤离。
舱门缓缓关闭，推进器点火，脚下的大地迅速退远。
提纯舱全速运转，背包里的原料被重新整合为稳定的星能晶块。
【最终结算】
星能晶块：${state.player.crystal} 块
击杀丧尸：约 ${state.progress.triggeredCount * 3} 只
探索事件：${state.progress.triggeredCount} 个
逃生舱缓缓升空，穿过废土星的大气层，驶向茫茫宇宙。
这颗死亡星球的求生之旅，到此告一段落。
<span class="system">【废土星 K-07 探索完成】</span>
<span class="system">【感谢游玩 大地图自由探索版 V3.5】</span>
<span class="system">按 F 重新开始。</span>`;

        typeText(ending, () => {
            state.story.isGameOver = true;
            state.story.canPressF = true;
            dom.continueTip.textContent = '按 F 重新开始';
            dom.continueTip.style.display = 'block';
            Resource.saveGame(true);
        });
    }

    // 失败结局
    function gameOver() {
        state.story.lockMove = true;
        const text = `<span class="danger">【系统警报：宿主生命体征消失】</span>
你倒在了废土星的荒原上，红色丧尸不断围拢过来。
勘探者EX-079，任务失败。
<span class="system">【游戏结束】</span>
按 F 重新开始。`;

        typeText(text, () => {
            state.story.isGameOver = true;
            state.story.canPressF = true;
            dom.continueTip.textContent = '按 F 重新开始';
            dom.continueTip.style.display = 'block';
            Resource.saveGame(true);
        });
    }

    // 预留：特殊事件触发、对话系统、多结局扩展接口
    const extensions = {
        triggerSpecialEvent: () => {},
        startDialog: () => {},
        addEnding: () => {}
    };

    return {
        setShootCooldownRef,
        typeText,
        showOpening,
        showAreaTransition,
        showOptions,
        selectOption,
        triggerMapEvent,
        showEnding,
        gameOver,
        extensions
    };
})();
