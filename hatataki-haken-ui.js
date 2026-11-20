(function () {
    'use strict';
    let root = null;
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    };

    function hide() {
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
        if (view.status !== 'attack') results.append(element('div', 'hatataki-finished', '以上'));
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

        if (targetComplete) {
            const action = element('button', 'hatataki-button hatataki-progress', view.status === 'end' ? '終了' : '次へ');
            action.type = 'button';
            action.disabled = Boolean(view.readOnly || view.busy);
            action.onclick = () => view.status === 'end' ? handlers.onEnd?.() : handlers.onNext?.();
            panel.append(action);
        }
        if (!view.notice) scene.append(panel);

        const telop = element('section', 'hatataki-an02');
        telop.dataset.frameId = 'AN02';
        const portrait = element('img', 'hatataki-an02-icon');
        const copy = element('p', 'hatataki-an02-copy');
        if (view.notice) {
            portrait.src = view.notice.icon || '';
            portrait.alt = '';
            copy.textContent = view.notice.text;
            const next = element('button', 'hatataki-button hatataki-notice-next', '次へ ▶');
            next.type = 'button';
            next.disabled = Boolean(view.readOnly || view.busy);
            next.onclick = () => handlers.onNotice?.();
            telop.append(next);
        } else if (view.evaded) {
            portrait.src = view.targetIcon || '';
            portrait.alt = '';
            copy.textContent = '攻撃をかわした！';
        } else {
            portrait.src = view.actorIcon || '';
            portrait.alt = '';
            if (targetComplete && destroyedCount) {
                copy.textContent = `${name.textContent}のアイテムを${destroyedCount}個叩き割った！`;
            } else {
                copy.append(element('strong', 'hatataki-item-name', ITEM_CONTENTS[17].name), document.createTextNode('を使った！'));
            }
        }
        telop.append(portrait, copy);
        scene.append(telop);
        root.append(scene);
        document.body.append(root);
    }

    window.HatatakiHakenUI = Object.freeze({ render, hide });
})();
