(function () {
    'use strict';
    let popup;
    function hide() { if (popup) { window.PlayerCardSize?.release(popup); window.Plane02Layout?.release(popup.querySelector('.special-item-panel')); popup.hidden = true; } }
    function show(options) {
        const {itemId, stage, destination, players, actorIndex, observer, onBack, onSelect, onExecute} = options;
        if (!popup) { popup = document.createElement('section'); popup.id='specialItemPopup'; popup.className='special-item-popup'; document.body.append(popup); }
        window.PlayerCardSize?.release(popup);
        window.Plane02Layout?.release(popup.querySelector('.special-item-panel'));
        popup.replaceChildren(); popup.hidden=false;
        popup.dataset.itemId = String(itemId);
        popup.dataset.itemSelection = String(stage !== 'result');
        const panel=document.createElement('section'); panel.className='special-item-panel';
        const header=document.createElement('header'), title=document.createElement('h2'), back=document.createElement('button');
        back.className='special-item-back item-exit-button';
        title.textContent=itemId===24 ? (stage==='destination'?'移動先を確認':'移動するエリアを選択') : itemId===25 ? (stage==='result'?'平均化の結果':'全員の所持金を平均化') : '封印する相手を選択';
        back.textContent='戻る'; back.disabled=!!observer; back.onclick=onBack;
        if (stage==='result') back.hidden=true;
        header.append(title); panel.append(header,back);
        const choices=document.createElement('div'); choices.className='special-item-choices';
        const makeButton=(label,handler)=>{const button=document.createElement('button');button.textContent=label;button.disabled=!!observer;button.onclick=()=>handler?.(button);return button;};
        const card=(player,index)=>{const el=document.createElement('article');el.className='special-item-card';const image=document.createElement('img');image.alt='';image.src=options.icon(index);const name=document.createElement('strong');name.textContent=player.name;el.append(image,name);return el;};
        if (itemId===24 && stage==='areas') {
            choices.classList.add('is-areas');
            SpecialItemRules.destinations.forEach(entry=>{const button=makeButton('',()=>onSelect?.(entry.key));const image=document.createElement('img');image.src=entry.image;image.alt='';const name=document.createElement('span');name.textContent=entry.name;button.append(image,name);choices.append(button);});
        } else if (itemId===24 && stage==='destination') {
            const entry=SpecialItemRules.destinations.find(row=>row.key===destination);
            if (entry) { const view=document.createElement('div');view.className='special-item-destination';const image=document.createElement('img');image.src=entry.image;image.alt='';const detail=document.createElement('div');const name=document.createElement('strong');name.className='special-item-destination-prompt';name.textContent=entry.name+'\nへ移動しますか？';detail.append(name,makeButton('移動',button=>onExecute?.(button,entry.key)));view.append(image,detail);choices.append(view); }
        } else if (itemId===25) {
            choices.classList.add('is-equalize');
            const cards=document.createElement('div');cards.className='special-equalize-cards';
            players.forEach((player,index)=>{if(player.underground)return;const el=card(player,index),amount=document.createElement('strong');amount.className='special-item-money';amount.textContent=Number(player.money).toLocaleString('ja-JP')+'G';el.append(amount);cards.append(el);});
            const projected=document.createElement('p');projected.className='special-equalize-average';
            const value=SpecialItemRules.average(players);
            projected.textContent=(stage==='preview'?'実行後の平均：':'平均化後：')+(value===null?'—':Number(value).toLocaleString('ja-JP')+'G');
            const action=stage==='preview'?makeButton('平均化する',button=>onExecute?.(button)):makeButton('終了',button=>onExecute?.(button));
            action.classList.add(stage==='preview'?'special-equalize-execute':'item-exit-button');
            choices.append(cards,projected,action);
        } else {
            players.forEach((player,index)=>{if(index===actorIndex || player.underground)return;const el=card(player,index);el.append(makeButton('選ぶ',button=>onSelect?.(index,button)));choices.append(el);});
        }
        panel.append(choices);popup.append(panel);
        window.PlayerCardSize?.watch(popup);
        if ([24,25,26].includes(Number(itemId))) window.Plane02Layout?.apply(panel);
        if (stage === 'result') {
            const announcement=document.createElement('div');announcement.className='special-item-announcement';
            const portrait=document.createElement('img');portrait.src=options.icon(actorIndex);portrait.alt='';
            const itemName=ITEM_CONTENTS[itemId].name;
            const text=document.createElement('span'),name=document.createElement('strong');name.className='special-item-announcement-name';name.textContent=itemName;
            text.append(name,document.createTextNode('を使った！'));announcement.append(portrait,text);popup.append(announcement);
            window.TelopStandard?.apply(announcement, { message: text, portrait });
        }
    }
    window.SpecialItemUI = Object.freeze({show, hide});
})();
