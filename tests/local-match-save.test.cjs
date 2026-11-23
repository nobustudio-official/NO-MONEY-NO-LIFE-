const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { controller, validate, copy, indexedDBStore } = require('../local-match-save');

function state() {
    return { players: [{ name: 'A', characterId: 1, money: 50000, magicPower: 1000, position: 139,
        inventory: [1, { id: 3, remainingUses: 2 }], magic: [1, 2], assets: [1] }],
        maxTurns: 30, currentTurn: 7, currentPlayer: 0, remainingSteps: 0,
        boss: { id: 2, hp: 800, squareId: 45, defeatedCount: 1 },
        assetOwners: { 1: 0 }, dividends: { lastDividendTurn: 6, wealthHistory: [] }, world: {}, flows: {} };
}
function storage() {
    let value = null;
    return { read: async () => copy(value), write: async (next, replace) => {
        if (!replace && value && (value.gameId !== next.gameId || value.status !== 'unfinished' || value.revision >= next.revision)) return false;
        value = copy(next); return true;
    } };
}
test('a fresh controller restores the complete last safe checkpoint', async () => {
    const store = storage(), first = controller({ store, id: () => 'match-A' });
    await first.start(state());
    const s = state(); s.currentTurn = 8; s.players[0].money += 12345;
    await first.checkpoint(s, { phase: 'notice', details: { next: 'finish-turn', title: '報酬', message: 'paid' } });
    const restored = await controller({ store }).read();
    assert.equal(restored.gameId, 'match-A');
    assert.equal(restored.state.currentTurn, 8);
    assert.deepEqual(restored.state.players, s.players);
    assert.equal(restored.step.details.next, 'finish-turn');
    assert.equal(restored.state.dividends.lastDividendTurn, 6);
});
test('camera and interruption saves never persist a half-applied payment', async () => {
    const store = storage(), save = controller({ store });
    const s = state(); await save.start(s);
    s.players[0].money = 0; s.players[0].inventory.pop();
    await save.pending('item-use');
    await save.camera({ zoom: .1, left: 500, top: 900 });
    const restored = await save.read();
    assert.equal(restored.state.players[0].money, 50000);
    assert.equal(restored.state.players[0].inventory.length, 2);
    assert.equal(restored.camera.zoom, .1);
    assert.equal(restored.interruptedAction, 'item-use');
});
test('queued writes use immutable snapshots and preserve operation order', async () => {
    const store = storage(), save = controller({ store }), s = state();
    save.start(s); s.players[0].money = 100;
    save.checkpoint(s, { phase: 'ready' }); s.players[0].money = 200;
    await save.flush();
    assert.equal((await save.read()).state.players[0].money, 100);
});
test('new games and completion prevent stale tabs resurrecting old matches', async () => {
    const store = storage(), old = controller({ store, id: () => 'old' });
    await old.start(state());
    const fresh = controller({ store, id: () => 'new' });
    await fresh.discard(); await fresh.start(state());
    await old.checkpoint(state(), { phase: 'ready' });
    assert.equal((await fresh.read()).gameId, 'new');
    const stale = controller({ store }); await stale.start(null, null, null, await fresh.read());
    await fresh.finish(); await stale.checkpoint(state(), { phase: 'ready' });
    assert.equal((await fresh.read()).status, 'finished');
    assert.equal(await fresh.checkpoint(state(), { phase: 'ready' }), false);
});
test('online play neither creates nor changes local save records', async () => {
    const store = storage(), save = controller({ store, online: () => true });
    assert.equal(await save.start(state()), false);
    assert.equal(await save.checkpoint(state(), { phase: 'ready' }), false);
    assert.equal(await save.discard(), false);
    assert.equal(await store.read(), null);
});
test('corrupt and unsupported saves are rejected with explanations', async () => {
    const store = storage(), save = controller({ store }); await save.start(state());
    const good = await save.read();
    for (const mutate of [r => { r.version = 999; }, r => { r.state.currentPlayer = 9; },
        r => { r.state.players[0].money = null; }, r => { r.step.phase = 'unknown'; },
        r => { r.state.assetOwners[1] = 1; }, r => { r.step.phase = 'underground'; }, r => { r.step.phase = 'store'; }]) {
        const bad = copy(good); mutate(bad);
        assert.throws(() => validate(bad), /保存|対応|資産|プレイヤー/);
    }
});
test('unavailable IndexedDB and failed writes do not hang the game', async () => {
    await assert.rejects(indexedDBStore(null).read(), /自動保存/);
    let errors = 0;
    const save = controller({ store: { write: async () => { throw Error('quota'); } }, onError: () => errors++ });
    assert.equal(await save.start(state()), false);
    assert.equal(errors, 1);
});
test('a rejected checkpoint cannot contaminate a later camera-only save', async () => {
    const store = storage(), save = controller({ store }); await save.start(state());
    const invalid = state(); invalid.currentPlayer = 99;
    assert.throws(() => save.checkpoint(invalid, { phase: 'ready' }));
    await save.camera({ zoom: .8, left: 10, top: 20 });
    assert.equal((await save.read()).state.currentPlayer, 0);
});

test('real offline dividend stages restore without paying or applying the market twice', () => {
    function runtime(players, saved) {
        let next;
        const context = { window: {}, Date, Math, DIVIDEND_CYCLE: 6,
            resetMarketSeason: s => { s.marketExponent = 0; }, calculateAssetDividend: () => 1000,
            advanceMarketSeason: s => { s.marketExponent++; return { kind: 'boom' }; },
            DividendHistory: { recordRound() {}, presentation: () => [] },
            DividendPresentation: { show: (_, __, callback) => { next = callback; } } };
        vm.runInNewContext(fs.readFileSync(require.resolve('../dividend-offline.js'), 'utf8'), context);
        const dividends = context.window.OfflineDividends;
        if (saved) dividends.restore(saved, players); else dividends.reset(players);
        dividends.show(players, 6, () => {}, () => {}, 30);
        return { dividends, next: () => next() };
    }
    const players = [{ money: 100 }], first = runtime(players);
    first.next(); // payout
    assert.equal(players[0].money, 1100);
    const restored = runtime(copy(players), copy(first.dividends.snapshot()));
    assert.equal(restored.dividends.snapshot().lastDividendTurn, 6);
    for (let i = 0; i < 5; i++) restored.next();
    assert.equal(restored.dividends.snapshot().marketExponent, 1);
    const twice = runtime(copy(players), copy(restored.dividends.snapshot()));
    twice.next();
    assert.equal(twice.dividends.snapshot().marketExponent, 1);
});

function endingState(step = 0) {
    const s = state();
    s.currentTurn = s.maxTurns + 1;
    s.dividends.lastDividendTurn = s.maxTurns;
    s.flows.ending = { eventId: 'local-ending:test', startedAt: 1000, step,
        ranking: [{ playerIndex: 0, name: 'A', totalAsset: 60000 }],
        history: [{ turn: 0, totals: [50000] }, { turn: 30, totals: [60000] }] };
    return s;
}
test('all ending scenes remain resumable with their settled result until explicitly completed', async () => {
    const store = storage();
    let save = controller({ store, id: () => 'ending-match' });
    await save.start(state());
    for (let step = 0; step <= 7; step++) {
        const s = endingState(step);
        await save.checkpoint(s, { phase: 'ending' });
        const reloaded = await controller({ store }).read();
        assert.equal(reloaded.status, 'unfinished');
        assert.equal(reloaded.step.phase, 'ending');
        assert.deepEqual(reloaded.state, s);
        save = controller({ store });
        await save.start(null, null, null, reloaded);
    }
    await save.finish();
    assert.equal((await controller({ store }).read()).status, 'finished');
});
test('late game callbacks and camera saves cannot replace an ending checkpoint', async () => {
    const store = storage(), save = controller({ store });
    await save.start(state());
    await save.checkpoint(endingState(7), { phase: 'ending' });
    assert.equal(await save.checkpoint(state(), { phase: 'ready' }), false);
    assert.equal(await save.pending('late-item-use'), false);
    await save.camera({ zoom: .8, top: 1, left: 2 });
    assert.equal((await save.read()).step.phase, 'ending');
    assert.deepEqual((await save.read()).state, endingState(7));
    const stale = controller({ store });
    await stale.start(null, null, null, await save.read());
    await save.finish();
    assert.equal(await stale.checkpoint(endingState(7), { phase: 'ending' }), false);
    assert.equal((await save.read()).status, 'finished');
});
test('invalid ending stages and mismatched final results fail validation', async () => {
    const save = controller({ store: storage() });
    await save.start(endingState(), { phase: 'ending' });
    const good = await save.read();
    for (const mutate of [r => { r.state.flows.ending = null; },
        r => { r.state.flows.ending.step = 8; }, r => { r.state.flows.ending.ranking = []; },
        r => { r.state.flows.ending.ranking[0].playerIndex = 1; },
        r => { r.state.flows.ending.ranking[0].totalAsset = null; },
        r => { r.state.flows.ending.history[0].totals = []; },
        r => { r.step.phase = 'ready'; }]) {
        const bad = copy(good); mutate(bad);
        assert.throws(() => validate(bad), /終了演出/);
    }
});
