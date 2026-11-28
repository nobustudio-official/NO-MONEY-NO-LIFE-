const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../ponzi-rules');

function state() {
    return {
        currentTurn: 7, activePlayerIndex: 0,
        players: [{ money: 200000 }, { money: 200000 }],
        ponzi: { phase: 'choices', round: 1, nextIndex: 0,
            investments: [20000, 30000], declinedThisRound: [false, false], payout: null }
    };
}

test('cancellation refunds once and permanently records only the cancelling player', () => {
    const s = state();
    assert.equal(rules.act(s, 'cancel'), null);
    assert.equal(s.players[0].money, 220000);
    assert.deepEqual(s.ponzi.investments, [0, 30000]);
    assert.deepEqual(s.ponzi.cancelled, [true, false]);
    assert.equal(s.ponzi.nextIndex, 0);
    assert.equal(s.ponzi.phase, 'refunded');
    assert.deepEqual(s.ponzi.refund, { playerIndex: 0, amount: 20000 });
    assert.equal(rules.pending(s), true);
    assert.equal(rules.act(s, 'acknowledge'), null);
    assert.equal(s.ponzi.nextIndex, 1);
    assert.equal(s.ponzi.refund, undefined);
    s.ponzi.nextIndex = 0;
    for (const [action, amount] of [['cancel'], ['invest', 10000]]) {
        const before = JSON.stringify(s);
        assert.equal(typeof rules.act(s, action, amount), 'string');
        assert.equal(JSON.stringify(s), before);
    }
});

test('the cancellation lock survives saving and the next successful payout', () => {
    let s = state();
    rules.act(s, 'cancel');
    assert.equal(rules.act(s, 'acknowledge'), null);
    s.activePlayerIndex = 1;
    assert.equal(rules.act(s, 'invest', 10000), null);
    assert.equal(rules.act(s, 'acknowledge'), null);
    assert.equal(s.ponzi.phase, 'waiting');
    s = JSON.parse(JSON.stringify(s));
    s.currentTurn = s.ponzi.nextPayoutTurn;
    s.activePlayerIndex = 0;
    rules.prepare(s);
    assert.equal(s.ponzi.payout.failed, false);
    assert.deepEqual(s.ponzi.payout.amounts, [0, 12000]);
    assert.equal(rules.act(s, 'continue'), null);
    const before = JSON.stringify(s);
    assert.match(rules.act(s, 'invest', 10000), /再出資はできません/);
    assert.equal(JSON.stringify(s), before);
    assert.equal(rules.act(s, 'decline'), null);
    assert.equal(s.ponzi.nextIndex, 1);
});

test('declining without cancellation leaves future investment available', () => {
    const s = state();
    rules.act(s, 'decline');
    assert.equal(s.ponzi.cancelled, undefined);
    s.ponzi.nextIndex = 0;
    assert.equal(rules.act(s, 'invest', 10000), null);
    assert.equal(s.players[0].money, 190000);
    assert.equal(s.ponzi.investments[0], 30000);
});

test('investment still rejects invalid amounts without changing balances', () => {
    const s = state();
    for (const amount of [0, 9999, 10001, 210000, NaN, Infinity]) {
        const before = JSON.stringify(s);
        assert.equal(typeof rules.act(s, 'invest', amount), 'string');
        assert.equal(JSON.stringify(s), before);
    }
    assert.equal(rules.config.investmentUnit, 10000);
    assert.equal(rules.act(s, 'invest', 10000), null);
    assert.equal(s.players[0].money, 190000);
});

function expectDepartureOnNextVisit(s) {
    assert.equal(s.ponzi.phase, 'waiting');
    assert.equal(s.ponzi.nextPayoutTurn, s.currentTurn + rules.config.payoutInterval);
    const money = s.players.map(p => p.money), due = s.ponzi.nextPayoutTurn;
    s.currentTurn = due - 1; s.activePlayerIndex = 0;
    rules.prepare(s);
    assert.equal(s.ponzi.phase, 'waiting');
    s = JSON.parse(JSON.stringify(s));
    s.currentTurn = due; s.activePlayerIndex = 1;
    rules.prepare(s);
    assert.equal(s.ponzi.phase, 'waiting');
    s.activePlayerIndex = 0;
    rules.prepare(s);
    assert.equal(s.ponzi.phase, 'departed');
    assert.equal(s.ponzi.payout, null);
    assert.equal(rules.pending(s), true);
    assert.deepEqual(s.players.map(p => p.money), money);
    assert.equal(rules.act(s, 'finish'), null);
    assert.equal(s.ponzi.phase, 'finished');
    s.currentTurn += 10;
    rules.prepare(s);
    assert.equal(s.ponzi.phase, 'finished');
    assert.equal(rules.pending(s), false);
    assert.deepEqual(s.players.map(p => p.money), money);
}

test('everyone declining the first offer schedules a single departure notice on the next visit', () => {
    const s = state();
    s.ponzi.round = 0; s.ponzi.investments = [0, 0];
    for (const index of [0, 1]) {
        s.activePlayerIndex = index;
        assert.equal(rules.act(s, 'decline'), null);
    }
    expectDepartureOnNextVisit(s);
});

test('everyone cancelling, or cancellation followed by declining, ends with the scheduled departure notice', () => {
    for (const secondAction of ['cancel', 'decline']) {
        const s = state();
        if (secondAction === 'decline') s.ponzi.investments[1] = 0;
        for (const [index, action] of [[0, 'cancel'], [1, secondAction]]) {
            s.activePlayerIndex = index;
            assert.equal(rules.act(s, action), null);
            if (action === 'cancel') assert.equal(rules.act(s, 'acknowledge'), null);
        }
        assert.deepEqual(s.ponzi.investments, [0, 0]);
        assert.equal(s.players[0].money, 220000);
        assert.equal(s.players[1].money, secondAction === 'cancel' ? 230000 : 200000);
        expectDepartureOnNextVisit(s);
    }
});

test('declining additional investment while money remains invested still uses the existing scam rule', () => {
    const s = state();
    for (const index of [0, 1]) {
        s.activePlayerIndex = index;
        assert.equal(rules.act(s, 'decline'), null);
    }
    s.activePlayerIndex = 0; s.currentTurn = s.ponzi.nextPayoutTurn;
    rules.prepare(s);
    assert.equal(s.ponzi.phase, 'payout');
    assert.equal(s.ponzi.payout.failed, true);
    assert.deepEqual(s.ponzi.payout.investments, [20000, 30000]);
});

function payoutState(investments = [20000, 30000]) {
    const s = state();
    s.ponzi.phase = 'waiting';
    s.ponzi.nextPayoutTurn = s.currentTurn;
    s.ponzi.investments = investments;
    rules.prepare(s);
    return s;
}

test('successful dividends pay all players when the report opens, once across retries and saved recovery', () => {
    let s = payoutState();
    assert.equal(s.ponzi.phase, 'payout');
    assert.equal(s.ponzi.payout.settled, false);
    assert.deepEqual(s.players.map(p => p.money), [200000, 200000]);
    assert.deepEqual(s.ponzi.payout.amounts, [6000, 9000]);
    assert.equal(rules.act(s, 'receive'), null);
    assert.deepEqual(s.players.map(p => p.money), [206000, 209000]);
    assert.equal(s.ponzi.payout.settled, true);
    assert.equal(rules.act(s, 'receive'), null);
    s = JSON.parse(JSON.stringify(s));
    assert.equal(rules.act(s, 'receive'), null);
    assert.deepEqual(s.players.map(p => p.money), [206000, 209000]);
    assert.equal(rules.act(s, 'continue'), null);
    assert.deepEqual(s.players.map(p => p.money), [206000, 209000]);
});

test('failed payouts and already-paid legacy saves never add gold again', () => {
    const failed = payoutState([200000, 210000]);
    assert.equal(failed.ponzi.payout.failed, true);
    assert.equal(rules.act(failed, 'receive'), null);
    assert.equal(rules.act(failed, 'continue'), null);
    assert.deepEqual(failed.players.map(p => p.money), [200000, 200000]);
    assert.equal(failed.ponzi.phase, 'ending');
    const legacy = payoutState();
    legacy.players[0].money += 6000; legacy.players[1].money += 9000;
    delete legacy.ponzi.payout.settled;
    assert.equal(rules.act(legacy, 'receive'), null);
    assert.equal(rules.act(legacy, 'continue'), null);
    assert.deepEqual(legacy.players.map(p => p.money), [206000, 209000]);
});

test('only the current event owner can receive; continuing without the new screen action stays compatible', () => {
    const s = payoutState();
    s.activePlayerIndex = 1;
    const before = JSON.stringify(s);
    assert.equal(typeof rules.act(s, 'receive'), 'string');
    assert.equal(JSON.stringify(s), before);
    s.activePlayerIndex = 0;
    assert.equal(rules.act(s, 'continue'), null);
    assert.deepEqual(s.players.map(p => p.money), [206000, 209000]);
    assert.equal(s.ponzi.phase, 'choices');
});

test('the refund notice survives saved recovery and acknowledges without refunding twice', () => {
    let s = state();
    assert.equal(rules.act(s, 'cancel'), null);
    s = JSON.parse(JSON.stringify(s));
    assert.equal(s.ponzi.phase, 'refunded');
    assert.equal(s.ponzi.refund.amount, 20000);
    assert.equal(rules.pending(s), true);
    const before = JSON.stringify(s);
    assert.equal(typeof rules.act(s, 'cancel'), 'string');
    assert.equal(JSON.stringify(s), before);
    assert.equal(rules.act(s, 'acknowledge'), null);
    assert.equal(s.players[0].money, 220000);
    assert.equal(s.ponzi.nextIndex, 1);
    assert.equal(rules.pending(s), false);
});

test('the investment notice records this payment, survives recovery and clears after the follow-up', () => {
    for (const round of [0, 1]) {
        let s = state();
        s.ponzi.round = round;
        s.ponzi.investments[0] = round ? 20000 : 0;
        assert.equal(rules.act(s, 'invest', 40000), null);
        assert.equal(s.ponzi.phase, 'thanks');
        assert.deepEqual(s.ponzi.investmentNotice, { playerIndex: 0, amount: 40000 });
        assert.equal(s.players[0].money, 160000);
        assert.equal(s.ponzi.investments[0], round ? 60000 : 40000);
        s = JSON.parse(JSON.stringify(s));
        const before = JSON.stringify(s);
        assert.equal(typeof rules.act(s, 'invest', 40000), 'string');
        assert.equal(JSON.stringify(s), before);
        assert.equal(rules.act(s, 'acknowledge'), null);
        assert.equal(s.ponzi.investmentNotice, undefined);
        assert.equal(s.ponzi.nextIndex, 1);
        assert.equal(s.players[0].money, 160000);
    }
});
