(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SpecialItemRules = api;
})(typeof window !== 'undefined' ? window : null, function () {
    'use strict';
    const destinations = Object.freeze([
        { key:'capital', name:'王都', id:139, image:'images/map/objects/optimized/capital/royal-castle-v2-70pct.webp' },
        { key:'grassland', name:'草原', id:244, image:'images/map/objects/optimized/grassland/windmill-v1-70pct.webp' },
        { key:'forest', name:'森林', id:382, image:'images/map/objects/optimized/forest/ancient-tree-v2-70pct.webp' },
        { key:'lake', name:'湖', id:425, image:'images/map/objects/optimized/small-objects/帆船-70pct.webp' },
        { key:'desert', name:'砂漠', id:378, image:'images/map/objects/optimized/small-objects/未来型塔-70pct.webp' },
        { key:'snow', name:'雪山', id:381, image:'images/map/objects/optimized/snow/ice-cave-v1-70pct.webp' },
        { key:'ruins', name:'遺跡', id:380, image:'images/map/objects/optimized/small-objects/ゴーレム-70pct.webp' },
        { key:'volcano', name:'火山', id:383, image:'images/map/objects/optimized/small-objects/火山ランドマーク-70pct.webp' },
        { key:'town', name:'街', id:379, image:'images/map/objects/optimized/town/guild-v1-70pct.webp' }
    ]);
    function average(players) {
        const targets = players.filter(player => !player.underground && player.disadvantageImmunityActive !== true);
        if (!targets.length) return null;
        return Math.floor(targets.reduce((sum, player) => sum + Number(player.money || 0), 0) / targets.length);
    }
    function equalize(players) {
        const value = average(players);
        if (value === null) return null;
        players.filter(player => !player.underground && player.disadvantageImmunityActive !== true).forEach(player => { player.money = value; });
        return value;
    }
    function checkSeal(player) {
        if (player.underground) { player.itemSealedThisTurn = false; return; }
        const remaining = Math.max(0, Number(player.itemSealChecks) || 0);
        player.itemSealedThisTurn = remaining > 0;
        player.itemSealChecks = Math.max(0, remaining - 1);
    }
    return { destinations, average, equalize, checkSeal };
});
