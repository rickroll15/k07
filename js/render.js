// render.js - Canvas 渲染模块
window.RenderManager = (function() {
    const Config = window.GameConfig;
    let ctx = null;
    let cameraRef = null;

    // 初始化渲染上下文
    function init(context, cameraObject) {
        ctx = context;
        cameraRef = cameraObject;
    }

    // 主渲染入口
    function render() {
        if (!ctx || !cameraRef) return;
        // 清空画布
        ctx.fillStyle = '#080808';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        drawGrid();
        drawWorldBorder();
        drawEventPoints();
        drawEndingPoint();
        drawEscapeWave();
        drawMonsters();
        drawBullets();
        drawPlayer();
        drawEscapeChargeBar();
        drawMinimap();
    }

    // 绘制网格背景
    function drawGrid() {
        ctx.strokeStyle = 'rgba(255, 40, 40, 0.07)';
        ctx.lineWidth = 1;
        const gridSize = Config.GRID_SIZE;
        const startX = -cameraRef.x % gridSize;
        const startY = -cameraRef.y % gridSize;

        for (let x = startX; x < ctx.canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, ctx.canvas.height);
            ctx.stroke();
        }
        for (let y = startY; y < ctx.canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ctx.canvas.width, y);
            ctx.stroke();
        }
    }

    // 绘制世界边界
    function drawWorldBorder() {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            -cameraRef.x,
            -cameraRef.y,
            Config.WORLD_WIDTH,
            Config.WORLD_HEIGHT
        );
    }

    // 绘制事件点
    function drawEventPoints() {
        const points = window.EntityManager.collections.eventPoints;
        points.forEach(point => {
            const alpha = point.updateBlink();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(
                point.x - cameraRef.x,
                point.y - cameraRef.y,
                point.size,
                point.size
            );
            if (point.isNearby) {
                drawQuestionMark(point.x + point.size / 2, point.y - 10);
            }
        });
    }

    // 绘制撤离点
    function drawEndingPoint() {
        const point = window.EntityManager.collections.endingPoint;
        if (!point) return;
        point.blinkTimer += 0.06;
        const alpha = Math.sin(point.blinkTimer) * 0.4 + 0.6;
        const blockSize = point.blockSize || point.size;
        const gap = point.blockGap || 0;
        const blockCount = point.blockCount || 1;
        const columns = point.blockColumns || 1;
        ctx.fillStyle = '#00ff66';
        ctx.save();
        ctx.shadowColor = '#00ff66';
        ctx.shadowBlur = 12 + alpha * 8;
        for (let i = 0; i < blockCount; i++) {
            const col = i % columns;
            const row = Math.floor(i / columns);
            ctx.fillRect(
                point.x + col * (blockSize + gap) - cameraRef.x,
                point.y + row * (blockSize + gap) - cameraRef.y,
                blockSize,
                blockSize
            );
        }
        ctx.restore();
        if (point.isNearby) {
            const width = columns * blockSize + (columns - 1) * gap;
            drawQuestionMark(point.x + width / 2, point.y - 12, '#00ff99');
        }
    }

    function drawQuestionMark(worldX, worldY, color = '#ffffff') {
        ctx.save();
        ctx.font = 'bold 22px Microsoft Yahei, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = color;
        ctx.fillText('?', worldX - cameraRef.x, worldY - cameraRef.y);
        ctx.restore();
    }

    function drawEscapeWave() {
        const state = window.ResourceManager.gameState;
        const point = window.EntityManager.collections.endingPoint;
        if (!point) return;

        const pulseRatio = state.escape.wavePulse > 0
            ? state.escape.wavePulse / Config.escape.wavePulseFrames
            : 0.35;
        const radius = Config.escape.auraRadius + (1 - pulseRatio) * 120;
        const alpha = state.escape.wavePulse > 0 ? 0.28 * pulseRatio : 0.14;
        const blockSize = point.blockSize || point.size;
        const gap = point.blockGap || 0;
        const columns = point.blockColumns || 1;
        const rows = point.blockRows || Math.ceil((point.blockCount || 1) / columns);
        const width = columns * blockSize + (columns - 1) * gap;
        const height = rows * blockSize + (rows - 1) * gap;
        const x = point.x + width / 2 - cameraRef.x;
        const y = point.y + height / 2 - cameraRef.y;

        ctx.save();
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawEscapeChargeBar() {
        const state = window.ResourceManager.gameState;
        if (!state.escape.isCharging) return;

        const width = Math.min(520, ctx.canvas.width - 48);
        const height = 16;
        const x = (ctx.canvas.width - width) / 2;
        const y = ctx.canvas.height - 42;
        const ratio = Math.min(1, state.escape.charge / Config.escape.chargeDurationFrames);

        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.76)';
        ctx.fillRect(x, y - 26, width, 50);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
        ctx.fillRect(x, y, width * ratio, height);
        ctx.font = '13px Microsoft Yahei, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('正在充能', ctx.canvas.width / 2, y - 6);
        ctx.restore();
    }

    // 绘制怪物
    function drawMonsters() {
        const monsters = window.EntityManager.collections.monsters;
        monsters.forEach(mon => {
            ctx.fillStyle = mon.color;
            ctx.fillRect(
                mon.x - cameraRef.x,
                mon.y - cameraRef.y,
                mon.size,
                mon.size
            );
        });
    }

    // 绘制子弹
    function drawBullets() {
        const bullets = window.EntityManager.collections.bullets;
        bullets.forEach(b => {
            ctx.fillStyle = b.color;
            ctx.fillRect(
                b.x - cameraRef.x,
                b.y - cameraRef.y,
                b.size,
                b.size
            );
        });
    }

    // 绘制玩家
    function drawPlayer() {
        const player = window.EntityManager.collections.player;
        if (!player) return;
        ctx.fillStyle = player.color;
        ctx.fillRect(
            player.x - cameraRef.x,
            player.y - cameraRef.y,
            player.size,
            player.size
        );
    }

    // 绘制小地图
    function drawMinimap() {
        const cfg = Config.ui.minimap;
        // 动态计算右上角位置
        const mapX = ctx.canvas.width - cfg.width - cfg.margin;
        const mapY = cfg.margin;
    
        const scaleX = cfg.width / Config.WORLD_WIDTH;
        const scaleY = cfg.height / Config.WORLD_HEIGHT;
        const cols = window.EntityManager.collections;
    
        // 背景+边框
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(mapX, mapY, cfg.width, cfg.height);
        ctx.strokeStyle = cfg.borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(mapX, mapY, cfg.width, cfg.height);
    
        // 事件点
        cols.eventPoints.forEach(p => {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(mapX + p.x * scaleX - 2, mapY + p.y * scaleY - 2, 4, 4);
        });
    
        // 撤离点
        if (cols.endingPoint) {
            ctx.fillStyle = '#00ff66';
            ctx.fillRect(
                mapX + cols.endingPoint.x * scaleX - 3,
                mapY + cols.endingPoint.y * scaleY - 3,
                6, 6
            );
        }
    
        // 怪物
        cols.monsters.forEach(m => {
            ctx.fillStyle = '#ff4444';
            ctx.fillRect(mapX + m.x * scaleX - 2, mapY + m.y * scaleY - 2, 4, 4);
        });
    
        // 玩家
        if (cols.player) {
            ctx.fillStyle = '#ffdd00';
            ctx.fillRect(
                mapX + cols.player.x * scaleX - 3,
                mapY + cols.player.y * scaleY - 3,
                6, 6
            );
        }
    
        // 视口框
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.strokeRect(
            mapX + cameraRef.x * scaleX,
            mapY + cameraRef.y * scaleY,
            ctx.canvas.width * scaleX,
            ctx.canvas.height * scaleY
        );
    }

    // 预留：特效绘制、UI 绘制接口
    const extensions = {
        drawParticle: () => {},
        drawDamageNumber: () => {}
    };

    return {
        init,
        render,
        extensions
    };
})();
