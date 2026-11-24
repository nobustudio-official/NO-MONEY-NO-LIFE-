(function () {
    'use strict';
    let root = null;
    let cleanupExitAlignment = null;
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    };

    function alignExitButton(panel, card, button) {
        let frame = 0;
        const update = () => {
            frame = 0;
            if (!panel.isConnected || !card.isConnected || !button.isConnected) return;
            const panelRect = panel.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            button.style.left = `${cardRect.left + cardRect.width / 2 - panelRect.left - panel.clientLeft}px`;
        };
        const schedule = () => {
            if (!frame) frame = requestAnimationFrame(update);
        };
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        observer?.observe(panel);
        observer?.observe(card);
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        update();
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
    }

    function hide() {
        cleanupExitAlignment?.();
        cleanupExitAlignment = null;
        window.Plane02Layout?.release(root?.querySelector('.hatataki-panel'));
        root?.remove();
        root = null;
    }

    function render(view, handlers = {}) {
        if (!view || !Array.isArray(view.destroyedItems)) return;
        const targetComplete = view.status === 'advance' || view.status === 'end';
        const destroyedCount = view.destroyedItems.length;
        const targetIndex = String(view.targetIndex);
        const hit = view.eventId && root?.dataset.eventId === view.eventId && root.dataset.targetIndex === targetIndex
            && destroyedCount > Number(root.dataset.destroyedCount);
        hide();
        root = element('section', 'hatataki-overlay');
        root.setAttribute('aria-label', ITEM_CONTENTS[17].name);
        root.dataset.eventId = view.eventId || '';
        root.dataset.targetIndex = targetIndex;
        root.dataset.destroyedCount = String(destroyedCount);
        const scene = element('div', 'hatataki-scene');

        const panel = element('section', 'hatataki-panel');
        panel.dataset.frameId = 'SP04';
        const title = element('h2', 'hatataki-title', ITEM_CONTENTS[17].name);
        panel.append(title);

        const body = element('div', 'hatataki-body');
        const results = element('div', 'hatataki-results');
        results.setAttribute('aria-live', 'polite');
        view.destroyedItems.forEach(name => results.append(element('div', 'hatataki-item-row', name)));
        body.append(results);

        const card = element('article', 'hatataki-player-card');
        card.dataset.frameId = 'SP05';
        if (hit) card.classList.add('is-hit');
        const icon = element('img', 'hatataki-player-icon');
        icon.src = view.targetIcon || '';
        icon.alt = '';
        const name = element('strong', 'hatataki-player-name', view.targetName || 'プレイヤー');
        const showAttack = view.status === 'attack';
        const attack = element('button', 'hatataki-button hatataki-attack', '叩く');
        attack.type = 'button';
        attack.disabled = !showAttack || Boolean(view.readOnly || view.busy);
        if (showAttack) attack.onclick = () => handlers.onAttack?.();
        else attack.style.visibility = 'hidden';
        card.append(icon, name, attack);
        body.append(card);
        panel.append(body);

        let exitButton = null;
        if (targetComplete) {
            const actionClass = view.status === 'advance'
                ? 'hatataki-button hatataki-progress item-exit-button hatataki-next-button'
                : 'hatataki-button hatataki-progress item-exit-button';
            const action = element('button', actionClass, view.status === 'end' ? '終了' : '次へ');
            action.type = 'button';
            action.disabled = Boolean(view.readOnly || view.busy);
            action.onclick = () => view.status === 'end' ? handlers.onEnd?.() : handlers.onNext?.();
            exitButton = action;
            panel.append(action);
        }
        if (view.notice) {
            body.classList.add('hatataki-notice');
            const portrait = element('img');
            portrait.src = view.notice.icon || '';
            portrait.alt = '';
            const copy = element('p', '', view.notice.text);
            const next = element('button', 'hatataki-button hatataki-notice-next', '次へ ▶');
            next.type = 'button';
            next.disabled = Boolean(view.readOnly || view.busy);
            next.onclick = () => handlers.onNotice?.();
            body.replaceChildren(portrait, copy, next);
            panel.querySelector('.hatataki-progress')?.remove();
        } else if (view.evaded) {
            panel.append(element('p', 'hatataki-summary', '攻撃をかわした！'));
        } else if (targetComplete && destroyedCount) {
            panel.append(element('p', 'hatataki-summary', `${name.textContent}のアイテムを${destroyedCount}個叩き割った！`));
        }
        scene.append(panel);
        root.append(scene);
        document.body.append(root);
        const activePanel = root.querySelector('.hatataki-panel');
        if (activePanel) {
            window.Plane02Layout?.apply(activePanel);
            if (exitButton) cleanupExitAlignment = alignExitButton(activePanel, card, exitButton);
        }
    }

    window.HatatakiHakenUI = Object.freeze({ render, hide });
})();
