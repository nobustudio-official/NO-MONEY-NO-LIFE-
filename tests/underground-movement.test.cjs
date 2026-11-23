const { test } = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../underground-rules');
const clone = value => JSON.parse(JSON.stringify(value));
function start() {
    const state = { currentTurn: 1, activePlayerIndex: 0, players: [{ money: 100, inventory: [], assets: [], underground: { position: 0, penica: 10000, turns: 0 } }] };
    rules.startTurn(state);
    act(state, 'next'); act(state, 'next', () => .6); act(state, 'next');
    return state; // Four steps, waiting for a direction.
}
function act(state, action, random) {
    const { turnKey, step, stage } = state.undergroundFlow;
    assert.equal(rules.act(state, { turnKey, step, stage, action }, {}, random), true);
}
function move(state, target) { act(state, 'target:' + target); act(state, 'next'); }
test('returning one square undoes the last step and restores its movement allowance', () => {
    const state = start();
    move(state, 1); move(state, 2);
    move(state, 1);
    assert.equal(state.undergroundFlow.remaining, 3);
    assert.deepEqual(state.undergroundFlow.moveHistory, [0, 1]);
    move(state, 0);
    assert.equal(state.undergroundFlow.remaining, 4);
    assert.equal(state.undergroundFlow.previousPosition, null);
    assert.deepEqual(state.undergroundFlow.moveHistory, [0]);
    assert.equal(state.players[0].underground.penica, 10000);
});
test('a restored checkpoint preserves undo, branching and reset to the actual start', () => {
    let state = start(); move(state, 1); move(state, 2); move(state, 16);
    state = clone(state);
    move(state, 2); // Undo at the central branch.
    assert.equal(state.undergroundFlow.remaining, 2);
    assert.equal(rules.canResetMove(state.undergroundFlow), true);
    act(state, 'resetMove'); act(state, 'next');
    assert.equal(state.players[0].underground.position, 0);
    assert.equal(state.undergroundFlow.remaining, 4);
    assert.deepEqual(state.undergroundFlow.moveHistory, [0]);
    assert.equal(state.players[0].money, 100);
    assert.equal(state.players[0].underground.penica, 10000);
});
test('destination routes still consume exactly the rolled steps and settle once', () => {
    const state = start(); act(state, 'destination:4');
    while (state.undergroundFlow.stage === 'moving') act(state, 'next');
    assert.equal(state.undergroundFlow.stage, 'slot');
    assert.equal(state.players[0].underground.position, 4);
    assert.equal(state.undergroundFlow.remaining, 0);
    assert.deepEqual(state.undergroundFlow.moveHistory, [0, 1, 2, 3, 4]);
    act(state, 'next', () => 0);
    const { turnKey, step, stage } = state.undergroundFlow;
    const request = { turnKey, step, stage, action: 'next' };
    assert.equal(rules.act(state, request, {}), true);
    const paid = state.players[0].underground.penica;
    assert.equal(rules.act(state, request, {}), false);
    assert.equal(state.players[0].underground.penica, paid);
    assert.equal(rules.act(state, { ...state.undergroundFlow, action: 'resetMove' }, {}), false);
});
test('old movement saves retain their known undo without fabricating an origin', () => {
    const state = start(); move(state, 1); move(state, 2);
    delete state.undergroundFlow.moveHistory;
    assert.equal(rules.canResetMove(state.undergroundFlow), false);
    move(state, 1);
    assert.equal(state.undergroundFlow.remaining, 3);
    assert.equal(rules.canResetMove(state.undergroundFlow), false);
});
test('invalid and repeated directional requests cannot change a movement twice', () => {
    const state = start(), flow = state.undergroundFlow;
    const request = { turnKey: flow.turnKey, step: flow.step, stage: flow.stage, action: 'target:8' };
    assert.equal(rules.act(state, request, {}), false);
    request.action = 'target:1';
    assert.equal(rules.act(state, request, {}), true);
    assert.equal(rules.act(state, request, {}), false);
    assert.equal(flow.remaining, 3);
});
