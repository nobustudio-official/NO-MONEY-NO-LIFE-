(function () {
    'use strict';
    let root = null;
    let ui = null;
    let exitAlignment = null;
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    };
    const svgElement = (tag, attributes = {}) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
        return node;
    };

    // Stable geometry keeps existing cracks in place across renders and restores.
    function crackPath(index) {
        const centers = [[38, 45], [66, 104], [28, 125], [73, 32]];
        const [x, y] = centers[Math.floor(index / 4) % centers.length];
        const angle = index * 2.39996 + .35;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const length = Math.min(dx > 0 ? (100 - x) / dx : -x / dx,
            dy > 0 ? (160 - y) / dy : -y / dy);
        const points = [[x, y]];
        for (let step = 1; step <= 6; step++) {
            const offset = step === 6 ? 0 : (step % 2 ? 1 : -1) * (2 + index % 3);
            points.push([x + dx * length * step / 6 - dy * offset,
                y + dy * length * step / 6 + dx * offset]);
        }
        const point = ([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`;
        const [bx, by] = points[3];
        const side = index % 2 ? 1 : -1;
        return `M${points.map(point).join(' L')} M${point(points[3])}` +
            ` l${(-dy * 12 * side).toFixed(1)},${(dx * 12 * side).toFixed(1)}` +
            ` L${point([Math.max(0, Math.min(100, bx - dy * 24 * side + dx * 8)),
                Math.max(0, Math.min(160, by + dx * 24 * side + dy * 8))])}`;
    }

    function updateCracks(count, sameTarget) {
        if (!sameTarget) ui.cracks.replaceChildren();
        while (ui.cracks.children.length > count) ui.cracks.lastElementChild.remove();
        while (ui.cracks.children.length < count) {
            const group = svgElement('g');
            const d = crackPath(ui.cracks.children.length);
            for (const className of ['hatataki-crack-edge', 'hatataki-crack-depth']) {
                group.append(svgElement('path', { d, class: className, pathLength: '1' }));
            }
            ui.cracks.append(group);
        }
        ui.cracks.style.setProperty('--hatataki-crack-width', `${Math.min(2.8, .8 + count * .18)}px`);
    }

    function alignExitButton(panel, card, button) {
        let frame = 0;
        const update = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = 0;
            if (!panel.isConnected || !card.isConnected || !button.isConnected) return;
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            const panelRect = panel.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            button.style.left = `${cardRect.left + cardRect.width / 2 - panelRect.left - panel.clientLeft}px`;
        };
        const schedule = () => {
            if (window.MapScene?.deferViewportUpdate?.(update)) return;
            if (!frame) frame = requestAnimationFrame(update);
        };
        const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
        observer?.observe(panel);
        observer?.observe(card);
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        update();
        const destroy = () => {
            observer?.disconnect();
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            if (frame) cancelAnimationFrame(frame);
        };
        return { update, destroy };
    }

    function hide() {
        exitAlignment?.destroy();
        exitAlignment = null;
        window.Plane02Layout?.release(ui?.panel);
        root?.remove();
        root = null;
        ui = null;
    }

    function createScreen(eventId) {
        hide();
        root = element('section', 'hatataki-overlay');
        root.setAttribute('aria-label', ITEM_CONTENTS[17].name);
        root.dataset.eventId = eventId;
        root.style.visibility = 'hidden';
        const scene = element('div', 'hatataki-scene');
        const panel = element('section', 'hatataki-panel');
        panel.dataset.frameId = 'SP04';
        const title = element('h2', 'hatataki-title', ITEM_CONTENTS[17].name);
        const body = element('div', 'hatataki-body');
        const results = element('div', 'hatataki-results');
        results.setAttribute('aria-live', 'polite');
        const card = element('article', 'hatataki-player-card');
        card.dataset.frameId = 'SP05';
        const cracks = svgElement('svg', { class: 'hatataki-cracks', viewBox: '0 0 100 160',
            preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
        const icon = element('img', 'hatataki-player-icon');
        icon.alt = '';
        const name = element('strong', 'hatataki-player-name');
        const attack = element('button', 'hatataki-button hatataki-attack', '叩く');
        const action = element('button', 'hatataki-button hatataki-progress item-exit-button');
        const summary = element('p', 'hatataki-summary');
        const noticeIcon = element('img');
        noticeIcon.alt = '';
        const noticeCopy = element('p');
        const noticeNext = element('button', 'hatataki-button hatataki-notice-next', '次へ ▶');
        attack.type = 'button';
        action.type = 'button';
        noticeNext.type = 'button';
        card.append(cracks, icon, name, attack);
        body.append(results, card);
        panel.append(title, body);
        scene.append(panel);
        root.append(scene);
        ui = { panel, body, results, card, cracks, icon, name, attack, action, summary,
            noticeIcon, noticeCopy, noticeNext, showingNotice: false, view: null, handlers: {} };
        const screen = ui;
        attack.onclick = () => {
            if (screen.view?.status === 'attack') screen.handlers.onAttack?.();
        };
        action.onclick = () => screen.view?.status === 'end'
            ? screen.handlers.onEnd?.() : screen.handlers.onNext?.();
        noticeNext.onclick = () => screen.handlers.onNotice?.();
        card.addEventListener('animationend', event => {
            if (event.animationName === 'hatataki-card-hit') card.classList.remove('is-hit');
        });
        window.PlayerCardSize?.refresh();
        document.body.append(root);
        // Establish the final panel geometry before revealing any text. Register
        // resize tracking only once for this item-use screen.
        window.Plane02Layout?.apply(panel, { once: true });
        window.Plane02Layout?.apply(panel);
    }

    function setText(node, text) {
        if (node.textContent !== text) node.textContent = text;
    }

    function setImage(node, source) {
        if (node.getAttribute('src') !== source) node.src = source;
    }

    function updateResults(names, sameTarget) {
        if (!sameTarget) {
            ui.results.replaceChildren();
            ui.results.scrollTop = 0;
        }
        while (ui.results.children.length > names.length) ui.results.lastElementChild.remove();
        names.forEach((name, index) => {
            const row = ui.results.children[index];
            if (row) setText(row, String(name));
            else ui.results.append(element('div', 'hatataki-item-row', name));
        });
    }

    function render(view, handlers = {}) {
        if (!view || !Array.isArray(view.destroyedItems)) return;
        const eventId = String(view.eventId || '');
        if (!root?.isConnected || root.dataset.eventId !== eventId) createScreen(eventId);
        const targetIndex = String(view.targetIndex);
        const sameTarget = root.dataset.targetIndex === targetIndex;
        const destroyedCount = view.destroyedItems.length;
        const hit = Boolean(view.eventId && sameTarget && destroyedCount > Number(root.dataset.destroyedCount));
        const targetComplete = view.status === 'advance' || view.status === 'end';
        const disabled = Boolean(view.readOnly || view.busy);
        ui.view = view;
        ui.handlers = handlers;
        updateResults(view.destroyedItems, sameTarget);
        updateCracks(destroyedCount, sameTarget);
        setImage(ui.icon, view.targetIcon || '');
        setText(ui.name, view.targetName || 'プレイヤー');
        ui.attack.disabled = view.status !== 'attack' || disabled;
        ui.attack.style.visibility = view.status === 'attack' ? '' : 'hidden';
        ui.action.disabled = disabled;
        ui.action.classList.toggle('hatataki-next-button', view.status === 'advance');
        setText(ui.action, view.status === 'end' ? '終了' : '次へ');

        const showingNotice = Boolean(view.notice);
        if (showingNotice !== ui.showingNotice) {
            ui.body.classList.toggle('hatataki-notice', showingNotice);
            ui.body.replaceChildren(...(showingNotice
                ? [ui.noticeIcon, ui.noticeCopy, ui.noticeNext] : [ui.results, ui.card]));
            ui.showingNotice = showingNotice;
        }
        if (showingNotice) {
            setImage(ui.noticeIcon, view.notice.icon || '');
            setText(ui.noticeCopy, view.notice.text);
            ui.noticeNext.disabled = disabled;
        }
        const summary = showingNotice ? '' : view.evaded ? '攻撃をかわした！'
            : targetComplete && destroyedCount ? `${ui.name.textContent}のアイテムを${destroyedCount}個叩き割った！` : '';
        setText(ui.summary, summary);
        if (summary) {
            if (!ui.panel.contains(ui.summary)) ui.panel.append(ui.summary);
        } else ui.summary.remove();

        if (!sameTarget) ui.card.classList.remove('is-hit');
        if (hit && !showingNotice) {
            ui.card.classList.remove('is-hit');
            void ui.card.offsetWidth;
            ui.card.classList.add('is-hit');
        }
        if (targetComplete && !showingNotice) {
            if (!ui.panel.contains(ui.action)) ui.panel.append(ui.action);
            if (!exitAlignment) exitAlignment = alignExitButton(ui.panel, ui.card, ui.action);
            else exitAlignment.update();
        } else ui.action.remove();
        root.dataset.targetIndex = targetIndex;
        root.dataset.destroyedCount = String(destroyedCount);
        root.style.removeProperty('visibility');
    }

    window.HatatakiHakenUI = Object.freeze({ render, hide });
})();
