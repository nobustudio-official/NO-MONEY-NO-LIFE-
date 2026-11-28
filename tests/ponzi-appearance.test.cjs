const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('../ponzi-rules');
const economy = require('../economy');
const copy = value => JSON.parse(JSON.stringify(value));

function inflation(previousKind = 'normal', completedTurn = 18) {
    const state = {
        currentTurn: completedTurn + 1, activePlayerIndex: 0,
        players: [{ money: 500001, assets: [] }, { money: 500001, assets: [] }],
        marketEventTurn: 18, marketOutcomeAt18: 'boom',
        marketKind: previousKind, marketExponent: previousKind === 'crash' ? -1 : 0,
        marketStreak: previousKind === 'normal' ? 0 : 1
    };
    economy.advanceMarketSeason(state, completedTurn, false, () => .1);
    return state;
}

test('all players over 500,000G and the second inflation turn are both required', () => {
    for (const turn of [19, 20, 21]) {
        const state = inflation(); state.currentTurn = turn;
        rules.prepare(state);
        assert.equal(Boolean(state.ponzi), turn === 20);
    }
    for (const balances of [[500000, 500001], [499999, 900000], [300000, 800000]]) {
        const state = inflation(); state.currentTurn = 20;
        state.players.forEach((p, i) => { p.money = balances[i]; });
        rules.prepare(state);
        assert.equal(state.ponzi, undefined);
    }
    const rich = inflation(); rich.currentTurn = 20; rich.marketKind = 'normal';
    rules.prepare(rich);
    assert.equal(rich.ponzi, undefined);
});

test('the asset requirement includes each player’s holdings at current prices', () => {
    const state = inflation(); state.currentTurn = 20;
    state.players = [{ money: 100001, assets: [1] }, { money: 400000, assets: [2] }];
    const assets = { 1: { price: 300000, yield: 10 }, 2: { price: 100000, yield: 10 } };
    rules.prepare(state, p => economy.calculateTotalAssetValue(p, assets, state.marketExponent));
    assert.equal(state.ponzi.phase, 'choices');
});

test('deflation-to-inflation reversals are excluded; other inflation events retain their own start turn', () => {
    for (const previous of ['normal', 'boom', 'crash']) {
        const state = inflation(previous, 24); state.currentTurn = 26;
        assert.equal(state.marketStartedTurn, 25);
        assert.equal(state.marketPreviousKind, previous);
        rules.prepare(state);
        assert.equal(Boolean(state.ponzi), previous !== 'crash');
    }
    const unknown = inflation(); unknown.currentTurn = 20; delete unknown.marketPreviousKind;
    rules.prepare(unknown);
    assert.equal(unknown.ponzi, undefined);
});

test('appearance belongs to the first player and a completed event never appears again', () => {
    const state = inflation(); state.currentTurn = 20; state.activePlayerIndex = 1;
    rules.prepare(state); assert.equal(state.ponzi, undefined);
    state.activePlayerIndex = 0;
    rules.prepare(state); assert.equal(state.ponzi.phase, 'choices');
    state.ponzi.phase = 'finished';
    rules.prepare(state); assert.equal(state.ponzi.phase, 'finished');
    economy.resetMarketSeason(state);
    assert.equal(state.marketStartedTurn, null);
    assert.equal(state.marketPreviousKind, null);
});

function waiting(count, over = false) {
    return {
        currentTurn: 23, activePlayerIndex: 0,
        players: Array.from({ length: count }, () => ({ money: 900000 })),
        ponzi: { phase: 'waiting', round: 1, nextIndex: 0, nextPayoutTurn: 23,
            investments: Array.from({ length: count }, (_, i) => 200000 + (over && i === 0 ? 10000 : 0)),
            declinedThisRound: Array(count).fill(false) }
    };
}

test('the scam threshold is strictly greater than player count times 200,000G', () => {
    for (const count of [2, 3, 6]) for (const over of [false, true]) {
        const state = waiting(count, over);
        rules.prepare(state);
        assert.equal(state.ponzi.phase, 'payout');
        assert.equal(state.ponzi.payout.failed, over);
        assert.ok(state.players.every(p => p.money === 900000));
    }
});

test('mixed cancellation and declining end the event, but another player investing keeps it alive', () => {
    for (const declined of [false, true]) {
        const state = waiting(2);
        state.ponzi.investments = [0, 30000];
        state.ponzi.cancelled = [true, false];
        state.ponzi.declinedThisRound = [false, declined];
        rules.prepare(state);
        assert.equal(state.ponzi.payout.failed, declined);
    }
    const empty = waiting(2);
    empty.ponzi.investments = [0, 0]; empty.ponzi.cancelled = [true, false];
    empty.ponzi.declinedThisRound = [false, true];
    rules.prepare(empty);
    assert.equal(empty.ponzi.phase, 'departed');
    assert.equal(empty.ponzi.payout, null);
});

test('end conditions are checked at the scheduled visit, rather than immediately after choices', () => {
    const state = waiting(2, true); state.currentTurn = 22;
    rules.prepare(state); assert.equal(state.ponzi.phase, 'waiting');
    state.currentTurn = 23; state.activePlayerIndex = 1;
    rules.prepare(state); assert.equal(state.ponzi.phase, 'waiting');
    state.activePlayerIndex = 0;
    rules.prepare(state); assert.equal(state.ponzi.payout.failed, true);
});

test('the real offline market flow passes the appearance timing through the game adapter and saved recovery', () => {
    function runtime(saved) {
        let next, opened;
        const players = [{ money: 500001, assets: [] }, { money: 500001, assets: [] }];
        const context = {
            Date, Math, players, currentPlayer: 0, currentTurn: 19, localSave: null,
            gameOpeningComplete: true, PonziRules: rules,
            calculateTotalAssetValue: p => p.money,
            DIVIDEND_CYCLE: 6, resetMarketSeason: economy.resetMarketSeason,
            marketEventTurnForBossDefeat: economy.marketEventTurnForBossDefeat,
            advanceMarketSeason: economy.advanceMarketSeason, calculateAssetDividend: () => 0,
            DividendHistory: { recordRound() {}, presentation: () => [] },
            DividendPresentation: { show(_, __, callback) { next = callback; } },
            PonziPresentation: { isOpen: () => false, open(state) { opened = state; } },
            updateNextPlayerView(callback) { callback(); }
        };
        context.window = context;
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(require.resolve('../dividend-offline.js'), 'utf8'), context);
        const dividends = context.OfflineDividends;
        if (saved) dividends.restore(saved, players);
        else {
            dividends.reset(players);
            dividends.setMarketEventTurnFromBossDefeat(12);
            dividends.setMarketOutcomeAt18('boom');
            dividends.show(players, 18, () => {}, () => {}, 30);
            for (let i = 0; i < 6; i++) next();
        }
        const game = fs.readFileSync(require.resolve('../game.js'), 'utf8');
        vm.runInContext(game.slice(game.indexOf('let offlinePonzi ='), game.indexOf('function beginPlayerTurn(')), context);
        return { context, dividends, get opened() { return opened; } };
    }
    const original = runtime();
    assert.equal(original.dividends.marketStartedTurn(), 19);
    assert.equal(original.dividends.marketPreviousKind(), 'normal');
    const restored = runtime(copy(original.dividends.snapshot()));
    for (const r of [original, restored]) {
        assert.equal(r.context.startPonziTurn(r.context.players[0]), false);
        r.context.currentTurn = 20;
        assert.equal(r.context.startPonziTurn(r.context.players[0]), true);
        assert.equal(r.opened.ponzi.phase, 'choices');
        assert.equal(r.opened.marketStartedTurn, 19);
    }
});
