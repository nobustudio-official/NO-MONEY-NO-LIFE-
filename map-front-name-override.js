/* Optional map-only display: remove this file's script tag to disable it. */
(function () {
    'use strict';
    const targetName = 'ゆりな';
    const updateSprite = window.updatePlayerSprite;
    if (typeof updateSprite !== 'function') return;

    window.updatePlayerSprite = function (element, playerIndex, player) {
        if (player?.name === targetName && element?.classList.contains('player-piece')) {
            // Keep the real movement direction intact; only render the front view.
            return updateSprite.call(this, element, playerIndex, { ...player, direction: 'down' });
        }
        return updateSprite.apply(this, arguments);
    };
})();
