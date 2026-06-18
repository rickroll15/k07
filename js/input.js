// input.js - 输入管理模块
window.InputManager = (function() {
    const keys = {
        w: false, s: false, a: false, d: false,
        f: false
    };

    const mouse = {
        x: 0, y: 0,
        worldX: 0, worldY: 0,
        down: false
    };

    let canvas = null;
    let cameraRef = null; // 相机引用，用于计算世界坐标

    // 绑定输入事件
    function bindInput(canvasElement, cameraObject) {
        canvas = canvasElement;
        cameraRef = cameraObject;

        // 键盘事件
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);

        // 鼠标事件
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);
    }

    function handleKeyDown(e) {
        const k = e.key.toLowerCase();
        if (k in keys) keys[k] = true;
    }

    function handleKeyUp(e) {
        const k = e.key.toLowerCase();
        if (k in keys) keys[k] = false;
    }

    function handleMouseMove(e) {
        if (!canvas || !cameraRef) return;
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        // 更新世界坐标
        mouse.worldX = mouse.x + cameraRef.x;
        mouse.worldY = mouse.y + cameraRef.y;
    }

    function handleMouseDown(e) {
        if (e.button === 0) mouse.down = true;
    }

    function handleMouseUp(e) {
        if (e.button === 0) mouse.down = false;
    }

    function handleMouseLeave() {
        mouse.down = false;
    }

    // 预留：更新相机引用（场景切换时调用）
    function updateCamera(cameraObject) {
        cameraRef = cameraObject;
    }

    // 预留：触摸输入、手柄输入扩展接口
    const extensions = {
        bindTouch: () => {},
        bindGamepad: () => {}
    };

    return {
        keys,
        mouse,
        bindInput,
        updateCamera,
        extensions
    };
})();