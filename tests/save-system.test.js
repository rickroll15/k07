const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

function createCanvasContext(canvas) {
  const calls = {
    fillRects: [],
    strokes: [],
    arcs: [],
    texts: [],
  };

  return {
    canvas,
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowColor: '',
    shadowBlur: 0,
    fillRect(x, y, w, h) {
      calls.fillRects.push({ x, y, w, h, fillStyle: this.fillStyle });
    },
    strokeRect(x, y, w, h) {
      calls.strokes.push({ x, y, w, h, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    stroke() {},
    save() {},
    restore() {},
    arc(x, y, radius) {
      calls.arcs.push({ x, y, radius, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth });
    },
    fillText(text, x, y) {
      calls.texts.push({ text, x, y, fillStyle: this.fillStyle });
    },
  };
}

function createElement(tagName = 'div') {
  const element = {
    tagName: tagName.toUpperCase(),
    children: [],
    className: '',
    innerHTML: '',
    textContent: '',
    width: 1280,
    height: 720,
    style: {},
    onclick: null,
    classList: {
      add() {},
      remove() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.width, height: this.height };
    },
    getContext() {
      if (!this._context) {
        this._context = createCanvasContext(this);
      }
      return this._context;
    },
  };

  return element;
}

function createBasicElement(tagName = 'div') {
  return {
    tagName: tagName.toUpperCase(),
    children: [],
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    onclick: null,
    classList: {
      add() {},
      remove() {},
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
  };
}

function createHarness(options = {}) {
  const storage = new Map();
  const elements = new Map();
  const listeners = new Map();
  const reloadState = { count: 0 };
  const sandbox = {
    console,
    Math,
    JSON,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    parseInt,
    parseFloat,
    isNaN,
    innerWidth: 1280,
    innerHeight: 720,
    setTimeout: options.immediateTimers ? (fn) => {
      fn();
      return 0;
    } : setTimeout,
    clearTimeout,
    requestAnimationFrame() {
      return 0;
    },
    cancelAnimationFrame() {},
    window: null,
    document: null,
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      },
      clear() {
        storage.clear();
      },
      key(index) {
        return Array.from(storage.keys())[index] ?? null;
      },
      get length() {
        return storage.size;
      },
    },
    location: {
      reload() {
        reloadState.count += 1;
      },
    },
  };

  const document = {
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, createElement('div'));
      }
      return elements.get(id);
    },
    createElement(tagName) {
      return createBasicElement(tagName);
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(handler);
    },
  };

  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.document = document;
  sandbox.globalThis = sandbox;

  const context = vm.createContext(sandbox);
  const scripts = options.includeGame
    ? ['js/events.js', 'js/config.js', 'js/input.js', 'js/entities.js', 'js/resource.js', 'js/render.js', 'js/story.js', 'js/game.js']
    : ['js/config.js', 'js/entities.js', 'js/events.js', 'js/resource.js'];
  if (options.includeStory && !options.includeGame) {
    scripts.push('js/story.js');
  }
  for (const file of scripts) {
    const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
    vm.runInContext(source, context, { filename: file });
  }

  const Resource = context.window.ResourceManager;
  const Entity = context.window.EntityManager;

  Resource.initDom();
  Entity.initPlayer();

  return { context, Resource, Entity, storage, elements, listeners, reloadState };
}

test('inventory panel is outside the status bar', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const statusStart = html.indexOf('<div class="status-bar">');
  const inventoryStart = html.indexOf('<div class="inventory-panel" id="inventory-panel">');

  assert.ok(statusStart >= 0, 'status bar should exist');
  assert.ok(inventoryStart >= 0, 'inventory panel should exist');

  const tagPattern = /<\/?div\b[^>]*>/gi;
  tagPattern.lastIndex = statusStart;
  let depth = 0;
  let statusEnd = -1;
  let match;

  while ((match = tagPattern.exec(html))) {
    if (match[0][1] === '/') {
      depth -= 1;
      if (depth === 0) {
        statusEnd = match.index;
        break;
      }
    } else {
      depth += 1;
    }
  }

  assert.ok(statusEnd >= 0, 'status bar should close');
  assert.ok(inventoryStart > statusEnd, 'inventory panel should not be nested inside the status bar');
});

test('saveGame stores a snapshot and loadGame restores it', () => {
  const { Resource, Entity, storage } = createHarness();

  Resource.gameState.player.hp = 77;
  Resource.gameState.player.crystal = 30;
  Resource.gameState.player.food = 9;
  Resource.gameState.player.ammo = 23;
  Resource.gameState.player.core = 4;
  Resource.gameState.player.strongCore = 1;
  Resource.gameState.player.ore = 7;
  Resource.gameState.player.highOre = 2;
  Resource.gameState.player.electric = 6;
  Resource.gameState.player.medkit = 3;
  Resource.gameState.player.bandage = 1;

  Resource.gameState.inventory = [
    { id: 'food', count: 9 },
    { id: 'ammo', count: 23 },
    { id: 'medkit', count: 3 },
  ];

  Resource.gameState.progress.currentArea = 'south';
  Resource.gameState.progress.triggeredEvents = ['s001'];
  Resource.gameState.progress.triggeredCount = 16;
  Resource.gameState.progress.halfCount = 16;

  Entity.collections.player.x = 432;
  Entity.collections.player.y = 876;

  assert.equal(Resource.saveGame(true), true);

  const raw = storage.get('waste-star-k07-save-v1');
  assert.ok(raw);

  const saved = JSON.parse(raw);
  assert.equal(saved.progress.currentArea, 'south');
  assert.equal(saved.playerEntity.x, 432);
  assert.equal(saved.player.hp, 77);
  assert.equal(saved.player.crystal, 30);

  Resource.gameState.player.hp = 1;
  Resource.gameState.player.food = 0;
  Resource.gameState.inventory = [];
  Resource.gameState.progress.currentArea = 'mine';
  Resource.gameState.progress.triggeredEvents = [];
  Resource.gameState.progress.triggeredCount = 0;
  Entity.collections.player.x = 10;
  Entity.collections.player.y = 20;

  assert.equal(Resource.loadGame(true), true);

  assert.equal(Resource.gameState.player.hp, 77);
  assert.equal(Resource.gameState.player.food, 9);
  assert.equal(Resource.gameState.player.core, 4);
  assert.equal(Resource.gameState.player.ore, 7);
  assert.deepEqual(JSON.parse(JSON.stringify(Resource.gameState.inventory)), [
    { id: 'food', count: 9 },
    { id: 'ammo', count: 23 },
    { id: 'medkit', count: 3 },
    { id: 'bandage', count: 1 },
    { id: 'crystal', count: 30 },
    { id: 'ore', count: 7 },
    { id: 'highOre', count: 2 },
    { id: 'core', count: 4 },
    { id: 'strongCore', count: 1 },
    { id: 'electric', count: 6 },
  ]);
  assert.equal(Resource.gameState.progress.currentArea, 'south');
  assert.deepEqual(JSON.parse(JSON.stringify(Resource.gameState.progress.triggeredEvents)), ['s001']);
  assert.equal(Entity.collections.player.x, 432);
  assert.equal(Entity.collections.player.y, 876);
  assert.equal(Entity.collections.eventPoints.length, 8);
  assert.ok(Entity.collections.endingPoint);
});

test('debug grant button gives 30 crystals and saves an ending-ready state', () => {
  const { Resource, Entity, storage } = createHarness();

  Resource.gameState.player.crystal = 4;
  Resource.gameState.player.ore = 11;
  Entity.collections.player.x = 640;
  Entity.collections.player.y = 720;
  Resource.gameState.escape.isCharging = true;
  Resource.gameState.escape.charge = 120;
  Resource.gameState.escape.completed = true;

  assert.equal(typeof Resource.dom.debugGrantCrystals.onclick, 'function');
  Resource.dom.debugGrantCrystals.onclick();

  const saved = JSON.parse(storage.get('waste-star-k07-save-v1'));
  assert.equal(saved.player.crystal, 30);
  assert.equal(saved.hasEndingPoint, true);
  assert.equal(saved.escape.isCharging, false);
  assert.equal(saved.escape.charge, 0);
  assert.equal(saved.escape.completed, false);
  assert.deepEqual(
    saved.inventory.find(item => item.id === 'crystal'),
    { id: 'crystal', count: 30 }
  );

  assert.equal(Resource.loadGame(true), true);
  assert.equal(Resource.gameState.player.crystal, 30);
  assert.equal(Resource.gameState.player.ore, 11);
  assert.ok(Entity.collections.endingPoint);
});

test('restartGame clears the terminal save and reloads the page', () => {
  const { Resource, storage, reloadState } = createHarness();

  Resource.gameState.player.crystal = 30;
  assert.equal(Resource.saveGame(true), true);
  assert.ok(storage.get('waste-star-k07-save-v1'));

  assert.equal(Resource.restartGame(), true);

  assert.equal(storage.get('waste-star-k07-save-v1'), undefined);
  assert.equal(reloadState.count, 1);
});

test('ending leaves an F restart prompt instead of hiding all controls', () => {
  const { context, Resource, storage } = createHarness({
    includeStory: true,
    immediateTimers: true,
  });
  const Story = context.window.StoryManager;

  Resource.gameState.player.crystal = 30;
  Story.showEnding();

  assert.equal(Resource.gameState.story.isGameOver, true);
  assert.equal(Resource.gameState.story.canPressF, true);
  assert.equal(Resource.dom.continueTip.style.display, 'block');
  assert.equal(Resource.dom.continueTip.textContent, '按 F 重新开始');
  assert.ok(storage.get('waste-star-k07-save-v1'));
});

test('pressing F after the ending restarts the game', () => {
  const { context, Resource, storage, listeners, reloadState } = createHarness({
    includeGame: true,
    immediateTimers: true,
  });

  context.window.onload();
  Resource.gameState.story.isGameOver = true;
  Resource.gameState.story.canPressF = true;
  assert.equal(Resource.saveGame(true), true);

  const keydownHandlers = listeners.get('keydown') || [];
  assert.ok(keydownHandlers.length > 0);
  keydownHandlers[keydownHandlers.length - 1]({
    key: 'f',
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
  });

  assert.equal(storage.get('waste-star-k07-save-v1'), undefined);
  assert.equal(reloadState.count, 1);
});

test('gameOver also shows the restart prompt and allows F restart', () => {
  const { context, Resource, storage, listeners, reloadState } = createHarness({
    includeGame: true,
    immediateTimers: true,
  });

  context.window.onload();
  context.window.StoryManager.gameOver();

  assert.equal(Resource.gameState.story.isGameOver, true);
  assert.equal(Resource.gameState.story.canPressF, true);
  assert.equal(Resource.dom.continueTip.textContent, '按 F 重新开始');

  const keydownHandlers = listeners.get('keydown') || [];
  keydownHandlers[keydownHandlers.length - 1]({
    key: 'f',
    ctrlKey: false,
    metaKey: false,
    preventDefault() {},
  });

  assert.equal(storage.get('waste-star-k07-save-v1'), undefined);
  assert.equal(reloadState.count, 1);
});

test('loadGame restores event point positions from the saved snapshot', () => {
  const { context, Resource, Entity } = createHarness();

  Resource.gameState.progress.currentArea = 'south';
  Resource.gameState.progress.triggeredEvents = [];
  Resource.gameState.progress.triggeredCount = 0;
  Resource.gameState.progress.halfCount = 16;
  Entity.buildEventPoints(context.window.gameEvents.south, []);

  const originalPoints = Entity.collections.eventPoints.map(point => ({
    id: point.id,
    x: point.x,
    y: point.y,
  }));

  assert.equal(Resource.saveGame(true), true);

  Entity.collections.eventPoints.forEach((point, index) => {
    point.x = 100 + index;
    point.y = 200 + index;
  });

  assert.equal(Resource.loadGame(true), true);

  const restoredPoints = Entity.collections.eventPoints.map(point => ({
    id: point.id,
    x: point.x,
    y: point.y,
  }));

  assert.deepEqual(
    JSON.parse(JSON.stringify(restoredPoints)),
    JSON.parse(JSON.stringify(originalPoints))
  );
});

test('story panel is hidden during exploration and shown for story choices', () => {
  const { context, Resource } = createHarness({
    includeStory: true,
    immediateTimers: true,
  });
  const Story = context.window.StoryManager;

  Resource.hideStoryPanel();
  assert.equal(Resource.dom.storyPanel.style.display, 'none');

  Story.showOptions([
    {
      text: '检查残骸',
      effect: {},
      result: '你确认这里暂时安全。',
    },
  ]);

  assert.equal(Resource.dom.storyPanel.style.display, 'block');

  Story.selectOption(0);

  assert.equal(Resource.dom.storyPanel.style.display, 'none');
});

test('initInventory syncs the backpack without doubling player resources', () => {
  const { Resource } = createHarness();

  Resource.gameState.player.ore = 4;
  Resource.gameState.player.core = 2;

  Resource.initInventory();

  assert.equal(Resource.gameState.player.food, 5);
  assert.equal(Resource.gameState.player.ammo, 60);
  assert.equal(Resource.gameState.player.medkit, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(Resource.gameState.inventory)), [
    { id: 'food', count: 5 },
    { id: 'ammo', count: 60 },
    { id: 'medkit', count: 2 },
    { id: 'ore', count: 4 },
    { id: 'core', count: 2 },
  ]);
});

test('status progress tracks star crystals for the escape goal', () => {
  const { Resource } = createHarness();

  Resource.initProgress();
  Resource.gameState.player.crystal = 12;
  Resource.updateStatusBar();

  assert.equal(Resource.dom.progress.textContent, '12');
  assert.equal(Resource.dom.total.textContent, '30');
});

test('autoPurify converts five ordinary ore into one star crystal', () => {
  const { Resource } = createHarness();

  Resource.gameState.player.crystal = 0;
  Resource.gameState.player.ore = 12;

  Resource.autoPurify();

  assert.equal(Resource.gameState.player.crystal, 2);
  assert.equal(Resource.gameState.player.ore, 2);
});

test('escape point appears when the star crystal goal is met', () => {
  const { Resource, Entity } = createHarness();

  Resource.initProgress();
  Resource.gameState.player.crystal = 29;
  Resource.updateStatusBar();
  assert.equal(Entity.collections.endingPoint, null);

  Resource.gameState.player.crystal = 30;
  Resource.updateStatusBar();

  assert.ok(Entity.collections.endingPoint);
});

test('ending charge only advances inside the circle and resets to zero outside', () => {
  const { Resource, Entity } = createHarness();

  Resource.gameState.player.crystal = 30;
  Entity.spawnEndingPoint();

  const player = Entity.collections.player;
  player.x = Entity.collections.endingPoint.x + 6;
  player.y = Entity.collections.endingPoint.y + 6;

  assert.equal(Entity.isNearEndingPoint(player), true);
  assert.equal(Resource.startEscapeCharge(), true);

  Resource.updateEscapeCharge(120);
  assert.equal(Resource.gameState.escape.charge, 120);

  player.x += 500;
  player.y += 500;
  assert.equal(Entity.isNearEndingPoint(player), false);

  Resource.updateEscapeCharge(60);
  assert.equal(Resource.gameState.escape.charge, 0);
  assert.equal(Resource.gameState.escape.isCharging, true);

  player.x = Entity.collections.endingPoint.x + 8;
  player.y = Entity.collections.endingPoint.y + 8;
  assert.equal(Entity.isNearEndingPoint(player), true);

  const result = Resource.updateEscapeCharge(600);
  assert.equal(result.completed, true);
  assert.equal(Resource.gameState.escape.charge, 600);
});

test('escape monsters spawn from the four cardinal directions with boosted speed', () => {
  const { context, Entity } = createHarness();
  const player = Entity.collections.player;
  player.x = 800;
  player.y = 500;

  const sequence = [
    0.50, 0.10, 0.50,
    0.50, 0.35, 0.50,
    0.50, 0.60, 0.50,
    0.50, 0.90, 0.50,
  ];
  let index = 0;
  const random = () => sequence[index++];

  Entity.spawnMonsters(4, player, { mode: 'cardinal', random, speedMultiplier: 2 });

  const [left, right, up, down] = Entity.collections.monsters;

  assert.ok(left.x < player.x && Math.abs(left.y - player.y) < 50);
  assert.ok(right.x > player.x && Math.abs(right.y - player.y) < 50);
  assert.ok(up.y < player.y && Math.abs(up.x - player.x) < 50);
  assert.ok(down.y > player.y && Math.abs(down.x - player.x) < 50);
  assert.ok(left.speed > context.window.GameConfig.combat.monster.baseSpeed);
});

test('ending ship renders as a vertical six-block signal with a larger aura', () => {
  const { context, Resource, Entity } = createHarness({
    includeGame: true,
    immediateTimers: true,
  });

  context.window.onload();
  const canvas = context.document.getElementById('game-canvas');
  const ctx = canvas.getContext();
  ctx.calls.fillRects.length = 0;
  ctx.calls.arcs.length = 0;

  Resource.gameState.player.crystal = 30;
  Resource.updateStatusBar();
  context.window.RenderManager.render();

  const shipBlocks = ctx.calls.fillRects.filter(call =>
    call.fillStyle === '#00ff66' &&
    call.w >= 10 &&
    call.h >= 10
  );
  const auraArc = ctx.calls.arcs.find(call => call.radius >= 100);

  assert.equal(shipBlocks.length, 6);
  assert.ok(auraArc);
  assert.ok(Entity.collections.endingPoint);
});

test('nearby event points are marked for interaction without being consumed', () => {
  const { Entity } = createHarness();
  const player = Entity.collections.player;
  const event = { id: 'sample', options: [] };
  const point = new Entity.EventPoint('sample', event, player.x, player.y);
  Entity.collections.eventPoints = [point];

  const nearby = Entity.findNearbyEventPoint(player);

  assert.equal(nearby, point);
  assert.equal(point.isNearby, true);
  assert.equal(Entity.collections.eventPoints.length, 1);
});

test('nearby ending point is marked for escape charging', () => {
  const { Entity } = createHarness();
  const player = Entity.collections.player;
  Entity.spawnEndingPoint();
  Entity.collections.endingPoint.x = player.x;
  Entity.collections.endingPoint.y = player.y;

  assert.equal(Entity.isNearEndingPoint(player), true);
  assert.equal(Entity.collections.endingPoint.isNearby, true);
});

test('ending point proximity uses the center of the full six-block signal', () => {
  const { Entity } = createHarness();
  const player = Entity.collections.player;
  Entity.spawnEndingPoint();
  const point = Entity.collections.endingPoint;
  const signalHeight = point.blockCount * point.blockSize + (point.blockCount - 1) * point.blockGap;

  player.x = point.x + point.blockSize / 2 - player.size / 2;
  player.y = point.y + signalHeight / 2 + 140 - player.size / 2;

  assert.equal(Entity.isNearEndingPoint(player), true);
});

test('escape charging advances and reports energy waves', () => {
  const { context, Resource, Entity } = createHarness();

  Resource.gameState.player.crystal = 30;
  Entity.spawnEndingPoint();
  Entity.collections.player.x = Entity.collections.endingPoint.x + 8;
  Entity.collections.player.y = Entity.collections.endingPoint.y + 8;
  Resource.startEscapeCharge();
  const waveResult = Resource.updateEscapeCharge(context.window.GameConfig.escape.waveIntervalFrames);

  assert.equal(Resource.gameState.escape.isCharging, true);
  assert.equal(waveResult.wave, true);

  const completeResult = Resource.updateEscapeCharge(context.window.GameConfig.escape.chargeDurationFrames);

  assert.equal(completeResult.completed, true);
  assert.equal(Resource.gameState.escape.charge, context.window.GameConfig.escape.chargeDurationFrames);
});

test('story options reject unaffordable resource costs', () => {
  const { context, Resource } = createHarness({
    includeStory: true,
    immediateTimers: true,
  });
  const Story = context.window.StoryManager;

  Resource.gameState.player.food = 0;
  Resource.gameState.player.ammo = 0;
  Resource.initInventory();

  Story.showOptions([
    {
      text: '冒险冲过去',
      effect: { food: -1, ammo: -1 },
      result: '你冲了过去。',
    },
  ]);

  assert.equal(Resource.dom.optionArea.children[0].className.includes('disabled'), true);
  assert.equal(Story.selectOption(0), false);
  assert.equal(Resource.gameState.player.food, 0);
  assert.equal(Resource.gameState.player.ammo, 0);
  assert.equal(Resource.dom.optionArea.style.display, 'flex');
});
