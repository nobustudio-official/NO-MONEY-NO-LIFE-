const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(process.env.NMNL_GAME_SOURCE || require.resolve('../game.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf('function showItemRoulette(');
const end = source.indexOf('\n// =========================\n// ボス挑戦確認', start);
assert(start >= 0 && end > start, 'Item roulette function must be found');
const rouletteSource = source.slice(start, end);

function runtime({ battleLoaded = true, online = false } = {}) {
    const errors = [], callbacks = [], timers = [], requests = [];
    const roulette = { style: {}, onclick: null };
    const sound = () => ({ currentTime: 0, pause() {}, play: () => Promise.resolve(), addEventListener() {}, removeEventListener() {} });
    let animationDone, serverDone, battleStarts = 0, appliedStates = 0;
    const context = {
        console: { error: (...args) => errors.push(args), warn() {} },
        document: { getElementById: id => id === 'itemRoulette' ? roulette : {} },
        ITEM_CONTENTS: { 1: { name: '回復薬', rank: 1 } },
        rouletteSound: sound(), roulettestopSound: sound(),
        createOnlineSyncEventId: () => 'treasure-test',
        applyOnlineCanonicalState: () => appliedStates++,
        startVerticalSlot: () => ({ stop(name, done) { assert.equal(name, '回復薬'); animationDone = done; } }),
        setTimeout: (done, delay) => { assert.equal(delay, 1000); timers.push(done); },
        onlineGame: online ? { isOnline: true, sync: { syncRoulette(request) {
            requests.push(request);
            return request.action === 'start' ? Promise.resolve({ ok: true }) : new Promise(resolve => { serverDone = resolve; });
        } } } : null
    };
    context.window = context;
    if (battleLoaded) context.startMonsterBattle = () => battleStarts++;
    vm.runInNewContext(rouletteSource, context);
    context.showItemRoulette({ name: '回復薬' }, result => callbacks.push(result), 'treasure-id');
    return {
        roulette, errors, callbacks, requests,
        get battleStarts() { return battleStarts; },
        get appliedStates() { return appliedStates; },
        stop: () => roulette.onclick(),
        animationDone: () => animationDone(),
        soundDone: () => context.roulettestopSound.onended(),
        serverDone: response => serverDone(response),
        flush: () => { while (timers.length) timers.shift()(); }
    };
}

test('opening an item roulette does not report a loaded battle UI as missing or start a battle', () => {
    const view = runtime();
    assert.equal(view.roulette.style.display, 'block');
    assert.equal(typeof view.roulette.onclick, 'function');
    assert.deepEqual(view.errors, []);
    assert.equal(view.battleStarts, 0);
});

test('an item roulette has no dependency on the monster battle UI', () => {
    const view = runtime({ battleLoaded: false });
    assert.deepEqual(view.errors, []);
    assert.equal(typeof view.roulette.onclick, 'function');
});

for (const first of ['soundDone', 'animationDone']) {
    test(`item receipt waits for both sound and animation when ${first} finishes first`, () => {
        const view = runtime();
        view.stop();
        assert.equal(view.roulette.onclick, null);
        view[first]();
        view.flush();
        assert.equal(view.callbacks.length, 0);
        view[first === 'soundDone' ? 'animationDone' : 'soundDone']();
        view.flush();
        assert.equal(view.roulette.style.display, 'none');
        assert.equal(view.callbacks.length, 1);
        assert.equal(view.callbacks[0].ok, true);
        assert.equal(view.callbacks[0].value, '回復薬');
        assert.deepEqual(view.errors, []);
    });
}

test('online item receipt also waits for the confirmed roulette result', async () => {
    const view = runtime({ online: true });
    view.stop();
    view.animationDone();
    view.soundDone();
    view.flush();
    assert.equal(view.callbacks.length, 0);
    assert.deepEqual(view.requests.map(request => request.action), ['start', 'stop']);
    const response = { ok: true, state: {}, value: '回復薬' };
    view.serverDone(response);
    await Promise.resolve();
    view.flush();
    assert.equal(view.callbacks.length, 1);
    assert.equal(view.callbacks[0], response);
    assert.equal(view.appliedStates, 1);
    assert.deepEqual(view.errors, []);
});
