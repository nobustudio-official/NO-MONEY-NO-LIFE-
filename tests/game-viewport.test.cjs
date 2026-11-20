const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const directory = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(directory, 'game-viewport.js'), 'utf8');
const read = name => fs.readFileSync(path.join(directory, name), 'utf8');

function events(target = {}) {
    const callbacks = new Map();
    target.addEventListener = (type, callback) => {
        if (!callbacks.has(type)) callbacks.set(type, []);
        callbacks.get(type).push(callback);
    };
    target.emit = type => (callbacks.get(type) || []).forEach(callback => callback());
    return target;
}

function environment({ width = 852, height = 393, touch = true, host = false, url, visual = true } = {}) {
    const attributes = new Map(host ? [['data-game-viewport-host', '']] : []);
    let source = '', navigations = 0, boundsReads = 0;
    const frame = {
        style: {}, contentWindow: {},
        get src() { return source; },
        set src(value) { source = value; navigations++; },
        getBoundingClientRect() { boundsReads++; return {}; }
    };
    const location = new URL(url || `https://example.test/game/${host ? 'game-viewport' : 'index'}.html?mobile-perf=off#play`);
    const redirects = [];
    location.replace = value => redirects.push(value);
    const document = {
        documentElement: {
            hasAttribute: key => attributes.has(key),
            setAttribute: (key, value) => attributes.set(key, value)
        },
        currentScript: { src: 'https://example.test/game/game-viewport.js?v=desktop-game-layout-1' },
        getElementById: id => id === 'gameViewportFrame' ? frame : null
    };
    const window = events({
        innerWidth: width, innerHeight: height, location,
        navigator: { maxTouchPoints: touch ? 5 : 0, userAgent: touch ? 'iPhone' : 'Desktop' },
        matchMedia: query => ({ matches: query.includes('coarse') && touch }),
        visualViewport: visual ? events({ width, height, offsetLeft: 0, offsetTop: 0 }) : null
    });
    window.parent = window;
    const context = { window, document, URL, console };
    return {
        window, document, frame, redirects, attributes, context,
        run() { vm.runInNewContext(code, context, { filename: 'game-viewport.js' }); },
        get navigations() { return navigations; },
        get boundsReads() { return boundsReads; }
    };
}

function runningGame(options = {}) {
    const host = environment({ ...options, host: true });
    host.run();
    const game = environment(options);
    game.window.parent = host.window;
    host.frame.contentWindow = game.window;
    game.run();
    return { host, game };
}

const scaleOf = frame => Number(frame.style.transform.match(/scale\((.+)\)/)[1]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('phone entry preserves the deployment subdirectory, settings and hash', () => {
    const page = environment(); page.run();
    assert.deepEqual(page.redirects, ['https://example.test/game/game-viewport.html?mobile-perf=off#play']);
});

test('small desktop windows keep the normal entry page', () => {
    const page = environment({ touch: false }); page.run();
    assert.equal(page.redirects.length, 0);
    page.window.GameViewport.activate();
    assert.equal(page.window.GameViewport.active, false);
});

test('wide desktop and touch desktop windows retain their existing layout', () => {
    for (const touch of [true, false]) {
        const page = environment({ width: 1920, height: 1080, touch }); page.run();
        assert.equal(page.redirects.length, 0);
        assert.equal(page.window.GameViewport.active, false);
    }
});

test('mobile user agent also works when DevTools does not expose coarse pointer', () => {
    const page = environment({ touch: false });
    page.window.navigator.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18) Mobile';
    page.run();
    assert.equal(page.redirects.length, 1);
});

test('title and setup keep their native 852 by 393 viewport', () => {
    const { host, game } = runningGame();
    assert.equal(host.frame.style.width, '852px');
    assert.equal(host.frame.style.height, '393px');
    assert.equal(scaleOf(host.frame), 1);
    assert.equal(game.window.GameViewport.active, false);
    assert.equal(game.redirects.length, 0);
});

test('game start switches the existing document to the 1920 by 1080 desktop reference', () => {
    const { host, game } = runningGame();
    const players = [{ name: 'A', money: 123456 }];
    game.window.players = players;
    game.window.GameViewport.activate();
    assert.equal(game.window.GameViewport.active, true);
    assert.equal(host.frame.style.width, '1920px');
    assert.equal(host.frame.style.height, '1080px');
    close(scaleOf(host.frame), 393 / 1080);
    close(parseFloat(host.frame.style.left), (852 - 1920 * (393 / 1080)) / 2);
    close(parseFloat(host.frame.style.top), 0);
    assert.equal(game.window.players, players);
    assert.equal(host.navigations, 1, 'activation must not reload the game or lose its input/audio context');
    assert.equal(host.boundsReads, 1, 'the new viewport must be applied before game initialization measures it');
});

test('portrait rotation fits the whole desktop image without resetting game state', () => {
    const { host, game } = runningGame();
    game.window.GameViewport.activate();
    Object.assign(host.window.visualViewport, { width: 393, height: 852 });
    host.window.emit('orientationchange');
    close(scaleOf(host.frame), 393 / 1920);
    close(parseFloat(host.frame.style.left), 0);
    close(parseFloat(host.frame.style.top), (852 - 1080 * 393 / 1920) / 2);
    assert.equal(game.window.GameViewport.active, true);
    assert.equal(host.navigations, 1);
});

test('browser bar and keyboard viewport changes recalculate scale and offsets', () => {
    const { host, game } = runningGame();
    game.window.GameViewport.activate();
    Object.assign(host.window.visualViewport, { width: 852, height: 310, offsetTop: 12, offsetLeft: 3 });
    host.window.visualViewport.emit('resize');
    close(scaleOf(host.frame), 310 / 1080);
    close(parseFloat(host.frame.style.top), 12);
    close(parseFloat(host.frame.style.left), 3 + (852 - 1920 * 310 / 1080) / 2);
});

test('title resizing stays native until the user starts the game', () => {
    const { host } = runningGame();
    Object.assign(host.window.visualViewport, { width: 393, height: 852 });
    host.window.visualViewport.emit('resize');
    assert.equal(host.frame.style.width, '393px');
    assert.equal(host.frame.style.height, '852px');
    assert.equal(scaleOf(host.frame), 1);
});

test('window resize fallback works when VisualViewport is unavailable', () => {
    const { host, game } = runningGame({ visual: false });
    game.window.GameViewport.activate();
    host.window.innerHeight = 350;
    host.window.emit('resize');
    close(scaleOf(host.frame), 350 / 1080);
});

test('a transient zero-sized viewport keeps the last valid frame', () => {
    const { host, game } = runningGame({ visual: false });
    game.window.GameViewport.activate();
    const transform = host.frame.style.transform;
    host.window.innerWidth = 0;
    host.window.emit('resize');
    assert.equal(host.frame.style.transform, transform);
});

test('reload and replay return to the native title without redirect loops', () => {
    const { host, game } = runningGame();
    game.window.GameViewport.activate();
    game.run();
    assert.equal(game.window.GameViewport.active, false);
    assert.equal(host.frame.style.width, '852px');
    assert.equal(game.redirects.length, 0);
    game.window.GameViewport.activate();
    assert.equal(host.frame.style.width, '1920px');
    assert.equal(host.navigations, 1);
});

test('unrelated frames cannot activate or reset the managed game', () => {
    const { host, game } = runningGame();
    const api = host.window.NMNLGameViewportHost;
    api.activate({});
    assert.equal(api.active, false);
    game.window.GameViewport.activate();
    assert.equal(api.connect({}), false);
    assert.equal(api.active, true);
});

test('cross-origin parent access cannot crash startup', () => {
    const page = environment({ width: 1920, height: 1080, touch: false });
    page.window.parent = new Proxy({}, { get() { throw new Error('SecurityError'); } });
    assert.doesNotThrow(() => page.run());
    assert.equal(page.window.GameViewport.active, false);
});

test('mobile map minimum zoom becomes the PC minimum after activation', () => {
    const page = environment();
    page.window.GameViewport = { active: false };
    page.window.MapContinentData = { grassTexture: 'grass.webp' };
    page.window.MapRegionBackground = { assetUrls: [] };
    page.document.documentElement.style = { setProperty() {} };
    page.document.querySelector = () => ({ clientWidth: 1600, clientHeight: 952 });
    vm.runInNewContext(read('map-scene.js'), page.context);
    close(page.window.MapScene.getMinZoom(), .1);
    page.document.querySelector = () => ({ clientWidth: 852, clientHeight: 300 });
    assert.ok(page.window.MapScene.getMinZoom() < .1);
    page.window.GameViewport.active = true;
    close(page.window.MapScene.getMinZoom(), .1);
});

test('the real startup hook activates before loading and disables mobile-only opening changes', () => {
    const source = read('game.js');
    const startup = source.slice(source.indexOf('gameStarted = true;'), source.indexOf('// 読み込み画面を表示', source.indexOf('gameStarted = true;')));
    let active = false, resets = 0;
    const context = {
        window: {
            GameViewport: { get active() { return active; }, activate() { active = true; } },
            OfflineDividends: { reset() { resets++; } },
            mobileOpeningLightweight: true,
            matchMedia: () => ({ matches: true })
        }, players: [], gameStarted: false
    };
    vm.runInNewContext(startup + '\nglobalThis.openingLightweight = lightweightOpening;', context);
    assert.equal(context.gameStarted, true);
    assert.equal(active, true);
    assert.equal(resets, 1);
    assert.equal(context.openingLightweight, false);
});

test('all coarse-pointer layout media rules are bounded below the virtual desktop size', () => {
    for (const filename of fs.readdirSync(directory).filter(name => name.endsWith('.css'))) {
        for (const match of read(filename).matchAll(/@media\s+([^{}]+)\{/g)) {
            if (!/pointer\s*:\s*coarse/.test(match[1])) continue;
            const bounded = /max-width\s*:\s*(\d+)px/.exec(match[1]) || /max-height\s*:\s*(\d+)px/.exec(match[1]);
            assert.ok(bounded, `${filename}: unbounded touch-only layout condition ${match[1]}`);
            assert.ok(Number(bounded[1]) < 1080 || /max-width/.test(bounded[0]) && Number(bounded[1]) < 1920);
        }
    }
});

test('entry bootstrap runs before game styles and the frame contains no new controls', () => {
    const entry = read('index.html'), host = read('game-viewport.html');
    assert.ok(entry.indexOf('game-viewport.js') < entry.indexOf('style.css'));
    assert.match(host, /data-game-viewport-host/);
    assert.equal((host.match(/<iframe\b/g) || []).length, 1);
    assert.doesNotMatch(host, /<button\b|<select\b|<input\b/);
    assert.match(host, /transform-origin:top left/);
    for (const filename of ['game-viewport.js', 'game-viewport.html']) assert.ok(fs.existsSync(path.join(directory, filename)));
});
