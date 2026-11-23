(function(){
    'use strict';
    let view=null;
    const $=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
    function cardNode(card,number){const slot=$('div','fukubukuro-card-slot');const frame=$('div','fukubukuro-card');frame.dataset.frameId=Number(card.rank)===2?'BT03-G':'BT03-S';frame.append($('span','fukubukuro-card-number',number),$('span','fukubukuro-card-name',card.name));slot.append(frame);return slot;}
    function stopAudio(){if(!view?.audio)return;if(view.audioLoop&&typeof view.audio.removeEventListener==='function')view.audio.removeEventListener('timeupdate',view.audioLoop);view.audio.pause();view.audio.currentTime=0;view.audio=null;view.audioLoop=null;}
    function setTelop(text){view.telopCopy.textContent=text;window.CommonAnnouncements?.fitText?.(view.telopCopy);}
    function drawIdle(){const rect=view.canvas.getBoundingClientRect();view.canvas.width=Math.max(1,Math.round(rect.width*(devicePixelRatio||1)));view.canvas.height=Math.max(1,Math.round(rect.height*(devicePixelRatio||1)));const renderer=window.DiceAnimation.createRenderer(view.canvas,{stopMotion:window.DiceStopMotion.sample});const now=performance.now();renderer.draw({phase:'result',results:[1,1,1],count:3,began:now,stopped:now,showIndividualResults:false,centerLanding:true,canvasLanding:true,diceScale:.9},now);}
    function showResult(event){
        if(!view||event?.eventId!==view.eventId||!Array.isArray(event.rolls)||['stopping','result'].includes(view.phase))return;
        const current=view;
        const cards=event.rolls.map(face=>event.cards[Number(face)-1]);
        current.phase='stopping';
        cancelAnimationFrame(current.raf);
        stopAudio();
        const stopCue=new Audio('sounds/サイコロ停止.mp3');(window.GameSE ? window.GameSE.playLocal(stopCue) : stopCue.play()).catch(()=>{});
        view.rollButton.disabled=true;view.rollButton.textContent='停止中…';
        const renderer=window.DiceAnimation.createRenderer(view.canvas,{stopMotion:window.DiceStopMotion.sample});
        const now=performance.now(),state={phase:'stopping',results:event.rolls.map(Number),count:3,began:now-1000,stopped:now,showIndividualResults:false,centerLanding:true,canvasLanding:true,diceScale:.9};
        const draw=t=>{
            if(view!==current)return;
            if(!renderer.draw(state,t)){
                current.raf=requestAnimationFrame(draw);
                return;
            }
            state.phase='result';
            renderer.draw(state,t);
            current.cardRow.replaceChildren(...cards.map((card,index)=>cardNode(card,String(event.rolls[index]))));
            current.cardRow.classList.add('is-result');
            current.rollButton.hidden=true;
            setTelop('上記アイテムを入手した！');
            current.phase='result';
        };
        draw(now);
    }
    function beginRoll(eventId){
        if(!view||view.eventId!==eventId||view.phase!=='ready')return;
        const current=view;
        current.phase='rolling';
        current.rollButton.disabled=!current.owner||current.busy;
        current.rollButton.textContent='止める';current.rollButton.setAttribute('aria-label','サイコロを止める');
        view.audio=new Audio('sounds/サイコロ.wav');view.audio.loop=false;
        // Match dice-game-ui.js: loop the spin cue at 0.83s rather than looping the full file.
        view.audioLoop=()=>{if(view?.audio&&view.audio.currentTime>=.83)view.audio.currentTime=0;};
        if(typeof view.audio.addEventListener==='function')view.audio.addEventListener('timeupdate',view.audioLoop);(window.GameSE ? window.GameSE.playLocal(view.audio, Infinity, { loopEnd: .83 }) : view.audio.play()).catch(()=>{});
        const renderer=window.DiceAnimation.createRenderer(view.canvas,{stopMotion:window.DiceStopMotion.sample});const now=performance.now();const state={phase:'rolling',results:[],count:3,began:now,stopped:now,showIndividualResults:false,centerLanding:true,canvasLanding:true,diceScale:.9};
        const draw=t=>{if(view!==current||current.phase!=='rolling')return;renderer.draw(state,t);current.raf=requestAnimationFrame(draw);};draw(now);
    }
    function show(event,player,options={}){
        if(!event||!player)return;
        if(view&&view.eventId===event.eventId){if(event.status==='rolling')beginRoll(event.eventId);if(event.status==='result')showResult(event);return;}
        close();
        const itemName=ITEM_CONTENTS[29].name;
        const layer=$('section','fukubukuro-layer');layer.setAttribute('aria-label',itemName);
        const panel=$('div','fukubukuro-sp04');
        panel.dataset.frameId='SP04';
        panel.append($('h2','fukubukuro-title','サイコロを振って出た目のアイテムを入手！'));
        const diceStage=$('div','fukubukuro-dice-stage'),canvas=$('canvas','fukubukuro-dice');canvas.setAttribute('aria-label','サイコロ3個');
        const rollButton=$('button','fukubukuro-roll','サイコロを振る');rollButton.type='button';rollButton.disabled=options.owner!==true;
        diceStage.append(canvas,rollButton);panel.append(diceStage);
        const cardRow=$('div','fukubukuro-card-row');(event.cards||[]).forEach((card,index)=>cardRow.append(cardNode(card,String(index+1))));panel.append(cardRow);
        const telop=$('div','fukubukuro-an02'),icon=$('img','fukubukuro-player-icon');telop.dataset.frameId='AN02';icon.src=options.playerIcon||'';icon.alt=player.name||'プレイヤー';
        const telopCopy=$('p','fukubukuro-an02-copy');telopCopy.append($('strong','fukubukuro-item-name',itemName),document.createTextNode('を使った！'));telop.append(icon,telopCopy);layer.append(panel,telop);document.body.append(layer);
        window.TelopStandard?.apply(telop, { message: telopCopy, portrait: icon, reserveSpace: true });
        const current={eventId:event.eventId,layer,canvas,rollButton,cardRow,telopCopy,audio:null,raf:0,owner:options.owner===true,busy:false,phase:'ready'};
        if (current.owner) {
            const screen = document.querySelector?.('.game-screen');
            if (screen && !screen.inert) { screen.inert = true; current.gameScreen = screen; }
        }
        view=current;
        rollButton.onclick=async()=>{
            if(view!==current||current.busy||!current.owner||!['ready','rolling'].includes(current.phase))return;
            const stopping=current.phase==='rolling';
            current.busy=true;rollButton.disabled=true;
            try{
                if(stopping){
                    const result=await options.onStop();
                    if(view===current)showResult(result);
                }else{
                    await options.onStart();
                    if(view===current)beginRoll(event.eventId);
                }
            }catch(error){
                console.error(stopping?'[福袋] 抽選を確定できません:':'[福袋] サイコロを開始できません:',error);
            }finally{
                current.busy=false;
                if(view===current)rollButton.disabled=!['ready','rolling'].includes(current.phase);
            }
        };
        const finishFromResult=async()=>{
            if(view!==current||!current.owner||current.phase!=='result'||current.busy)return;
            current.busy=true;
            try{await options.onFinish();}
            catch(error){console.error('[福袋] 手番終了に失敗:',error);current.busy=false;}
        };
        panel.onclick=finishFromResult;telop.onclick=finishFromResult;
        drawIdle();
        if(event.status==='rolling')beginRoll(event.eventId);
        if(event.status==='result')showResult(event);
    }
    function close(){if(!view)return;cancelAnimationFrame(view.raf);stopAudio();if(view.gameScreen)view.gameScreen.inert=false;view.layer.remove();view=null;}
    window.FukubukuroUI=Object.freeze({show,close,isOpen:()=>Boolean(view)});
})();
