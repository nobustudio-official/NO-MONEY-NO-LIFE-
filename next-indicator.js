/* Discover continuation labels, including dynamically mounted event screens. */
(function () {
    'use strict';
    const candidates = 'button,.job-dialogue-next,.battle-log-next,.bridge-mugging-next,.lost-magic-an02-next,.ponzi-next';
    const hosts = '.telop-standard-frame,.common-announcement,.job-dialogue-box,.bf-banner,.boss-opening-banner,.bridge-mugging-an06,.reward-announcement,.dp-guide-banner,.dp-footer,.battle-new-message,.hatataki-notice,.guidebook-panel,.ponzi-sp04';
    const copies = '.telop-standard-copy,.event-popup-message,.job-dialogue-text,.bf-copy,.boss-opening-copy,.bridge-mugging-copy,#rewardMessage,.dp-guide-copy,.battle-log-text,.hatataki-summary,.guidebook-intro,.ponzi-payout-rows';
    const records = new Map(), hostStates = new Map(), observed = new Set(), dirty = new Set();
    let pending = 0;
    const matches = node => {
        const label = node.textContent.replace(/[\s\uFE0E\uFE0F]/g, '');
        return /^次へ[▶►]?$/.test(label)
            || (node.matches('.boss-opening-start .boss-opening-next') && /^マップへ[▶►]?$/.test(label));
    };
    function useTextArrow(node) {
        const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const text = walker.currentNode, value = text.nodeValue.replace(/▶[\uFE0E\uFE0F]?/g, '▶\uFE0E');
            if (value !== text.nodeValue) text.nodeValue = value;
        }
    }
    const set = (node, name, value) => { if (node.style.getPropertyValue(name) !== value) node.style.setProperty(name, value); };
    const resize = new ResizeObserver(() => schedule());
    function schedule(root) {
        if (root) dirty.add(root);
        if (!pending) pending = requestAnimationFrame(update);
    }
    function scan(root) {
        if (root.nodeType !== Node.ELEMENT_NODE) root = root.parentElement;
        if (!root) return;
        const nodes = root.matches(candidates) ? [root, ...root.querySelectorAll(candidates)] : root.querySelectorAll(candidates);
        for (const node of nodes) if (matches(node)) {
            useTextArrow(node);
            if (!records.has(node)) records.set(node, {});
        }
    }
    function clearHost(host, state) {
        host.classList.remove('game-next-relative-host', 'game-next-short-host');
        host.style.removeProperty('--game-next-host-height');
        if (state.copy) {
            state.copy.classList.remove('game-next-copy', 'game-next-copy-absolute');
            state.copy.style.removeProperty('--game-next-copy-space');
        }
    }
    function update() {
        pending = 0;
        dirty.forEach(scan); dirty.clear();
        const active = new Map(), targets = new Set();
        for (const [node, record] of records) {
            node.classList.remove('game-next-indicator');
            if (!node.isConnected || !matches(node)) {
                node.style.removeProperty('--game-next-original-size'); records.delete(node); continue;
            }
            targets.add(node);
            if (!node.getClientRects().length || getComputedStyle(node).display === 'none') continue;
            const size = parseFloat(getComputedStyle(node).fontSize);
            set(node, '--game-next-original-size', size + 'px');
            node.classList.add('game-next-indicator');
            const host = node.parentElement.closest(hosts) || node.parentElement;
            if (!host) continue;
            active.set(host, node);
            record.host = host;
        }
        for (const [host, state] of hostStates) if (!active.has(host)) { clearHost(host, state); hostStates.delete(host); }
        for (const [host, next] of active) {
            let state = hostStates.get(host);
            if (!state) { state = {}; hostStates.set(host, state); }
            targets.add(host);
            if (getComputedStyle(host).position === 'static') host.classList.add('game-next-relative-host');
            const minimum = next.getBoundingClientRect().height + 12;
            if (host.getBoundingClientRect().height < minimum) {
                set(host, '--game-next-host-height', minimum + 'px'); host.classList.add('game-next-short-host');
            }
            const copy = host.querySelector(copies) || (host.classList.contains('hatataki-notice') ? host.querySelector('p') : null);
            if (state.copy && state.copy !== copy) {
                state.copy.classList.remove('game-next-copy', 'game-next-copy-absolute');
                state.copy.style.removeProperty('--game-next-copy-space');
            }
            state.copy = copy;
            if (!copy || copy.contains(next)) continue;
            targets.add(copy);
            copy.classList.toggle('game-next-copy-absolute', getComputedStyle(copy).position === 'absolute');
            copy.classList.add('game-next-copy');
            const bounds = copy.getBoundingClientRect(), button = next.getBoundingClientRect();
            const gap = Math.max(0, bounds.right - button.left + 5) + 'px';
            const changed = copy.style.getPropertyValue('--game-next-copy-space') !== gap;
            set(copy, '--game-next-copy-space', gap);
            if (changed && copy.classList.contains('an02-copy')) window.CommonAnnouncements?.fitText(copy);
        }
        for (const node of observed) if (!targets.has(node)) { resize.unobserve(node); observed.delete(node); }
        for (const node of targets) if (!observed.has(node)) { resize.observe(node); observed.add(node); }
    }
    const mutations = new MutationObserver(changes => {
        let relevant = false;
        for (const change of changes) {
            if (change.type === 'childList') {
                change.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && (node.matches(candidates) || node.querySelector(candidates))) { dirty.add(node); relevant = true; }
                });
                if (change.removedNodes.length && [...records.keys()].some(node => !node.isConnected)) relevant = true;
            }
            const target = change.target.nodeType === Node.ELEMENT_NODE ? change.target : change.target.parentElement;
            const candidate = target?.closest(candidates);
            if (candidate) { dirty.add(candidate); relevant = true; }
            if (change.type === 'attributes' && target?.querySelector(candidates)) relevant = true;
        }
        if (relevant) schedule();
    });
    mutations.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', () => schedule(), { passive: true });
    window.visualViewport?.addEventListener('resize', () => schedule(), { passive: true });
    document.fonts?.ready.then(() => schedule());
    window.NextIndicator = Object.freeze({ refresh: () => schedule(document.body) });
    schedule(document.body);
})();
