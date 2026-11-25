(function () {
    'use strict';
    const limit = player => Math.floor(Math.max(0, Number(player?.money) || 0) / 2000) * 1000;
    const format = n => Math.max(0, Number(n) || 0).toLocaleString('ja-JP');
    const node = (tag, className, text) => { const e = document.createElement(tag); e.className = className; if (text != null) e.textContent = text; return e; };
    function close() { const root = document.getElementById('moneyTransferScreen'); if (root) { window.PlayerCardSize?.release(root); window.Plane02Layout?.release(root.querySelector('.mt-panel')); root.remove(); } }
    function show(cfg) {
        close();
        const { players, actor, stage, targetIndex, type, remote } = cfg;
        const isItemTransfer = cfg.itemName != null;
        const isAssetTransfer = typeof cfg.getAssets === 'function';
        const itemName = cfg.itemName || ITEM_CONTENTS[19].name;
        let pendingButton = null;
        const btn = (text, fn, className = 'mt-button', sound = 'confirm') => {
            const e = node('button', className, text); e.type = 'button';
            e.onclick = event => { if (remote || e.disabled || pendingButton?.disabled) return; if (sound) cfg.onSound?.(sound); fn(event); };
            return e;
        };
        const target = players[targetIndex];
        const root = node('section', stage === 'result' ? 'mt-result' : ''); root.id = 'moneyTransferScreen';
        root.dataset.stage = stage;
        if (!isItemTransfer && !isAssetTransfer) root.dataset.transfer = 'money';
        const panel = node('div', `mt-panel${cfg.description ? ' has-description' : ''}`), content = node('div', 'mt-content');
        const sendLabel = isAssetTransfer ? '贈与' : isItemTransfer ? '渡す' : '送金';
        const stealLabel = isAssetTransfer ? '強奪' : isItemTransfer ? '奪う' : '強奪';
        let title;
        if (stage === 'target') title = `${itemName}の対象を選んでください`;
        else if (stage === 'type') title = isItemTransfer
            ? `${target.name}に対し、贈与／強奪を選んでください`
            : `${target.name}に対し、送金または強奪を選んでください`;
        else if (stage === 'items') title = type === 'send' ? '渡すアイテムを選んでください' : `${target.name}から奪うアイテムを選んでください`;
        else if (stage === 'assets') title = type === 'send' ? '贈与する資産を選んでください' : `${target.name}から強奪する資産を選んでください`;
        else title = `ゴールドの移動　- ${type === 'send' ? sendLabel : stealLabel} -`;
        panel.append(node('h2', 'mt-title', title));
        if (cfg.description) panel.append(node('p', 'mt-description', cfg.description));
        panel.append(content); root.append(panel);
        const portrait = player => { const img = document.createElement('img'); img.src = cfg.icon(players.indexOf(player)); img.alt = ''; return img; };
        const person = (player, receiver = false, money = true) => { const e = node('div', `mt-person${receiver ? ' mt-receiver' : ''}`); e.append(portrait(player), node('b', '', player.name)); if (money) e.append(node('strong', '', `${format(player.money)}G`)); return e; };
        const arrow = () => { const img = document.createElement('img'); img.className = 'mt-arrow'; img.src = 'images/ui/icons/interface/yajirushi.webp'; img.alt = 'から'; return img; };
        const route = (from, to, result = false, money = true) => { const e = node('div', 'mt-route'); e.append(person(from, false, money), arrow(), person(to, result, money)); return e; };
        const moneyRoute = (from, to) => {
            const e = node('div', 'mt-route mt-money-route');
            const participant = (player, receiver) => {
                const slot = node('div', `mt-person mt-money-person${receiver ? ' mt-receiver' : ''}`);
                const avatar = node('div', 'mt-money-avatar'), image = portrait(player);
                image.alt = player.name;
                const balance = node('div', 'mt-money-balance');
                balance.setAttribute('aria-label', `${player.name}の所持金`);
                balance.append(node('strong', '', `${(Number(player.money) || 0).toLocaleString('ja-JP')}G`));
                if (stage === 'result' && Number(cfg.amount) > 0) {
                    balance.append(node('small', 'mt-money-change', `${receiver ? '+' : '−'}${format(cfg.amount)}G`));
                }
                avatar.append(image, balance); slot.append(avatar);
                return slot;
            };
            e.append(participant(from, false), arrow(), participant(to, true));
            return e;
        };
        const go = (next, index = targetIndex, direction = type, value = null) => show({...cfg, stage:next, targetIndex:index, type:direction, amount:value});
        if (stage !== 'result') {
            const back = btn('戻る', () => { if (stage === 'target') { close(); cfg.onExit(); } else if (stage === 'type') go('target'); else go('type'); }, 'mt-back item-exit-button');
            back.disabled = Boolean(remote); panel.append(back);
        }
        if (stage === 'target') {
            const list = node('div', 'mt-targets');
            players.forEach((player, index) => {
                if (player === actor) return;
                const card = node('article', 'mt-target-card');
                const choose = btn('選ぶ', () => {
                    if (typeof cfg.onSelectTarget === 'function') cfg.onSelectTarget(index, choose);
                    else go('type', index);
                });
                const noMoney = !isItemTransfer && !limit(actor) && !limit(player);
                choose.disabled = Boolean(remote) || noMoney;
                card.append(portrait(player), node('b', '', player.name));
                if (!isItemTransfer) card.append(node('strong', '', `${format(player.money)}G`));
                card.append(choose);
                if (noMoney) card.append(node('small', '', '送金・強奪できる金額がありません'));
                list.append(card);
            });
            content.append(list);
        } else if (stage === 'type') {
            const choices = node('div', 'mt-choices');
            const choiceIcon = player => { const image = portrait(player); image.className = 'mt-choice-icon'; image.alt = player.name; return image; };
            for (const direction of ['send', 'steal']) {
                const from = direction === 'send' ? actor : target, to = direction === 'send' ? target : actor;
                const card = btn('', () => go(isAssetTransfer ? 'assets' : isItemTransfer ? 'items' : 'amount', targetIndex, direction), `mt-choice is-${direction}`);
                card.disabled = Boolean(remote) || (!isItemTransfer && !limit(from));
                const routeSlot = node('div', 'mt-choice-route');
                const icons = node('div', 'mt-route');
                icons.append(choiceIcon(from), arrow(), choiceIcon(to));
                routeSlot.append(icons);
                card.append(node('b', 'mt-choice-title', direction === 'send' ? (isItemTransfer ? '贈与' : sendLabel) : '強奪'), routeSlot);
                choices.append(card);
            }
            content.append(choices);
        } else if (stage === 'items' || stage === 'assets') {
            const list = node('ul', 'mt-items');
            const entries = (isAssetTransfer ? cfg.getAssets : cfg.getItems)(type === 'send' ? actor : target, type);
            if (!entries.length) list.append(node('li', 'mt-items-empty', isAssetTransfer ? '移転できる資産はありません。' : '選べるアイテムがありません。'));
            for (const entry of entries) {
                const row = node('li', 'mt-item-row');
                const action = btn(type === 'send' ? sendLabel : stealLabel, () => {
                    pendingButton = action;
                    if (isAssetTransfer) cfg.onCommitAsset(type, targetIndex, entry, action);
                    else cfg.onCommitItem(type, targetIndex, entry, action);
                }, 'mt-button', null);
                action.disabled = Boolean(remote);
                const name = node('b', '', entry.name);
                if (entry.detail) {
                    const copy = node('div', 'mt-item-copy');
                    copy.append(name, node('small', '', entry.detail)); row.append(copy, action);
                } else row.append(name, action);
                list.append(row);
            }
            content.append(list);
        } else {
            const from = type === 'send' ? actor : target, to = type === 'send' ? target : actor;
            const isMoneyTransfer = !isItemTransfer && !isAssetTransfer;
            panel.append(isMoneyTransfer ? moneyRoute(from, to) : route(from, to, stage === 'result'));
            if (stage === 'amount') {
                const max = limit(from), initial = Number.isFinite(Number(cfg.amount)) && cfg.amount != null ? Number(cfg.amount) : Math.min(max, Math.ceil(max / 2000) * 1000);
                const min = max >= 1000 ? 1000 : 0;
                const normalize = value => Math.min(max, Math.max(1000, Math.floor((Number(value) || 0) / 1000) * 1000));
                const form = node('div', 'mt-form'), group = node('div', 'mt-amount-controls'), input = document.createElement('input');
                input.className = 'mt-amount'; input.type = 'number'; input.min = String(min); input.max = String(max); input.step = '1000'; input.value = String(normalize(initial)); input.disabled = Boolean(remote) || !max; input.setAttribute('aria-label', '移動するゴールド');
                const update = () => { input.value = String(normalize(input.value)); if (!remote) cfg.onSync('amount', targetIndex, type, Number(input.value)); };
                const setAmount = value => { input.value = String(value); update(); };
                const stepButton = (label, delta) => {
                    let delay, repeat, repeated = false;
                    const stop = () => { clearTimeout(delay); clearInterval(repeat); };
                    const step = () => { if (!input.isConnected) { stop(); return; } input.value = String(normalize(Number(input.value) + delta)); update(); };
                    const b = btn(label, () => { if (repeated) { repeated = false; return; } step(); }, 'mt-step'); b.disabled = Boolean(remote) || !max;
                    b.setAttribute('aria-label', delta < 0 ? '1000G減らす' : '1000G増やす');
                    b.onpointerdown = event => { if (event.button !== 0) return; repeated = false; b.setPointerCapture(event.pointerId); delay = setTimeout(() => { repeated = true; step(); repeat = setInterval(step, 55); }, 350); };
                    b.onpointerup = stop; b.onpointercancel = () => { stop(); repeated = false; }; b.onlostpointercapture = stop; return b;
                };
                input.oninput = () => { if (!remote) cfg.onSync('amount', targetIndex, type, normalize(input.value)); };
                input.onchange = update;
                const minButton = btn('Min', () => setAmount(min), 'mt-step mt-limit-step');
                const maxButton = btn('Max', () => setAmount(max), 'mt-step mt-limit-step');
                minButton.disabled = maxButton.disabled = Boolean(remote) || !max;
                minButton.setAttribute('aria-label', `指定可能な最低額 ${format(min)}G`);
                maxButton.setAttribute('aria-label', `指定可能な最高額 ${format(max)}G`);
                const execute = btn('実行', () => { update(); cfg.onCommit(type, Number(input.value), execute, targetIndex); }, 'mt-button mt-execute', null); execute.disabled = Boolean(remote) || !max;
                group.append(minButton, stepButton('−', -1000), input, stepButton('＋', 1000), maxButton); form.append(group, execute); panel.append(form);
            } else if (isMoneyTransfer && stage === 'result') {
                // Reserve the input form's space so the icons stay put after payment.
                const spacer = node('div', 'mt-form');
                spacer.setAttribute('aria-hidden', 'true'); panel.append(spacer);
            }
        }
        document.body.append(root);
        if ([13, 19, 21, 22].some(id => ITEM_CONTENTS[id]?.name === itemName)) {
            if (stage === 'type') window.Plane02Layout?.apply(panel, { once: true });
            window.Plane02Layout?.apply(panel);
        }
        window.PlayerCardSize?.watch(root);
        if (!remote) cfg.onSync(stage, targetIndex, type, stage === 'amount' ? Number(root.querySelector('.mt-amount').value) : cfg.amount);
    }
    window.MoneyTransferUI = Object.freeze({ show, close, limit });
})();
