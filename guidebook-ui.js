(function () {
    'use strict';
    const art = 'images/ui/icons/guidebook/';
    const closedBook = art + 'guidebook-closed.webp';
    const openBook = art + 'guidebook-open.webp';
    const guildStaffIcon = 'images/characters/npc/jobs/ギルド-店員-アイコン.webp';
    function bookText(outcome, eventTurn) {
        const inflation = outcome === 'boom';
        const turn = Math.max(1, Math.floor(Number(eventTurn) || 18));
        return [
            `${turn}ターン目終了後、「${inflation ? 'インフレ' : 'デフレ'}」イベントが発生します。`,
            `報酬や物件等の価格が${inflation ? '1.5倍' : '半分'}になります。（魔力を除く）`,
            'この攻略本は他プレイヤーに売却することができます。'
        ];
    }
    const messages = {
        get intro() { return ITEM_CONTENTS[30].name + 'を使用した！'; },
        offers: '攻略本の購入申請が届いた！',
        rejected: '申請を却下した！',
        expired: '攻略本は消失した！もう手に入らない！'
    };
    let layer, key, gameScreen, stopHudTracking, stopChoiceTracking, stopFrameTracking, stopReadingTracking, pending = false, withdrawalTimer, withdrawalBanner, currentWithdrawal;
    const withdrawals = [];
    const formatGold = amount => amount.toLocaleString('ja-JP') + 'G';
    const make = (tag, cls, value) => {
        const element = document.createElement(tag);
        if (cls) element.className = cls;
        if (value != null) element.textContent = value;
        return element;
    };
    const image = (src, alt = '') => {
        const element = make('img');
        element.src = src;
        element.alt = alt;
        return element;
    };
    function close() {
        window.PlayerCardSize?.release(layer);
        stopChoiceTracking?.();
        stopChoiceTracking = null;
        stopFrameTracking?.();
        stopFrameTracking = null;
        stopReadingTracking?.();
        stopReadingTracking = null;
        stopHudTracking?.();
        stopHudTracking = null;
        layer?.remove();
        layer = key = null;
        if (gameScreen) { gameScreen.inert = false; gameScreen = null; }
    }
    function placeChoiceCards(root, panel) {
        const cards = panel.querySelector('.guidebook-choices'), book = panel.querySelector('.guidebook-choice-book');
        const caption = root.querySelector('.guidebook-an02 .telop-standard-frame') || root.querySelector('.guidebook-an02');
        if (!cards || !book || !caption) return null;
        window.Plane02Layout?.apply(panel, { once: true });
        window.Plane02Layout?.apply(panel);
        // Match the job scene's artwork center and eight-pixel caption gap.
        // All writes stay inside this guidebook choice view.
        const update = () => {
            if (layer !== root || !root.isConnected) return;
            const frame = panel.getBoundingClientRect(), art = book.getBoundingClientRect(), telop = caption.getBoundingClientRect();
            if (!frame.height || !art.height || !telop.height) return;
            const center = (art.top + art.bottom) / 2, bottom = telop.top - 8;
            const height = Math.max(48, 2 * (bottom - center));
            Object.assign(cards.style, { left: (telop.left - frame.left) + 'px', right: (frame.right - telop.right) + 'px',
                top: (bottom - height - frame.top) + 'px', height: height + 'px' });
        };
        let frameId = 0;
        const schedule = () => { if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; update(); }); };
        const observer = new ResizeObserver(schedule);
        [panel, book, caption].forEach(element => observer.observe(element));
        window.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('resize', schedule, { passive: true });
        window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
        update();
        return () => {
            observer.disconnect(); cancelAnimationFrame(frameId);
            window.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('resize', schedule);
            window.visualViewport?.removeEventListener('scroll', schedule);
            window.Plane02Layout?.release(panel);
        };
    }
    function fitReadingArt(root, panel) {
        const spread = panel.querySelector('.guidebook-spread'), copy = spread?.querySelector('.guidebook-copy'), book = spread?.querySelector('img');
        if (!copy || !book) return null;
        const update = () => {
            if (layer !== root || !root.isConnected) return;
            // The two pages occupy 77.5% of the asset; match them to the text background.
            const width = copy.getBoundingClientRect().width;
            if (width) book.style.width = (width / .775) + 'px';
        };
        let frameId = 0;
        const observer = new ResizeObserver(() => {
            if (!frameId) frameId = requestAnimationFrame(() => { frameId = 0; update(); });
        });
        [spread, copy].forEach(element => observer.observe(element));
        update();
        return () => { observer.disconnect(); if (frameId) cancelAnimationFrame(frameId); };
    }
    function trackHud(root, hud) {
        const update = () => {
            if (layer !== root) return;
            const bottom = hud.getBoundingClientRect().bottom - root.getBoundingClientRect().top;
            root.style.setProperty('--guidebook-hud-bottom', Math.max(0, Math.ceil(bottom)) + 'px');
        };
        update();
        const observer = window.ResizeObserver ? new window.ResizeObserver(update) : null;
        observer?.observe(hud);
        window.addEventListener('resize', update);
        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', update);
        };
    }
    function announceWithdrawals(indices, players, icon) {
        withdrawals.push(...indices.map(index => ({ name: players[index].name, icon: icon(index) })));
        showWithdrawal();
    }
    function showWithdrawal() {
        if (withdrawalBanner || !withdrawals.length || layer) return;
        const { name, icon } = currentWithdrawal = withdrawals.shift();
        const banner = withdrawalBanner = make('div', 'guidebook-an02 guidebook-withdrawal');
        banner.setAttribute('aria-live', 'polite');
        banner.append(image(icon), make('p', '', name + 'の攻略本の購入申請は、所持金不足のため取り下げられた！'));
        document.body.append(banner);
        styleBanner(banner, false, true);
        withdrawalTimer = setTimeout(() => {
            banner.remove();
            withdrawalBanner = null;
            currentWithdrawal = null;
            showWithdrawal();
        }, 4000);
    }

    function styleBanner(banner, reserveSpace = true, passive = false) {
        window.TelopStandard?.apply(banner, { message: banner.querySelector('p'), portrait: banner.querySelector('img'),
            next: banner.querySelector('.guidebook-next'), notice: banner.querySelector('.guidebook-notice'), reserveSpace, passive });
    }
    function reset() {
        close();
        clearTimeout(withdrawalTimer);
        withdrawalBanner?.remove();
        withdrawalBanner = null;
        currentWithdrawal = null;
        withdrawals.length = 0;
    }

    function render(view, context) {
        if (!view) { close(); showWithdrawal(); return; }
        const { players, active, book, icon, control, online, dispatch, back } = context;
        const kind = view.kind;
        const viewKey = [context.turnKey, kind, view.page, control, book?.withdrawals?.length, context.marketOutcomeAt18, context.marketEventTurn].join(':');
        if (key === viewKey && layer?.isConnected) return;
        if (withdrawalBanner) {
            clearTimeout(withdrawalTimer);
            withdrawalBanner.remove();
            withdrawalBanner = null;
            withdrawals.unshift(currentWithdrawal);
            currentWithdrawal = null;
        }
        close();
        key = viewKey;
        const root = layer = make('section', 'guidebook-layer');
        root.dataset.view = kind;
        if (kind === 'choice') root.id = 'guidebookChoicePopup';
        if (kind === 'offers') root.id = 'guidebookOffersPopup';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', kind === 'immunity-expired' ? '無敵の加護' : '攻略本');
        root.tabIndex = -1;
        const panel = make('div', 'guidebook-panel');
        panel.dataset.frameId = 'SP04';
        const banner = make('div', 'guidebook-an02');
        banner.dataset.frameId = 'AN02';
        banner.setAttribute('aria-live', 'polite');
        const notice = make('p', 'guidebook-notice');
        const go = async (action, fields = {}) => {
            if (!control || pending || layer !== root) return;
            pending = true;
            try {
                await dispatch(action, fields);
                if (action === 'apply') window.GameSE?.play('payment')?.catch(error => console.warn('[SE] 攻略本申請の支払い音を再生できません:', error));
                if (action === 'reject') window.GameSE?.play('guidebookReject', {
                    shared: true,
                    eventId: 'guidebook:reject:' + context.turnKey
                })?.catch(error => console.warn('[SE] 攻略本申請却下の音を再生できません:', error));
            } catch (error) {
                notice.textContent = error.message || '通信状態を確認して、もう一度お試しください。';
            } finally {
                pending = false;
            }
        };
        function button(label, action, cls = 'mt-button') {
            const element = make('button', cls, label);
            element.type = 'button';
            element.disabled = !control;
            element.onclick = action;
            return element;
        }
        function announce(message, subjectIndex, iconOverride = null) {
            if (iconOverride) banner.append(image(iconOverride));
            else if (subjectIndex != null) banner.append(image(icon(subjectIndex)));
            banner.append(make('p', '', message));
        }
        function next(target = banner) {
            const advance = () => go('next', { view: kind, page: view.page });
            if (control) {
                target.append(button('次へ▶', advance, 'guidebook-next'));
                root.onclick = event => { if (!event.target.closest('button,input,select,textarea')) advance(); };
                root.onkeydown = event => {
                    if (event.target === root && (event.key === 'Enter' || event.key === ' ')) {
                        event.preventDefault();
                        advance();
                    }
                };
            }
        }
        if (kind === 'choice') {
            const choices = make('div', 'guidebook-choices br-choices');
            const open = make('div', 'br-card-slot'), restore = make('div', 'br-card-slot');
            const openButton = button('開く', () => go('read'), 'guidebook-choice-button');
            openButton.dataset.reward = 'money';
            openButton.dataset.frameId = 'BT03-G';
            const backButton = button('戻る', back, 'guidebook-choice-button guidebook-choice-back');
            backButton.dataset.frameId = 'BT03-S';
            for (const card of [openButton, backButton]) card.replaceChildren(make('span', 'br-card-front', card.textContent));
            open.append(openButton);
            restore.append(backButton);
            if (book.remaining) panel.append(make('p', 'guidebook-expiry', '消失まであと ' + GuidebookRules.remainingTurns(book) + 'ターン'));
            const bookImage = image(closedBook, '閉じた攻略本');
            bookImage.className = 'guidebook-choice-book';
            choices.append(open, restore);
            panel.append(bookImage, choices);
            announce('攻略本を開きますか？ ' + (online ? '他の冒険者からは中身は見えません。' : '他の冒険者から画面が見えない位置で開いてください。'), active);
        } else if (kind === 'reading') {
            if (control) {
                const heading = make('header', 'guidebook-heading');
                heading.append(make('h2', '', '攻略本'), button('閉じる', () => go('next', { view: kind }), 'mt-button item-exit-button'));
                const spread = make('div', 'guidebook-spread'), copy = make('div', 'guidebook-copy');
                copy.append(...bookText(context.marketOutcomeAt18, context.marketEventTurn).map(line => make('p', '', line)));
                spread.append(image(openBook, '攻略本の見開き'), copy);
                const body = make('div', 'guidebook-reading-body');
                body.append(spread);
                panel.append(heading, body);
            } else panel.hidden = true;
            announce(messages.intro, active);
            next();
        } else if (kind === 'intro') {
            const layout = make('div', 'guidebook-intro');
            const copy = make('div');
            const heading = make('h2', 'guidebook-trade-title', '攻略本の売買イベント発生');
            const detail = make('p');
            detail.append('各冒険者は、自分のターン開始時に', make('br'),
                '攻略本の購入申請を行えます。', make('br'),
                '購入申請のチャンスは、2回（2ターン）です。', make('br'),
                '攻略本は、今から3ターン後に消滅します。');
            copy.append(heading, detail);
            layout.append(image(closedBook, '閉じた攻略本'), copy);
            panel.append(layout);
            next(panel);
        } else if (kind === 'last-chance') {
            panel.hidden = true;
            announce('攻略本の購入申請はこのターンで最後です。', null, guildStaffIcon);
            next();
        } else if (kind === 'offer') {
            const seller = book.ownerIndex;
            const heading = make('header', 'guidebook-heading');
            heading.append(make('h2', '', '攻略本の購入申請'));
            const route = make('div', 'guidebook-offer-route');
            const person = index => {
                const portrait = image(icon(index));
                portrait.className = 'guidebook-offer-icon';
                return portrait;
            };
            const arrow = image('images/ui/icons/interface/yajirushi.webp');
            arrow.className = 'mt-arrow';
            route.append(person(active), arrow, person(seller));
            const form = make('form', 'mt-form'), controls = make('div', 'mt-amount-controls');
            const { MIN_PRICE, PRICE_STEP, maxPrice } = GuidebookRules;
            const max = maxPrice(players[active]);
            const amount = make('input', 'mt-amount');
            amount.type = 'number';
            amount.min = String(MIN_PRICE);
            amount.max = String(max);
            amount.step = String(PRICE_STEP);
            amount.value = String(MIN_PRICE);
            amount.required = true;
            amount.disabled = !control || max < MIN_PRICE;
            amount.setAttribute('aria-label', '購入申請額（G）');
            const step = (label, direction) => {
                const result = button(label, () => {
                    const units = (amount.valueAsNumber || MIN_PRICE) / PRICE_STEP;
                    const value = direction > 0 ? Math.floor(units) + 1 : Math.ceil(units) - 1;
                    amount.value = String(Math.max(MIN_PRICE, Math.min(max, value * PRICE_STEP)));
                }, 'mt-step');
                result.disabled = amount.disabled;
                result.setAttribute('aria-label', direction > 0 ? '5,000G増やす' : '5,000G減らす');
                return result;
            };
            controls.append(step('−', -1), amount, step('＋', 1));
            const submit = button('申請', null, 'mt-button mt-execute');
            submit.type = 'submit';
            submit.disabled = amount.disabled;
            form.onsubmit = event => {
                event.preventDefault();
                if (!amount.disabled && amount.reportValidity()) go('apply', { amount: amount.valueAsNumber });
            };
            form.append(make('small', '', max < MIN_PRICE ? '購入に必要な30,000Gがありません。' : formatGold(MIN_PRICE) + '～（5,000G単位）'), controls, submit);
            panel.append(heading, route, form, button('戻る', () => go('cancelOffer'), 'mt-button guidebook-back item-exit-button'));
            announce('攻略本の購入申請を選択した！', active);
        } else if (kind === 'offers') {
            panel.append(make('h2', 'guidebook-heading', '攻略本の購入申請'));
            const cards = make('div', 'guidebook-offer-list');
            for (const offer of book.offers) {
                const player = players[offer.buyer], card = make('div', 'bf-receipt-card');
                const sell = button('売却', () => go('sell', { buyer: offer.buyer }), 'bf-action');
                if (!offer.prepaid && player.money < offer.amount) { sell.disabled = true; sell.textContent = '所持金不足'; }
                card.append(image(icon(offer.buyer)), make('strong', 'bf-receipt-name', player.name), make('strong', 'bf-total', formatGold(offer.amount)), sell);
                cards.append(card);
            }
            panel.append(cards, button('全て却下', () => go('reject'), 'mt-button guidebook-reject'));
            announce(messages.offers, active);
        } else {
            panel.hidden = true;
            if (kind === 'expired') announce(messages.expired, view.owner);
            if (kind === 'immunity-expired') announce('無敵の加護の効果が切れた！', active);
            if (kind === 'rejected') {
                if (Number(view.refundedCount) > 0 && Number(view.page) === 1) announce('購入できなかった申請者のゴールドは返金されました。', null, guildStaffIcon);
                else announce(messages.rejected, active);
            }
            if (kind === 'sold') {
                if (Number(view.page) === 0) {
                    announce(players[view.seller].name + 'は' + formatGold(view.amount) + 'を手に入れた！', view.seller);
                    window.GameSE?.play('moneyDisplay', { eventId: 'guidebook:sale:' + context.turnKey + ':' + view.page })?.catch(() => {});
                } else if (Number(view.refundedCount) > 0 && Number(view.page) === 1) {
                    announce('購入できなかった申請者のゴールドは返金されました。', null, guildStaffIcon);
                } else {
                    announce(players[view.buyer].name + 'は攻略本を入手した！', view.buyer);
                    window.GameSE?.play('itemObtain', { eventId: 'guidebook:sale:' + context.turnKey + ':' + view.page })?.catch(() => {});
                }
            }
            if (kind === 'applied') {
                const deposit = view.amount == null ? '' : ' 申請額の' + formatGold(view.amount) + 'を預かりました。';
                announce(players[active].name + 'は攻略本の購入を申請した！' + deposit, active);
            }
            next();
        }
        panel.hidden = panel.hidden || !panel.childNodes.length;
        if (kind === 'intro') {
            panel.append(notice);
            root.append(panel);
        } else {
            if (banner.childNodes.length) banner.append(notice);
            root.append(panel, banner);
        }
        document.body.append(root);
        if (kind !== 'intro') styleBanner(banner);
        if (kind === 'choice') stopChoiceTracking = placeChoiceCards(root, panel);
        if (['reading', 'intro', 'offer', 'offers'].includes(kind) && !panel.hidden) {
            window.Plane02Layout?.apply(panel, { once: true });
            stopFrameTracking = window.Plane02Layout?.apply(panel);
            if (kind === 'reading') stopReadingTracking = fitReadingArt(root, panel);
        }
        if (kind === 'offers') window.PlayerCardSize?.refresh();
        const screen = document.querySelector('.game-screen');
        const hud = screen?.querySelector('.game-hud');
        if (hud && !panel.hidden) stopHudTracking = trackHud(root, hud);
        if (screen && !screen.inert) { screen.inert = true; gameScreen = screen; }
        if (kind === 'intro' && control) window.GameSE?.play('guidebookAnnouncement', {
            shared: true,
            eventId: 'guidebook:trade-intro:' + context.turnKey
        })?.catch(error => console.warn('[SE] 攻略本の売買案内:', error));
        if (control) root.focus?.({ preventScroll: true });
    }

    function renderSpecialReward(reward, context) {
        const activeView = reward?.status === 'announcing' || reward?.status === 'receiving';
        const previousClaim = layer?.dataset.rewardTurnKey === context.turnKey ? Number(layer.dataset.claiming) : NaN;
        if (context.control && reward?.claimed?.includes(previousClaim)) window.GameSE?.play('itemObtain')?.catch(() => {});
        if (!activeView) { if (layer?.dataset.specialReward) close(); return; }
        const { players, active, icon, control } = context;
        const isAnnouncement = reward.status === 'announcing';
        const kind = isAnnouncement ? 'special-reward-announcement' : 'special-reward-receive';
        const viewKey = [context.turnKey, kind, reward.page, reward.claiming, reward.claimed?.join(',')].join(':');
        if (key === viewKey && layer?.isConnected) return;
        close();
        key = viewKey;
        const root = layer = make('section', 'guidebook-layer special-reward-layer');
        root.dataset.view = kind;
        root.dataset.specialReward = 'true';
        root.dataset.rewardTurnKey = context.turnKey;
        if (reward.claiming != null) root.dataset.claiming = reward.claiming;
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', '特別アイテム贈呈');
        const panel = make('div', 'guidebook-panel special-reward-panel');
        panel.hidden = isAnnouncement;
        panel.dataset.frameId = 'SP04';
        const banner = make('div', 'guidebook-an02 special-reward-an02');
        banner.dataset.frameId = 'AN02';
        const guildIcon = guildStaffIcon;
        const dispatch = context.dispatchGift;
        const button = (label, action, cls) => {
            const element = make('button', cls, label);
            element.type = 'button';
            element.disabled = !control;
            element.onclick = action;
            return element;
        };
        if (isAnnouncement) {
            const announcements = [
                '1位の冒険者との差が開いてしまいましたね・・・',
                'そんなあなたには、特別なアイテムを贈呈します！',
                'これを使って、1位目指して頑張ってくださいね！'
            ];
            const advance = async () => {
                if (!control || pending) return;
                pending = true;
                try { await dispatch('next', { page: reward.page }); }
                catch (error) { text.textContent = error.message || '通信状態を確認してください。'; }
                finally { pending = false; }
            };
            const text = make('p', '', announcements[reward.page] || announcements[0]);
            banner.append(image(guildIcon), text);
            if (control) {
                banner.append(button('次へ▶', advance, 'guidebook-next'));
                root.onclick = event => { if (!event.target.closest('button')) advance(); };
            }
            root.onkeydown = event => { if (control && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); advance(); } };
        } else {
            panel.append(make('h2', 'guidebook-heading', '特別アイテム贈呈'));
            const cards = make('div', 'special-reward-cards');
            const rewards = [
                { id: 33, name: '攻略本2' },
                { id: 2, name: 'タクシーチケット' }
            ];
            rewards.forEach(item => {
                const card = make('article', 'bf-receipt-card special-reward-card');
                card.append(image(icon(active)), make('strong', 'bf-receipt-name', players[active]?.name || ''), make('strong', 'bf-total', item.name));
                const receive = button('受け取る', async () => {
                    if (!control || pending || reward.claiming != null || reward.claimed?.includes(item.id)) return;
                    pending = true;
                    receive.disabled = true;
                    try {
                        await dispatch('claim', { itemId: item.id });
                    }
                    catch (error) { receive.disabled = false; text.textContent = error.message || '受け取りを確認できませんでした。'; }
                    finally { pending = false; }
                }, 'bf-action');
                receive.disabled = !control || reward.claiming != null || reward.claimed?.includes(item.id);
                card.append(receive);
                if (reward.claimed?.includes(item.id)) card.classList.add('is-claimed');
                else if (reward.claiming === item.id) card.classList.add('is-fading');
                cards.append(card);
            });
            panel.append(cards);
            const text = make('p', '', 'アイテムを受け取ってください。');
            banner.append(text);
        }
        root.append(panel, banner);
        document.body.append(root);
        styleBanner(banner);
        window.PlayerCardSize?.watch(root);
        const screen = document.querySelector('.game-screen');
        if (screen && !screen.inert) { screen.inert = true; gameScreen = screen; }
        if (control) root.focus?.({ preventScroll: true });
    }

    function showSecondBook(players, active, icon) {
        showSecondBookView('choice', players, active, icon);
    }

    function showSecondBookView(kind, players, active, icon) {
        close();
        const root = layer = make('section', 'guidebook-layer');
        root.dataset.view = kind;
        if (kind === 'choice') root.id = 'guidebookChoicePopup';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', '攻略本2');
        root.tabIndex = -1;
        const panel = make('div', 'guidebook-panel');
        panel.dataset.frameId = 'SP04';
        const banner = make('div', 'guidebook-an02');
        banner.dataset.frameId = 'AN02';
        banner.setAttribute('aria-live', 'polite');
        banner.append(image(icon(active)));
        if (kind === 'choice') {
            const choices = make('div', 'guidebook-choices br-choices');
            const open = make('div', 'br-card-slot'), restore = make('div', 'br-card-slot');
            const openButton = make('button', 'guidebook-choice-button');
            openButton.type = 'button';
            openButton.dataset.reward = 'money';
            openButton.dataset.frameId = 'BT03-G';
            openButton.append(make('span', 'br-card-front', '開く'));
            openButton.onclick = () => showSecondBookView('reading', players, active, icon);
            const backButton = make('button', 'guidebook-choice-button guidebook-choice-back');
            backButton.type = 'button';
            backButton.dataset.frameId = 'BT03-S';
            backButton.append(make('span', 'br-card-front', '戻る'));
            backButton.onclick = () => close();
            open.append(openButton);
            restore.append(backButton);
            const bookImage = image(closedBook, '閉じた攻略本2');
            bookImage.className = 'guidebook-choice-book';
            choices.append(open, restore);
            panel.append(bookImage, choices);
            banner.append(make('p', '', '攻略本2を開きますか？ 他の冒険者から画面が見えない位置で開いてください。'));
        } else {
            const heading = make('header', 'guidebook-heading');
            const dismiss = make('button', 'mt-button item-exit-button', '閉じる');
            dismiss.type = 'button';
            dismiss.onclick = () => close();
            heading.append(make('h2', '', '攻略本2'), dismiss);
            const spread = make('div', 'guidebook-spread');
            const copy = make('div', 'guidebook-copy');
            [
                'この攻略本は詐欺アイテムです。',
                'まずは満足気なリアクションを取って、',
                '有益な情報が書いてあった「ふり」をしましょう。',
                'そしてこの中身のないアイテムを誰かに売るのです。',
                'あなたの演技力が、他冒険者の購買力を掻き立てます。'
            ].forEach(line => copy.append(make('p', '', line)));
            spread.append(image(openBook, '開いた攻略本2'));
            spread.append(copy);
            const body = make('div', 'guidebook-reading-body');
            body.append(spread);
            panel.append(heading, body);
            banner.append(make('p', '', ITEM_CONTENTS[33].name + 'を使用した！'));
            const next = make('button', 'guidebook-next', '次へ▶');
            next.type = 'button';
            next.onclick = () => close();
            banner.append(next);
            root.onclick = event => { if (!event.target.closest('button,input,select,textarea')) close(); };
            root.onkeydown = event => {
                if (event.target === root && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    close();
                }
            };
        }
        root.append(panel, banner);
        document.body.append(root);
        styleBanner(banner);
        if (kind === 'choice') stopChoiceTracking = placeChoiceCards(root, panel);
        else {
            window.Plane02Layout?.apply(panel, { once: true });
            stopFrameTracking = window.Plane02Layout?.apply(panel);
            stopReadingTracking = fitReadingArt(root, panel);
        }
        const screen = document.querySelector('.game-screen');
        const hud = screen?.querySelector('.game-hud');
        if (hud) stopHudTracking = trackHud(root, hud);
        if (screen && !screen.inert) { screen.inert = true; gameScreen = screen; }
        root.focus?.({ preventScroll: true });
    }

    window.GuidebookUI = Object.freeze({ render, renderSpecialReward, showSecondBook, close, reset, announceWithdrawals, isOpen: () => Boolean(layer?.isConnected),
        isPurchaseRequestOpen: () => ['offer', 'applied'].includes(layer?.dataset.view) });
})();
