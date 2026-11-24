(function () {
    'use strict';
    let root = null;

    const node = (tag, className, text) => {
        const value = document.createElement(tag);
        if (className) value.className = className;
        if (text != null) value.textContent = text;
        return value;
    };

    function hide() {
        window.Plane02Layout?.release(root?._panel);
        root?.remove();
        root = null;
    }

    function ensureRoot() {
        if (root?.isConnected) return root;
        root = node('div', 'lost-magic-overlay');
        root.setAttribute('aria-label', ITEM_CONTENTS[18].name);
        const scene = node('div', 'lost-magic-scene');
        const panel = node('section', 'lost-magic-panel');
        panel.dataset.frameId = 'SP04';
        const title = node('h2', 'lost-magic-title', ITEM_CONTENTS[18].name);
        const body = node('div', 'lost-magic-body');
        const back = node('button', 'lost-magic-back item-exit-button', '戻る');
        back.type = 'button';
        const telop = node('section', 'lost-magic-an02');
        telop.dataset.frameId = 'AN02';
        const portrait = node('img', 'lost-magic-an02-icon');
        portrait.alt = '';
        const copy = node('p', 'lost-magic-an02-copy');
        const next = node('span', 'lost-magic-an02-next', '次へ ▶');
        telop.append(portrait, copy, next);
        panel.append(title, body, back);
        scene.append(panel);
        root.append(scene, telop);
        document.body.append(root);
        root._scene = scene;
        root._panel = panel;
        root._title = title;
        root._body = body;
        root._back = back;
        root._portrait = portrait;
        root._copy = copy;
        root._next = next;
        root._telop = telop;
        return root;
    }

    function setCopy(icon, parts, next = true) {
        ensureRoot();
        root._portrait.src = icon || '';
        root._copy.replaceChildren(...parts);
        root._next.hidden = !next;
        styleTelop();
    }

    function styleTelop() {
        window.TelopStandard?.apply(root._telop, { message: root._copy, portrait: root._portrait, next: root._next });
    }

    function setBack(handler, visible = true) {
        ensureRoot();
        root._back.hidden = !visible;
        root._back.onclick = event => {
            event.stopPropagation();
            handler?.();
        };
    }

    function allowContinue(container, onContinue) {
        if (!onContinue) return;
        let pending = false;
        container.onclick = async () => {
            if (pending) return;
            pending = true;
            if (await onContinue() === false) pending = false;
        };
    }

    function render(view, handlers = {}) {
        if (!view) return;
        if (view.stage === 'result') {
            if (!root?.isConnected || root.dataset.stage !== 'magic') {
                render({ ...view, stage:'magic', readOnly:true });
            }
            showResult(view, handlers);
            return;
        }
        const container = ensureRoot();
        container.dataset.stage = view.stage;
        root._telop.hidden = ['targets', 'magic'].includes(view.stage);
        container.onclick = null;
        root._title.textContent = ITEM_CONTENTS[18].name;
        root._body.replaceChildren();

        if (view.stage === 'intro') {
            root._panel.hidden = true;
            root._back.hidden = true;
            root._portrait.src = view.actorIcon || '';
            root._copy.replaceChildren(node('strong', 'lost-magic-item-name', ITEM_CONTENTS[18].name), document.createTextNode('を使った！'));
            root._next.hidden = false;
            root._next.textContent = '次へ ▶';
            styleTelop();
            container.onclick = () => {
                handlers.onAdvance?.();
            };
            return;
        }

        if (view.stage === 'blocked') {
            root._panel.hidden = true;
            root._back.hidden = true;
            setCopy(view.targetIcon, [document.createTextNode(view.blockedText)]);
            allowContinue(container, handlers.onContinue);
            return;
        }

        root._panel.hidden = false;
        window.Plane02Layout?.apply(root._panel);
        if (view.stage === 'targets') {
            root._title.textContent = 'ロストマジックの対象を選んでください';
            const grid = node('div', 'lost-magic-target-grid');
            (view.targets || []).forEach(target => {
                const card = node('article', 'lost-magic-target-card');
                card.dataset.frameId = 'SP05';
                const icon = node('img', 'lost-magic-target-icon');
                icon.src = target.icon || '';
                icon.alt = '';
                const name = node('strong', 'lost-magic-target-name', target.name || 'プレイヤー');
                const choose = node('button', 'lost-magic-target-button', '選ぶ');
                choose.type = 'button';
                choose.disabled = Boolean(view.readOnly || !target.hasMagic);
                choose.onclick = () => handlers.onTarget?.(Number(target.index));
                card.append(icon, name);
                if (!target.hasMagic) card.append(node('small', 'lost-magic-no-magic', '魔法を持っていません'));
                card.append(choose);
                grid.append(card);
            });
            root._body.append(grid);
            setBack(handlers.onBack, !view.readOnly);
            container.onclick = null;
            return;
        }

        if (view.stage === 'magic') {
            root._title.textContent = '失わせる魔法を選んでください';
            const list = node('div', 'lost-magic-list');
            (view.magics || []).forEach(magic => list.append(createMagicRow(magic)));
            if (!view.magics?.length) list.append(node('p', 'lost-magic-empty', '魔法はありません。'));
            root._body.append(list);
            setBack(handlers.onBack, !view.readOnly);
        }
        container.onclick = null;
    }

    function createMagicRow(magic) {
        const row = node('article', 'lost-magic-row');
        row.dataset.magicId = String(magic.id);
        const icon = node('img', 'lost-magic-icon');
        icon.src = magic.icon || '';
        icon.alt = '';
        const name = node('strong', 'lost-magic-name', magic.name || '魔法');
        const lose = node('button', 'lost-magic-button', 'ロスト');
        lose.type = 'button';
        lose.disabled = Boolean(magic.disabled);
        lose.onclick = event => {
            event.stopPropagation();
            magic.onLose?.(Number(magic.id));
        };
        row.append(icon, name, lose);
        return row;
    }

    function showResult(view, handlers = {}) {
        const container = ensureRoot();
        const list = root._body.querySelector('.lost-magic-list');
        if (!list) return;
        root.dataset.stage = 'result';
        root._telop.hidden = false;
        root._panel.hidden = false;
        root._back.hidden = true;
        container.onclick = null;
        const magicId = Number(view.magicId);
        let row = Array.from(list.querySelectorAll('.lost-magic-row'))
            .find(entry => Number(entry.dataset.magicId) === magicId);
        if (!row) {
            const item = (view.magics || []).find(entry => Number(entry.id) === magicId);
            if (item) {
                row = createMagicRow(item);
                list.append(row);
            }
        }
        root._body.querySelectorAll('.lost-magic-button').forEach(button => { button.disabled = true; });
        if (row && view.recovery) {
            row.remove();
        } else if (row) {
            row.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'instant' });
            row.classList.remove('is-lost');
            void row.offsetWidth;
            row.classList.add('is-lost');
            const remove = () => row?.remove();
            row.addEventListener('animationend', event => { if (event.animationName === 'lost-magic-fade') remove(); }, { once:true });
            window.setTimeout(remove, 560);
        }
        setCopy(view.targetIcon, [node('strong', 'lost-magic-result-name', view.magicName || '魔法'), document.createTextNode('を失った！')]);
        root._next.textContent = '次へ ▶';
        const enable = () => {
            if (root === container && container.isConnected && container.dataset.stage === 'result') allowContinue(container, handlers.onContinue);
        };
        if (view.recovery) enable();
        else window.setTimeout(enable, 520);
    }

    window.LostMagicUI = Object.freeze({ render, showResult, hide });
})();
