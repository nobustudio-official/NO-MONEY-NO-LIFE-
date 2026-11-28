const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const rules = require('../underground-rules');
const immunity = require('../disadvantage-immunity-rules');
const specialItems = require('../special-item-rules');

const game = fs.readFileSync(require.resolve('../game.js'), 'utf8').replace(/\r\n/g, '\n');
const start = game.indexOf('function beginPlayerTurn(player)');
const end = game.indexOf('\n// =========================\n// ターン終了', start);
assert(start >= 0 && end > start);

function act(state, action) {
    const { turnKey, step, stage } = state.undergroundFlow;
    return rules.act(state, { turnKey, step, stage, action }, {});
}

function stateFor(count) {
    const index = count - 1;
    return {
        currentTurn: 8, activePlayerIndex: index,
        players: Array.from({ length: count }, (_, i) => ({ name: `P${i}`, money: i === index ? 50 : 100,
            inventory: [], assets: [], underground: null, position: 139 })),
        undergroundFlow: { turnKey: `8:${index}`, step: 10, stage: 'returnImmunity', playerIndex: index, victory: true }
    };
}

function turnRuntime(state) {
    const announcements = [], expiryViews = [];
    const noop = () => {};
    const context = {
        console: { log: noop }, players: state.players,
        localSave: null, preloadPlayerDirectionSprites: noop,
        offlineImmunityExpiry: null, offlineImmunityReady: null, walletAnnouncementsTurnKey: null,
        offlineUndergroundTurnKey: null, offlineItemSealCheckKey: null,
        offlineSpecialReward: null, offlineGuidebookState: () => ({}),
        GuidebookRules: { beginTurn: noop }, SpecialRewardRules: { beginTurn: noop, pending: () => false },
        DisadvantageImmunityRules: immunity, UndergroundRules: rules, SpecialItemRules: specialItems,
        calculateTotalAssetValue: () => 0,
        getOfflineUndergroundState: () => state, applyOfflineUnderground: noop,
        MapAreaAudio: { updateForPlayer: noop },
        inventoryButton: { disabled: false }, rouletteButton: { disabled: false },
        applyTurnStartItemEffects: () => [], removeExpiredItems: () => [],
        updatePlayerStatusUI: noop, renderMap: noop, renderPlayers: noop, updateNextPlayerView: noop,
        guidebookState: () => state, renderGuidebook: () => expiryViews.push(context.offlineImmunityReady),
        showTurnStartAnnouncements: (player, effects, expired, boss, done) => announcements.push({ player, done })
    };
    context.window = context;
    vm.runInNewContext(game.slice(start, end), context);
    return { context, announcements, expiryViews, begin() {
        context.currentTurn = state.currentTurn;
        context.currentPlayer = state.activePlayerIndex;
        context.beginPlayerTurn(state.players[state.activePlayerIndex]);
    } };
}

for (const count of [1, 2, 6]) {
    test(`return protection lasts through other players and expires before the next own action (${count} players)`, () => {
        let state = stateFor(count);
        assert.equal(act(state, 'next'), false);
        assert.equal(immunity.isActive(state.players[count - 1]), false);
        assert.equal(act(state, 'immunitySoundComplete'), true);
        assert.equal(state.players[count - 1].disadvantageImmunityTurnKey, `8:${count - 1}`);
        assert.equal(act(state, 'next'), true);
        assert.equal(state.undergroundFlow.stage, 'done');
        state = JSON.parse(JSON.stringify(state)); // The activation turn survives save/recovery.
        const protectedPlayer = state.players[count - 1], turns = turnRuntime(state);
        for (let step = 1; step < count; step++) {
            state.activePlayerIndex = step - 1;
            state.currentTurn = 9;
            turns.begin();
            assert.equal(immunity.isActive(protectedPlayer), true);
            specialItems.equalize(state.players);
            assert.equal(protectedPlayer.money, 50);
        }
        state.activePlayerIndex = count - 1;
        state.currentTurn = 9;
        turns.begin();
        assert.equal(immunity.isActive(protectedPlayer), false);
        assert.equal(protectedPlayer.disadvantageImmunityTurnKey, undefined);
        assert.equal(turns.context.rouletteButton.disabled, true);
        assert.equal(turns.context.inventoryButton.disabled, true);
        turns.announcements.at(-1).done();
        assert.deepEqual(turns.expiryViews, [`9:${count - 1}`]);
        turns.begin();
        assert.equal(turns.announcements.length, count); // Waiting for the existing expiry notice cannot repeat it.
    });
}

test('returning without a foreman victory does not grant protection', () => {
    const state = stateFor(2);
    Object.assign(state.undergroundFlow, { stage: 'returnItem', victory: false, returnItems: [1], returnItemIndex: 1 });
    assert.equal(act(state, 'next'), true);
    assert.equal(state.undergroundFlow.stage, 'done');
    assert.equal(immunity.isActive(state.players[1]), false);
    assert.equal(state.players[1].disadvantageImmunityTurnKey, undefined);
});

test('item-granted protection still follows the existing turn-start expiry', () => {
    const state = stateFor(2), player = state.players[1];
    state.undergroundFlow = null;
    immunity.activate(player);
    player.disadvantageImmunityTurnKey = '8:1';
    const turns = turnRuntime(state);
    turns.begin();
    assert.equal(immunity.isActive(player), true);
    state.currentTurn = 9;
    turns.begin();
    assert.equal(immunity.isActive(player), false);
    turns.announcements.at(-1).done();
    assert.deepEqual(turns.expiryViews, ['9:1']);
});
