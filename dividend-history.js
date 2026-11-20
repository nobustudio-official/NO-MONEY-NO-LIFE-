/* Economic history shared by offline play and the authoritative server. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('./economy'), require('./data').ASSET_CONTENTS, require('./dividend-selection'));
    else root.DividendHistory = factory({ calculateAssetDividend, calculateTotalAssetValue, calculateAssetHoldings }, ASSET_CONTENTS, root.DividendSelection);
})(typeof window === 'undefined' ? globalThis : window, function (economy, assets, selection) {
    'use strict';
    function recordPurchase(player, assetId, turn, paidPrice) {
        const asset = assets[assetId];
        if (!asset) return;
        const list = player.purchaseHistory || (player.purchaseHistory = []);
        list.push({ assetId, name: asset.name, price: paidPrice ?? asset.price, yield: asset.yield, turn, sequence: list.length + 1 });
        (player.assetAcquisitionPrices ??= {})[assetId] = paidPrice ?? asset.price;
    }
    function recordTransfer(player, assetId) {
        // A transfer has no purchase price. Do not reuse this owner's old purchase.
        (player.assetAcquisitionPrices ??= {})[assetId] = null;
    }
    function featured(player, previous, completed) {
        return selection.selectFeaturedPurchase(player.purchaseHistory, previous, completed);
    }
    function recordRound(state, turn) {
        const points = state.wealthHistory || (state.wealthHistory = []);
        const point = { turn, totals: state.players.map(p => economy.calculateTotalAssetValue(p, assets, state.marketExponent ?? 0)) };
        const index = points.findIndex(p => p.turn === turn);
        if (index < 0) points.push(point); else points[index] = point;
    }
    function presentation(state, previous, dividends) {
        return state.players.map((p, i) => {
            const holdings = economy.calculateAssetHoldings(p, assets, undefined, state.marketExponent ?? 0);
            return { name: p.name, characterId: p.characterId,
                cash: p.money, property: holdings.value, averageYield: holdings.weightedAverageYield,
                income: dividends[i].dividend,
                history: (state.wealthHistory || []).map(point => ({ turn: point.turn, value: point.totals[i] })) };
        });
    }
    return { recordPurchase, recordTransfer, featured, recordRound, presentation };
});
