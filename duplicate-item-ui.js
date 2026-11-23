(function () {
    'use strict';
    let root = null;
    let gameScreen = null;
    const node = (tag, className, text) => {
        const element = document.createElement(tag);
        if (className) element.className = className;
        if (text != null) element.textContent = text;
        return element;
    };
    function hide() {
        root?.remove();
        root = null;
        if (gameScreen) gameScreen.inert = false;
        gameScreen = null;
    }
    function show(options) {
        hide();
        const player = options.player;
        const inventory = Array.isArray(options.inventory) ? options.inventory : player?.inventory || [];
        const usedIndex = Number(options.useIndex);
        const observer = Boolean(options.observer);
        root = node('section', 'duplicate-item-overlay');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', '複製するアイテムの選択');
        const panel = node('section', 'duplicate-item-panel');
        const header = node('header', 'duplicate-item-header');
        header.append(node('h2', '', '複製するアイテムを選んでください'));
        const list = node('div', 'duplicate-item-list');
        const back = node('button', 'duplicate-item-back', '戻る');
        back.type = 'button';
        back.disabled = observer;
        let pending = false;
        const selectionButtons = [back];
        back.onclick = () => { if (!observer && !pending) options.onBack?.(); };
        panel.append(header, list, back);

        const candidates = inventory.map((entry, inventoryIndex) => ({
            inventoryIndex,
            id: Number(typeof entry === 'object' && entry ? entry.id : entry)
        })).filter(entry => entry.inventoryIndex !== usedIndex && ITEM_CONTENTS[entry.id]);
        if (!candidates.length) {
            list.append(node('p', 'duplicate-item-empty', '複製できるアイテムがありません。'));
        } else {
            candidates.forEach(candidate => {
                const item = ITEM_CONTENTS[candidate.id];
                const row = node('article', 'duplicate-item-row');
                const details = node('div', 'duplicate-item-details');
                details.append(node('strong', 'duplicate-item-name', item.name));
                const kind = item.category === 'passive' ? 'パッシブ' : item.category === 'move' ? '移動用アイテム' : item.category === 'warp' ? 'ワープアイテム' : '';
                if (kind) details.append(node('small', 'duplicate-item-kind', kind));
                const choose = node('button', 'duplicate-item-choose', '選ぶ');
                choose.type = 'button';
                choose.disabled = observer;
                choose.setAttribute('aria-label', `${item.name}を複製する`);
                selectionButtons.push(choose);
                choose.onclick = async () => {
                    if (observer || pending) return;
                    pending = true;
                    selectionButtons.forEach(button => { button.disabled = true; });
                    try {
                        await options.onSelect?.(candidate.inventoryIndex, candidate.id);
                    } finally {
                        pending = false;
                        selectionButtons.forEach(button => { button.disabled = false; });
                    }
                };
                row.append(details, choose);
                list.append(row);
            });
        }
        root.append(panel);
        document.body.append(root);
        if (!observer) {
            const screen = document.querySelector('.game-screen');
            if (screen && !screen.inert) {
                screen.inert = true;
                gameScreen = screen;
            }
            back.focus({ preventScroll: true });
        }
    }
    window.DuplicateItemUI = Object.freeze({ show, hide, isOpen: () => Boolean(root?.isConnected) });
})();
