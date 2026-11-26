const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../map-workshop-scene.js'), 'utf8');
const effects = source.slice(source.indexOf('    function magicEffectsActive('), source.indexOf('    function setViewport('));
const pause = source.slice(source.indexOf('    function pauseDetail('), source.indexOf('    function releaseDetail('));

function runtime() {
    let now = 0, id = 0, callbacks = 0, writes = 0, lowDetail = false;
    const timers = new Map(), classes = new Set();
    const style = () => new Proxy({}, {set(target, key, value) { writes++; target[key] = value; return true; }});
    const pair = {
        elf: {onScreen: true, width: 100}, target: {onScreen: true, image: {style: style()}},
        from: {x: 20, y: 40}, to: {x: 200, y: 40},
        effectBounds: {left: -5, right: 225, top: 15, bottom: 65}, visible: false,
        bolt: {style: style()}, ring: {style: style()}
    };
    const board = {isConnected: true, classList: {contains: name => classes.has(name)}};
    const state = {pairs: [pair], visibleBounds: {left: 0, right: 300, top: 0, bottom: 100}, effectTimer: 0};
    const context = {
        document: {hidden: false}, reducedMotion: {matches: false},
        performance: {now: () => now}, boards: new WeakMap([[board, state]]),
        MapDetailLevel: {isLowDetail: () => lowDetail},
        setTimeout(callback, delay) { timers.set(++id, {callback, at: now + delay}); return id; },
        clearTimeout: key => timers.delete(key)
    };
    context.window = context;
    vm.runInNewContext(effects + pause + '\nglobalThis.api = {syncMagicEffects, pauseDetail};', context);
    return {
        pair, board, state, context, classes, timers,
        sync: () => context.api.syncMagicEffects(board, state),
        pause: () => context.api.pauseDetail(board),
        lowDetail(value) { lowDetail = value; },
        get callbacks() { return callbacks; }, get writes() { return writes; },
        advance(ms) {
            const target = now + ms;
            for (let limit = 0; limit < 1000; limit++) {
                const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
                if (!next || next[1].at > target) { now = target; return; }
                now = next[1].at; timers.delete(next[0]); callbacks++; next[1].callback();
            }
            assert.fail('effect timer failed to advance');
        }
    };
}

test('magic sleeps between shots and retains projectile, impact and recoil timing', () => {
    const run = runtime(); run.sync();
    assert.equal(run.timers.size, 1);
    run.advance(479); assert.equal(run.callbacks, 0);
    run.advance(1); assert.equal(run.pair.bolt.style.display, 'block');
    run.advance(900); assert.equal(run.pair.bolt.style.display, 'none');
    assert.equal(run.pair.ring.style.display, 'block');
    run.advance(100); assert.notEqual(run.pair.target.image.style.rotate, '0deg');
    run.advance(400);
    assert.equal(run.pair.ring.style.display, 'none');
    assert.equal(run.pair.target.image.style.rotate, '0deg');
    const writes = run.writes;
    for (let i = 0; i < 20; i++) run.sync();
    assert.equal(run.writes, writes, 'unchanged viewports must not redraw or reset the waiting timer');
    run.advance(2120);
    assert.ok(run.callbacks <= 31, 'one cycle needs about 30 callbacks instead of 80');
    assert.equal(run.timers.size, 1);
    run.advance(480); assert.equal(run.pair.bolt.style.display, 'block');
});

test('leaving the visible viewport cancels the timer and returning resumes the current phase', () => {
    const run = runtime(); run.sync(); run.advance(600);
    run.pair.elf.onScreen = run.pair.target.onScreen = false;
    run.state.visibleBounds = {left: 1000, right: 1100, top: 0, bottom: 100};
    run.sync(); assert.equal(run.timers.size, 0);
    assert.equal(run.pair.bolt.style.display, 'none');
    const calls = run.callbacks; run.advance(4000); assert.equal(run.callbacks, calls);
    run.state.visibleBounds = {left: 0, right: 300, top: 0, bottom: 100};
    run.sync(); assert.equal(run.pair.bolt.style.display, 'block');
    assert.equal(run.timers.size, 1, 'a projectile crossing the viewport is visible even with both children offscreen');
});

test('camera pauses, hidden pages, lightweight mode and reduced motion stop and resume effects', () => {
    for (const reason of ['camera', 'hidden', 'low', 'reduced']) {
        const run = runtime(); run.sync(); run.advance(600);
        const toggle = value => {
            if (reason === 'camera') value ? run.classes.add('map-camera-busy') : run.classes.delete('map-camera-busy');
            if (reason === 'hidden') run.context.document.hidden = value;
            if (reason === 'low') run.lowDetail(value);
            if (reason === 'reduced') run.context.reducedMotion.matches = value;
        };
        toggle(true); run.sync(); assert.equal(run.timers.size, 0, reason);
        assert.equal(run.pair.visible, false, reason);
        toggle(false); run.sync(); assert.equal(run.timers.size, 1, reason);
        run.pause(); assert.equal(run.timers.size, 0);
        assert.equal(run.pair.visible, false);
        run.sync(); assert.equal(run.timers.size, 1, 'resume after an explicit camera pause');
        run.board.isConnected = false; run.advance(50); assert.equal(run.timers.size, 0);
    }
});
