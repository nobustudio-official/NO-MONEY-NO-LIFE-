(function (root, factory) {
    const rules = factory();
    if (typeof module === 'object' && module.exports) module.exports = rules;
    if (root) root.TreasureRules = rules;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';

    function entriesOfRank(contents, category, rank) {
        return Object.entries(contents)
            .filter(([, content]) => Number(content.rank) === rank)
            .map(([id, content]) => ({ category, id: Number(id), content }));
    }

    function drawReward({ boxId, box, bossDefeatedCount, items, powers, magic }, random = Math.random) {
        const rank = Number(box.rank);
        const mixedWoodenChest = Number(boxId) === 1 && rank === 1 && bossDefeatedCount >= 2;
        let itemRank = rank;
        if (mixedWoodenChest) {
            const roll = random();
            itemRank = bossDefeatedCount >= 5
                ? (roll < 0.4 ? 1 : roll < 0.8 ? 2 : 3)
                : (roll < 0.6 ? 1 : 2);
        }
        const candidates = entriesOfRank(items, 'item', itemRank);
        if (!mixedWoodenChest) {
            candidates.push(...entriesOfRank(powers, 'power', rank), ...entriesOfRank(magic, 'magic', rank));
        }
        return candidates.length ? candidates[Math.floor(random() * candidates.length)] : null;
    }

    function drawMultipleGet({ itemId, bossDefeatedCount }, random = Math.random) {
        const unlock = Number(itemId) === 1 ? 2 : Number(itemId) === 2 ? 5 : null;
        return unlock !== null && Number(bossDefeatedCount) >= unlock && random() < 0.5;
    }

    return Object.freeze({ drawReward, drawMultipleGet });
});
