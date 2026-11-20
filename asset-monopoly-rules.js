(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.AssetMonopolyRules = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';

    function owns(ownerMap, assetId, playerIndex) {
        return ownerMap?.[assetId] != null && Number(ownerMap[assetId]) === Number(playerIndex);
    }

    function monopolizedAssetIds(shopBoxes, ownerMap, playerIndex) {
        const result = new Set();
        Object.entries(shopBoxes || {}).forEach(([shopId, shop]) => {
            const contents = Array.isArray(shop?.contents) ? [...new Set(shop.contents.map(Number))] : [];
            if (contents.length && contents.every(id => owns(ownerMap, id, playerIndex))) {
                contents.forEach(id => result.add(id));
            }
        });
        return result;
    }

    function newlyMonopolized(shopBoxes, beforeOwners, afterOwners, playerIndex) {
        return Object.entries(shopBoxes || {}).flatMap(([shopId, shop]) => {
            const contents = Array.isArray(shop?.contents) ? [...new Set(shop.contents.map(Number))] : [];
            const wasMonopolized = contents.length && contents.every(id => owns(beforeOwners, id, playerIndex));
            if (!contents.length || wasMonopolized
                || !contents.every(id => owns(afterOwners, id, playerIndex))) return [];
            return [{ shopId:Number(shopId), shopName:String(shop.name || '支店') }];
        });
    }

    return Object.freeze({ monopolizedAssetIds, newlyMonopolized });
});
