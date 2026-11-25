/* Shared lower-screen announcements. Gameplay stays in the caller's continuation. */
(function () {
    'use strict';
    const special = /ボス|魔王|次の目的地|配当|ランキング/;
    const neutral = /エラー|失敗|できません|使えません|同期|通信|接続|確認してください/;
    const plainText = value => String(value).replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u200D\u20E3]/gu, '').trim();
    const pendingFits = new Set();
    let fitFrame = 0;
    let activePage = null;
    function bindPageAdvance(root, advance) {
        const page = { root, advance };
        activePage = page;
        return () => { if (activePage === page) activePage = null; };
    }
    function fitMessage(message) {
        if (!message.isConnected || !message.classList.contains('an02-copy')) return;
        message.style.removeProperty('font-size');
        if (!message.clientWidth || !message.clientHeight) return;

        const frame = getComputedStyle(message.parentElement);
        const textHeight = Math.floor(parseFloat(frame.minHeight) - parseFloat(frame.paddingTop) -
            parseFloat(frame.paddingBottom) - parseFloat(frame.borderTopWidth) - parseFloat(frame.borderBottomWidth));
        const fits = () => message.scrollHeight <= Math.min(message.clientHeight, textHeight) && message.scrollWidth <= message.clientWidth;
        if (fits()) return;

        const normalSize = Math.floor(parseFloat(getComputedStyle(message).fontSize));
        const minimumSize = message.querySelector('.an02-single-line') ? 10 : 14;
        let low = Math.min(minimumSize, normalSize), high = normalSize - 1, size = low;
        while (low <= high) {
            const trial = Math.floor((low + high) / 2);
            message.style.fontSize = `${trial}px`;
            if (fits()) { size = trial; low = trial + 1; }
            else high = trial - 1;
        }
        message.style.fontSize = `${size}px`;
    }
    function flushFits() {
        fitFrame = 0;
        if (window.MapScene?.deferViewportUpdate?.(flushFits)) return;
        pendingFits.forEach(fitMessage);
        pendingFits.clear();
    }
    function queueFit(message) {
        pendingFits.add(message);
        if (fitFrame || window.MapScene?.deferViewportUpdate?.(flushFits)) return;
        fitFrame = requestAnimationFrame(flushFits);
    }
    function fitText(message) {
        if (!message) return;
        message.classList.add('an02-copy');
        message.scrollTop = 0;
        queueFit(message);
    }
    window.addEventListener('resize', () => document.querySelectorAll('.an02-copy').forEach(queueFit));
    function highlightMoney(message) {
        const walker=document.createTreeWalker(message,NodeFilter.SHOW_TEXT),texts=[];
        while(walker.nextNode())if(!walker.currentNode.parentElement.closest('.announcement-money'))texts.push(walker.currentNode);
        for(const node of texts){
            const matches=[...node.textContent.matchAll(/[＋+−－-]?\d[\d,，]*(?:\.\d+)?(?:万|億|兆)?\s*[GＧ]/g)];
            if(!matches.length)continue;
            const fragment=document.createDocumentFragment();let offset=0;
            for(const match of matches){fragment.append(node.textContent.slice(offset,match.index));const amount=document.createElement('span');amount.className='announcement-money';amount.textContent=match[0];fragment.append(amount);offset=match.index+match[0].length;}
            fragment.append(node.textContent.slice(offset));node.replaceWith(fragment);
        }
    }
    function formatBody(popup) {
        const message=popup.querySelector('.event-popup-message')||popup.querySelector('#eventPopupMessage'),title=plainText(popup.querySelector('.event-popup-title').textContent);
        const walker=document.createTreeWalker(message,NodeFilter.SHOW_TEXT),texts=[];
        while(walker.nextNode())texts.push(walker.currentNode);
        // Change text only; preserve existing emphasis.
        texts.forEach(node=>{node.textContent=node.textContent.replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}|[\uFE0F\u200D\u20E3]/gu,'');});
        const text=message.textContent.trim();
        if(!text){message.textContent=title;highlightMoney(message);return;}
        const lead=title==='バイト開始'&&!text.includes('バイト')?'バイトを始めます。'
            :title.startsWith('バイト終了')&&!text.includes('バイトを終え')?'バイトを終えました。'
            :title==='報酬を受け取った！'&&!text.includes('報酬を受け取った')?'戦闘の報酬を受け取った！'
            :title==='強制売却執行'&&!text.startsWith('資産を強制売却します。')?'資産を強制売却します。'
            :neutral.test(title)&&!text.includes(title)?title.replace(/[。！!]$/,'')+'。':null;
        if(lead)message.prepend(document.createTextNode(lead),document.createElement('br'));
        highlightMoney(message);
    }
    function presentation(title, message, options, context, popup) {
        const isBossRetreat = String(title) === 'ボスから撤退';
        if (options.common === false || (special.test(String(title)) && !isBossRetreat)) return null;
        // Legacy special screens can leave their visual variant on this reused
        // element. A new ordinary message must not inherit that boss layout.
        [...popup.classList].filter(c => c.startsWith('boss-')).forEach(c => popup.classList.remove(c));
        const list = context.players || [];
        let subjectIndex = options.subjectIndex;
        if (options.subjectPlayerId != null) {
            const matchedIndex = list.findIndex(player => String(player?.id) === String(options.subjectPlayerId));
            if (matchedIndex >= 0) subjectIndex = matchedIndex;
        }
        if (neutral.test(String(title)) || options.guide) subjectIndex = null;
        if (subjectIndex === undefined) {
            // Existing result messages name their subject first. Explicit metadata
            // wins for multi-player/unnamed results; matching never executes rules.
            const text = document.createElement('div');text.innerHTML = String(title) + ' ' + String(message);
            const plain = text.textContent;
            const named = list.map((p, i) => ({ i, at: p.name ? plain.indexOf(p.name) : -1, length: (p.name || '').length }))
                .filter(p => p.at >= 0).sort((a, b) => a.at - b.at || b.length - a.length);
            subjectIndex = named[0]?.i ?? context.activeIndex;
        }
        const requestedCount=options.soundCount===undefined?1:Math.max(0,Math.min(20,Math.floor(Number(options.soundCount)||0)));
        const sound=['squareArrival','moneyDisplay','itemUse','itemObtain','moneyLoss','mugging','ponziScam','marketBoom','marketCrash','marketStable'].includes(options.sound)&&requestedCount>0?options.sound:plainText(title).startsWith('バイト終了')?'moneyDisplay':null;
        return { common: true, subjectIndex: Number.isInteger(subjectIndex) && list[subjectIndex] ? subjectIndex : null,...(sound?{sound}:{}),...(sound&&requestedCount>1?{soundCount:requestedCount}:{}),advanceAnywhere:options.advanceAnywhere!==false||options.itemUse===true,...(options.itemTransferResult?{itemTransferResult:true}:{}),...(options.itemUse?{itemUse:true}:{}),...(options.hatatakiFrame?{hatatakiFrame:true}:{}) };
    }
    function render(popup, metadata, context = {}) {
        window.JobPresentation?.placeResult(popup,metadata);
        let portrait = popup.querySelector('.announcement-portrait');
        if (!portrait) { portrait = document.createElement('img');portrait.className = 'announcement-portrait';popup.prepend(portrait); }
        popup.classList.toggle('common-announcement', Boolean(metadata?.common));
        popup.classList.toggle('item-transfer-announcement', Boolean(metadata?.common && metadata.itemTransferResult));
        popup.classList.toggle('item-use-announcement', Boolean(metadata?.common && metadata.itemUse));
        popup.classList.toggle('hatataki-announcement', Boolean(metadata?.common && metadata.hatatakiFrame));
        popup.dataset.advanceAnywhere = metadata?.common && metadata.advanceAnywhere !== false ? 'true' : 'false';
        const subject = metadata?.subjectIndex, player = Number.isInteger(subject) ? context.players?.[subject] : null;
        const src = player ? context.icon?.(subject) : null;
        portrait.hidden = !metadata?.common || !src;
        if (src) { portrait.src = src;portrait.alt = player.name || 'プレイヤー'; }
        else { portrait.removeAttribute('src');portrait.alt = ''; }
        popup.classList.toggle('announcement-no-portrait', portrait.hidden);
        popup.setAttribute('role', 'dialog');popup.setAttribute('aria-modal', 'true');
        popup.tabIndex = -1;
        const button = popup.querySelector('.event-popup-button') || popup.querySelector('#eventPopupButton');
        const message = popup.querySelector('.event-popup-message');
        if (metadata?.common) {
            formatBody(popup);
            if (button) button.textContent = '次へ▶';
            fitText(message);
        } else if (message?.classList.contains('an02-copy')) {
            message.classList.remove('an02-copy');
            message.style.removeProperty('font-size');
        }
        if(metadata?.common&&metadata.sound&&context.eventId){const count=Math.max(1,Math.min(20,Math.floor(Number(metadata.soundCount)||1)));for(let index=0;index<count;index++){const play=()=>window.GameSE?.play?.(metadata.sound,{eventId:`announcement:${context.eventId}:${metadata.sound}:${index}`}).catch(error=>console.warn('[SE] 通知音を再生できません:',error));if(index===0)play();else window.setTimeout(play,index*500);}}
        popup.onclick = event => {
            if (!metadata?.common || !button || event.target.closest('button') || event.target.closest('a')) return;
            if (!button.disabled) button.click();
        };
        popup.onkeydown = event => {
            if (metadata?.common && button && event.target === popup && ['Enter', ' '].includes(event.key)) {
                event.preventDefault();if (!button.disabled) button.click();
            }
        };
        if (metadata?.common) requestAnimationFrame(() => { if (popup.style.display !== 'none') popup.focus({ preventScroll: true }); });
    }
    // A lower banner remains visually light but still owns progression. Do not
    // let clicks through to a purchase, dice, or map node while awaiting consent.
    document.addEventListener('click', event => {
        const popup = document.getElementById('eventPopup');
        if (event.target.closest('.online-recovery-panel, [data-map-camera]')) return;
        if (popup?.classList.contains('common-announcement') && getComputedStyle(popup).display !== 'none') {
            if (popup.contains(event.target)) return;
            event.preventDefault();event.stopImmediatePropagation();
            if (popup.dataset.advanceAnywhere === 'true') {
                const button = popup.querySelector('.event-popup-button') || popup.querySelector('#eventPopupButton');
                if (button && !button.disabled) button.click();
            }
            return;
        }
        const page = activePage;
        if (page?.root.isConnected && !page.root.hidden && getComputedStyle(page.root).display !== 'none') {
            event.preventDefault();event.stopImmediatePropagation();
            page.advance();
        }
    }, true);
    const showArrival=(title,message,next)=>window.showEventPopup(title,message,next,{sound:'squareArrival',advanceAnywhere:true});
    window.CommonAnnouncements = Object.freeze({ presentation, render, showArrival, fitText, bindPageAdvance });
})();
