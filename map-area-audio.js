/* Region lookup shared by area music and normal battle scenery. */
(function () {
    'use strict';

    const audioByRegion = Object.freeze({
        town: 'town',
        grassland: 'grassland',
        desert: 'desert',
        volcano: 'volcano',
        forest: 'forest',
        snow: 'snow',
        ruins: 'ruins'
    });
    const battleBackgroundByRegion = Object.freeze({
        capital: 'images/backgrounds/scenes/戦闘_王都.webp',
        town: 'images/backgrounds/scenes/戦闘_街.webp',
        grassland: 'images/backgrounds/scenes/戦闘1.webp',
        forest: 'images/backgrounds/scenes/戦闘_森.webp',
        lake: 'images/backgrounds/scenes/戦闘_湖.webp',
        desert: 'images/backgrounds/scenes/戦闘_砂漠.webp',
        snow: 'images/backgrounds/scenes/戦闘_雪山.webp',
        ruins: 'images/backgrounds/scenes/戦闘_遺跡.webp',
        volcano: 'images/backgrounds/scenes/戦闘_火山.webp'
    });

    function regionAt(x, y) {
        return window.MapRegionRules?.regionAt(window.MapRegionData,x,y) || null;
    }

    function regionForPlayer(player) {
        if (!player) return null;
        const square = (window.mapData || []).find(item => Number(item.id) === Number(player.position));
        return square ? regionAt(Number(square.x), Number(square.y)) : null;
    }

    function updateForPlayer(player, options = {}) {
        if (!window.gameOpeningComplete || !player || player.underground || typeof window.transitionAreaBGM !== 'function') return;
        const region = regionForPlayer(player);
        window.transitionAreaBGM(audioByRegion[region?.id] || 'adventure', options.immediate ? 0 : 1400);
    }

    function battleBackground(player) {
        const region = regionForPlayer(player);
        return battleBackgroundByRegion[region?.id] || 'images/backgrounds/scenes/戦闘1.webp';
    }

    window.MapAreaAudio = Object.freeze({ regionAt, regionForPlayer, updateForPlayer, battleBackground });
})();
