(function(){
    'use strict';
    let view=null;
    const $=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
    function cardNode(card,number){const slot=$('div','fukubukuro-card-slot');const frame=$('div','fukubukuro-card');frame.dataset.frameId=Number(card.rank)===2?'BT03-G':'BT03-S';frame.append($('span','fukubukuro-card-number',number),$('span','fukubukuro-card-name',card.name));slot.append(frame);return slot;}
    function stopAudio(){if(!view?.audio)return;if(view.audioLoop&&typeof view.audio.removeEventListener==='function')view.audio.removeEventListener('timeupdate',view.audioLoop);view.audio.pause();view.audio.currentTime=0;view.audio=null;view.audioLoop=null;}
    function fitLabels(current){
        for(const label of [current.title,...current.cardRow.querySelectorAll('.fukubukuro-card-name')]){
            label.style.fontSize='';
            const available=label.clientWidth-1;
            if(available<=0||label.scrollWidth<=available)continue;
            const preferred=parseFloat(getComputedStyle(label).fontSize);
            let size=preferred*available/label.scrollWidth;
            label.style.fontSize=Math.max(.1,Math.floor(size*10)/10)+'px';
            while(label.scrollWidth>label.clientWidth&&size>.1){size-=.1;label.style.fontSize=Math.max(.1,Math.floor(size*10)/10)+'px';}
        }
    }
    function drawDice(current,state,time){
        const rect=current.canvas.getBoundingClientRect();
        if(rect.width<=0||rect.height<=8)return false;
        // Keep the normal gameplay size when it fits. Reserve the entire cube
        // rotation, forward throw and bounce, including a small edge margin.
        const radius=32*Math.sqrt(3)*1.08,forward=Math.min(rect.height*.22,Math.max(0,rect.height*.55-60));
        const scale=Math.min(window.DiceAnimation.gameplayScale,(rect.height-8-forward)/(42+2*radius));
        Object.assign(state,{diceScale:scale,cornerLaunch:true,launchHeight:.22,
            landingOffsetY:(rect.height+forward+42*scale)/2-rect.height*.55});
        return current.renderer.draw(state,time);
    }
    function diceState(phase,results,began,stopped=0){return {phase,results,count:3,began,stopped,showIndividualResults:false,centerLanding:true,canvasLanding:true};}
    function drawIdle(){const now=performance.now();view.diceState=diceState('result',[1,1,1],now,now);drawDice(view,view.diceState,now);}
    function observeLayout(current){
        const schedule=()=>{
            if(view!==current||current.layoutFrame)return;
            current.layoutFrame=requestAnimationFrame(()=>{
                current.layoutFrame=0;
                if(view!==current)return;
                fitLabels(current);
                if(['ready','result'].includes(current.phase))drawDice(current,current.diceState,performance.now());
            });
        };
        current.resizeObserver=new ResizeObserver(schedule);
        current.resizeObserver.observe(current.layer.querySelector('.fukubukuro-sp04'));
        current.resizeObserver.observe(current.canvas);
        document.fonts?.ready.then(schedule);
    }
    function showResult(event){
        if(!view||event?.eventId!==view.eventId||!Array.isArray(event.rolls)||['stopping','result'].includes(view.phase))return;
        const current=view;
        const cards=event.rolls.map(face=>event.cards[Number(face)-1]);
        current.phase='stopping';
        cancelAnimationFrame(current.raf);
        stopAudio();
        const stopCue=new Audio('sounds/サイコロ停止.mp3');(window.GameSE ? window.GameSE.playLocal(stopCue) : stopCue.play()).catch(()=>{});
        view.rollButton.disabled=true;view.rollButton.textContent='停止中…';
        const now=performance.now(),state=current.diceState=diceState('stopping',event.rolls.map(Number),now-1000,now);
        const draw=t=>{
            if(view!==current)return;
            if(!drawDice(current,state,t)){
                current.raf=requestAnimationFrame(draw);
                return;
            }
            state.phase='result';
            drawDice(current,state,t);
            current.cardRow.replaceChildren(...cards.map((card,index)=>cardNode(card,String(event.rolls[index]))));
            current.cardRow.classList.add('is-result');
            current.rollButton.hidden=true;
            current.title.textContent='以下のアイテムを入手！';
            current.finishButton.hidden=false;
            current.finishButton.disabled=!current.owner;
            current.phase='result';
            fitLabels(current);
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
        const now=performance.now(),state=current.diceState=diceState('rolling',[],now);
        const draw=t=>{if(view!==current||current.phase!=='rolling')return;drawDice(current,state,t);current.raf=requestAnimationFrame(draw);};draw(now);
    }
    function show(event,player,options={}){
        if(!event||!player)return;
        if(view&&view.eventId===event.eventId){if(event.status==='rolling')beginRoll(event.eventId);if(event.status==='result')showResult(event);return;}
        close();
        const itemName=ITEM_CONTENTS[29].name;
        const layer=$('section','fukubukuro-layer');layer.setAttribute('aria-label',itemName);
        const panel=$('div','fukubukuro-sp04');
        panel.dataset.frameId='SP04';
        const heading=$('div','fukubukuro-heading gp-root gp-shop-no-staff'),headingRow=$('div','gp-heading');
        const title=$('h2','fukubukuro-title','サイコロを振って出た目のアイテムを入手！');
        title.setAttribute('aria-live','polite');
        const finishButton=$('button','gp-close fukubukuro-finish','終了');finishButton.type='button';finishButton.hidden=true;finishButton.disabled=options.owner!==true;
        headingRow.append(title,finishButton);heading.append(headingRow);panel.append(heading);
        const diceStage=$('div','fukubukuro-dice-stage'),canvas=$('canvas','fukubukuro-dice');canvas.setAttribute('aria-label','サイコロ3個');
        const rollButton=$('button','fukubukuro-roll','サイコロを振る');rollButton.type='button';rollButton.disabled=options.owner!==true;
        diceStage.append(canvas,rollButton);panel.append(diceStage);
        const cardRow=$('div','fukubukuro-card-row');(event.cards||[]).forEach((card,index)=>cardRow.append(cardNode(card,String(index+1))));panel.append(cardRow);
        layer.append(panel);document.body.append(layer);
        window.Plane02Layout?.apply(panel, { once: true });
        window.Plane02Layout?.apply(panel);
        const current={eventId:event.eventId,layer,canvas,title,finishButton,rollButton,cardRow,audio:null,raf:0,layoutFrame:0,owner:options.owner===true,busy:false,phase:'ready',
            renderer:window.DiceAnimation.createRenderer(canvas,{stopMotion:window.DiceStopMotion.sample})};
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
            current.busy=true;finishButton.disabled=true;
            try{await options.onFinish();}
            catch(error){console.error('[福袋] 手番終了に失敗:',error);current.busy=false;if(view===current)finishButton.disabled=false;}
        };
        finishButton.onclick=finishFromResult;
        drawIdle();
        fitLabels(current);
        observeLayout(current);
        if(event.status==='rolling')beginRoll(event.eventId);
        if(event.status==='result')showResult(event);
    }
    function close(){if(!view)return;cancelAnimationFrame(view.raf);cancelAnimationFrame(view.layoutFrame);view.resizeObserver?.disconnect();stopAudio();window.Plane02Layout?.release(view.layer.querySelector('.fukubukuro-sp04'));if(view.gameScreen)view.gameScreen.inert=false;view.layer.remove();view=null;}
    window.FukubukuroUI=Object.freeze({show,close,isOpen:()=>Boolean(view)});
})();
