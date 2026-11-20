(function (root, factory) {
    const rules = factory();
    if (typeof module !== 'undefined' && module.exports) module.exports = rules;
    else root.SpecialRewardRules = rules;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const TURN = 25, BOOK_ID = 33, TAXI_ID = 2, CLAIM_DURATION_MS = 1000;
    const defaultState = () => ({ evaluated: false, recipientIndex: null, status: 'pending', page: 0, claiming: null, claimed: [] });
    const pending = reward => reward?.status === 'announcing' || reward?.status === 'receiving';
    function ensure(state) {
        if (!state.specialReward) state.specialReward = defaultState();
        if (!Array.isArray(state.guidebookHistory)) state.guidebookHistory = state.players.map(() => false);
        return state.specialReward;
    }
    function beginTurn(state, totalAssets) {
        const reward = ensure(state);
        if (!reward.evaluated && Number(state.currentTurn) === TURN && Number(state.activePlayerIndex) === 0) {
            reward.evaluated = true;
            const ranked = state.players.map((player, index) => ({ index, value: Number(totalAssets(player)) || 0 }))
                .sort((a, b) => a.value - b.value || b.index - a.index);
            const lowest = ranked[0];
            if (lowest && !state.guidebookHistory[lowest.index]) reward.recipientIndex = lowest.index;
            else reward.status = 'skipped';
        }
        if (reward.status === 'pending' && reward.recipientIndex === Number(state.activePlayerIndex)) {
            reward.status = 'announcing';
            reward.page = 0;
        }
        return reward;
    }
    function act(state, action, payload = {}) {
        const reward = ensure(state), active = Number(state.activePlayerIndex);
        if (reward.recipientIndex !== active) return false;
        if (action === 'next') {
            if (reward.status !== 'announcing' || Number(payload.page) !== reward.page || reward.page > 2) return false;
            if (reward.page < 2) reward.page++;
            else reward.status = 'receiving';
            return true;
        }
        if (action === 'claim') {
            if (reward.status !== 'receiving' || reward.claiming != null) return false;
            const itemId = Number(payload.itemId);
            if (![BOOK_ID, TAXI_ID].includes(itemId) || reward.claimed.includes(itemId)) return false;
            reward.claiming = itemId;
            return true;
        }
        return false;
    }
    function completeClaim(state) {
        const reward = state.specialReward;
        const player = state.players[state.activePlayerIndex];
        if (reward?.status !== 'receiving' || reward.claiming == null || reward.recipientIndex !== state.activePlayerIndex || !player) return false;
        (player.inventory ||= []).push(reward.claiming);
        reward.claimed.push(reward.claiming);
        reward.claiming = null;
        if (reward.claimed.length === 2) reward.status = 'complete';
        return true;
    }
    return Object.freeze({ TURN, BOOK_ID, TAXI_ID, CLAIM_DURATION_MS, ensure, pending, beginTurn, act, completeClaim });
});
