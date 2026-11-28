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
    assert.equal(s.ponzi.nextIndex, 1);
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
