(function (root, factory) {
    const rules = factory();
    if (typeof module === 'object' && module.exports) module.exports = rules;
    if (root) root.DisadvantageImmunityRules = rules;
})(typeof window !== 'undefined' ? window : globalThis, function () {
    'use strict';
    function isActive(player) { return player?.disadvantageImmunityActive === true; }
    function activate(player) {
        if (!player || typeof player !== 'object') return false;
        player.disadvantageImmunityActive = true;
        return true;
    }
    function clearAtTurnStart(player) {
        if (!isActive(player)) return false;
        player.disadvantageImmunityActive = false;
        return true;
    }
    return Object.freeze({ isActive, activate, clearAtTurnStart });
});
