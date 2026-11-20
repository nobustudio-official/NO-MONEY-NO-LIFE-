/* Presentation-only handoff: the game/server remains responsible for turn state. */
(function () {
    'use strict';
    let phase = 'idle', element = null, queued = null, blackCallbacks = [];
    function onBlack(callback) {
        if (phase === 'black') { callback(); return true; }
        if (phase === 'waiting' || phase === 'fading-out') { blackCallbacks.push(callback); return true; }
        return false;
    }
    function run(apply) {
        if (phase !== 'idle') {
            if (phase === 'black' || phase === 'fading-in') { queued = apply; return true; }
            return false;
        }
        phase = 'waiting';
        const popup = document.getElementById('eventPopup');
        if (popup) popup.style.display = 'none';
        window.UndergroundUI?.prepareTurnHandoff?.();
        element = document.createElement('div');
        element.className = 'turn-handoff-overlay';
        element.setAttribute('aria-hidden', 'true');
        document.body.append(element);
        setTimeout(() => {
            if (!element) return;
            phase = 'fading-out';
            element.classList.add('is-dark');
            setTimeout(() => {
                if (!element) return;
                phase = 'black';
                const callbacks = blackCallbacks; blackCallbacks = [];
                for (const callback of callbacks) { try { callback(); } catch (error) { console.error('[turn-handoff]', error); } }
                try { apply(); } catch (error) { console.error('[turn-handoff]', error); }
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!element) return;
                    phase = 'fading-in';
                    element.classList.remove('is-dark');
                    setTimeout(() => { element?.remove(); element = null; phase = 'idle'; if (queued) { const next = queued; queued = null; run(next); } }, 260);
                }));
            }, 260);
        }, 1000);
        return true;
    }
    window.TurnHandoff = Object.freeze({ run, onBlack, isActive: () => phase !== 'idle', isWaiting: () => phase === 'waiting' || phase === 'fading-out', isBlack: () => phase === 'black' });
})();
