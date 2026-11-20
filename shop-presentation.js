/* Presentation lifecycle shared by shops. Never changes purchases or turns. */
(function () {
    'use strict';
    function create(popup, { voice }) {
        const audio = new Audio(voice);
        audio.preload = 'auto';
        let open = false, generation = 0;
        function close() {
            if (!open) return;
            open = false;
            generation++;
            if (window.GameSE) window.GameSE.stop(audio);
            else { audio.pause(); audio.currentTime = 0; }
        }
        const visible = () => !popup.hidden && popup.style.display !== 'none' && popup.isConnected;
        new MutationObserver(() => { if (!visible()) close(); })
            .observe(popup, { attributes: true, attributeFilter: ['style', 'hidden'] });
        return {
            async present() {
                if (open) return; // Purchases and repeated online snapshots do not replay the greeting.
                open = true;
                const token = ++generation;
                await Promise.allSettled([...popup.querySelectorAll('img')].map(image => image.decode()));
                // Wait for layout and a painted frame after both scene images have decoded.
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                if (token !== generation || !open || !visible()) return;
                (window.GameSE ? window.GameSE.playLocal(audio) : audio.play())
                    .catch(error => console.warn('[shop] 店員音声を再生できません:', error));
            },
            close
        };
    }
    window.ShopPresentation = Object.freeze({ create });
})();
