/* Presentation-only handoff: the game/server remains responsible for turn state. */
(function () {
    'use strict';
    let phase = 'idle', element = null, queued = null, blackCallbacks = [], waits = new Set();
    function waitFor(promise) {
        if (phase !== 'black') return false;
        let tracked, timer;
        tracked = Promise.race([
            Promise.resolve(promise).catch(error => console.error('[turn-handoff] 待機処理に失敗:', error)),
            new Promise(resolve => { timer = setTimeout(resolve, 4000); })
        ]).finally(() => { clearTimeout(timer); waits.delete(tracked); });
        waits.add(tracked);
        return true;
    }
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
        waits.clear();
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
                let mapJump = window.MapDetailLevel?.beginCameraJump?.(document.getElementById('mapBoard'));
                window.cancelMapCameraScroll?.();
                const callbacks = blackCallbacks; blackCallbacks = [];
                for (const callback of callbacks) { try { callback(); } catch (error) { console.error('[turn-handoff]', error); } }
                try { apply(); } catch (error) { console.error('[turn-handoff]', error); }
                const fadeInWhenReady = () => {
                    if (!element) return;
                    if (waits.size) {
                        Promise.all([...waits]).then(() => requestAnimationFrame(fadeInWhenReady));
                        return;
                    }
                    if (mapJump) {
                        const jump = mapJump; mapJump = null;
                        waitFor(jump.finish());
                        requestAnimationFrame(fadeInWhenReady);
                        return;
                    }
                    phase = 'fading-in';
                    element.classList.remove('is-dark');
                    setTimeout(() => { element?.remove(); element = null; phase = 'idle'; if (queued) { const next = queued; queued = null; run(next); } }, 260);
                };
                requestAnimationFrame(() => requestAnimationFrame(fadeInWhenReady));
            }, 260);
        }, 1000);
        return true;
    }
    window.TurnHandoff = Object.freeze({ run, onBlack, waitFor, isActive: () => phase !== 'idle', isWaiting: () => phase === 'waiting' || phase === 'fading-out', isBlack: () => phase === 'black' });
})();
