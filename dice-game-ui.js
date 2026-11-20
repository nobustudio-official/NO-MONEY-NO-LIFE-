/* Presentation adapter only: online outcomes always come from the server. */
(function(){
 'use strict';
 const active=new Set(),remoteItems=new Map(),remoteTreasureBonuses=new Map();
 let treasureBonusPreview;
 function sound(audio){audio.pause();audio.currentTime=0;audio.play().catch(()=>{});}
 function open(container,count,options={}){
  for(const old of active)old.cancel();
  const single=container.id==='diceRoulette';
  container.classList.add('dice-modern');container.classList.remove('spinning');
  container.innerHTML=`<canvas class="dice-visual-canvas" aria-label="サイコロの出目"></canvas><div class="dice-visual-result" aria-live="polite" hidden><span class="dice-movement-counter-value"></span></div><button type="button" class="dice-visual-stop" aria-label="サイコロを止める"></button><div id="${single?'diceRouletteNumber':'multiDiceNumbers'}" hidden></div>${single?'':'<div id="multiDiceTotal" hidden></div>'}`;
  container.style.display='block';
  const hud = !options.alignWithSlot ? document.querySelector?.('.game-hud') : null;
  const fitHud = () => {
   if (!hud) return;
   const bottom = hud.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
   container.style.setProperty('--dice-hud-bottom', `${Math.max(0, Math.ceil(bottom))}px`);
  };
  fitHud();
  const hudObserver = hud && window.ResizeObserver ? new window.ResizeObserver(fitHud) : null;
  hudObserver?.observe(hud);
  if (hud) window.addEventListener('resize', fitHud);
  const canvas=container.querySelector('canvas'),button=container.querySelector('button'),output=container.querySelector('.dice-visual-result');
  const landingTarget=options.alignWithSlot?document.getElementById('itemRouletteName'):null;
  const preview=options.preview===true;
  const renderer=DiceAnimation.createRenderer(canvas,{stopMotion:window.DiceStopMotion.sample});
  let state={phase:preview?'idle':'rolling',results:[],began:performance.now(),stopped:0,count,showIndividualResults:false,centerLanding:true,cornerLaunch:true,launchHeight:.22,diceScale:.7,landingOffsetY:80},raf=0,paint=0,closed=false,stopping=false,resolveStop=null,readOnly=options.readOnly===true,confirmed=false,resultNotified=false;
  const loop=()=>{if(diceSound.currentTime>=.83)diceSound.currentTime=0;};
  let stopCuePlayed=false;
  function startLoop(){diceSound.loop=false;sound(diceSound);diceSound.addEventListener('timeupdate',loop);}
  function stopLoop(){diceSound.pause();diceSound.removeEventListener('timeupdate',loop);}
  function playStopCue(){if(stopCuePlayed)return;stopCuePlayed=true;stopLoop();sound(stopSound);}
  function cancel(){
   if(closed)return;
   closed=true;
   cancelAnimationFrame(raf);
   if(!preview)stopLoop();
   hudObserver?.disconnect();
   if (hud) window.removeEventListener('resize', fitHud);
   if (hud) container.style.removeProperty('--dice-hud-bottom');
   window.removeEventListener('resize',redrawStillDie);
   landingTarget?.parentElement.removeEventListener('transitionend',redrawStillDie);
   container.onclick=null;
   container.style.display='none';
   active.delete(controller);
   if(resolveStop)resolveStop(false);
  }
  function confirm(){
   if(closed)return;
   confirmed=true;
   if(state.phase!=='result')return;
   options.onConfirm?.(state.results.slice());
   const done=resolveStop;resolveStop=null;cancel();if(done)done(true);
  }
  function update(t){
   if(closed)return;
   if(container.style.display==='none'){cancel();return;}
   if(t-paint>=1000/30){paint=t;
    const finished=draw(t);
    if(finished){
     state.phase='result';
     button.disabled=readOnly;button.textContent='';button.setAttribute('aria-label',readOnly?'他のプレイヤーの操作を待っています':'移動へ進む');
     const sum=state.results.reduce((a,b)=>a+b,0);
     output.querySelector('.dice-movement-counter-value').textContent=String(sum);
     canvas.setAttribute('aria-label',`出目 ${state.results.join('、')}。合計${sum}マス`);
     document.getElementById(single?'diceRouletteNumber':'multiDiceTotal').textContent=String(sum);
     container.onclick=request;
     if(!resultNotified){resultNotified=true;options.onResult?.(state.results.slice());}
     if(confirmed)confirm();
    }
   }
   if(state.phase!=='result')raf=requestAnimationFrame(update);
  }
  function draw(time){
   if(landingTarget){
    const bounds=landingTarget.getBoundingClientRect();
    state.landingOffsetY=bounds.top+bounds.height/2-window.innerHeight/2;
   }
   return renderer.draw(state,time);
  }
  function redrawStillDie(){if(!closed&&(preview||state.phase==='result'))draw(performance.now());}
  function request(){if(closed||button.disabled)return;if(state.phase==='result'){confirm();return;}if(stopping)return;button.disabled=true;playStopCue();options.onRequestStop?.();}
  const controller={cancel,confirm,remote:options.remote===true,get closed(){return closed;},enable(enabled){readOnly=!enabled;button.disabled=!enabled;if(enabled&&stopCuePlayed&&!stopping){stopCuePlayed=false;startLoop();}},
   stop(results){
    if(closed)return Promise.resolve(false);
    if(stopping)return controller.completion;
    if(!Array.isArray(results)||results.length!==count||!results.every(v=>Number.isInteger(v)&&v>=1&&v<=6))return Promise.reject(new Error('サイコロの出目が不正です。'));
    stopping=true;button.disabled=true;button.setAttribute('aria-label','停止中');container.onclick=null;playStopCue();
    state={...state,phase:'stopping',results:results.slice(),stopped:performance.now()};
    if(options.instant)state.stopped-=DiceAnimation.duration(count);
    controller.completion=new Promise(resolve=>{resolveStop=resolve;});return controller.completion;
   }};
  if(landingTarget){
   window.addEventListener('resize',redrawStillDie);
   landingTarget.parentElement.addEventListener('transitionend',redrawStillDie);
  }
  active.add(controller);
  if(preview){
   button.remove();
   canvas.setAttribute('aria-label','振る前のサイコロ');
   draw(state.began);
  }else{
   button.disabled=readOnly;
   button.setAttribute('aria-label',readOnly?'他のプレイヤーの操作を待っています':'サイコロを止める');
   button.onclick=request;container.onclick=request;
   if(landingTarget)draw(state.began);
   startLoop();
   raf=requestAnimationFrame(update);
  }
  return controller;
 }
 function single(result,callback,options={}){
  const container=document.getElementById('diceRoulette');let stopped=false;
  const finish=value=>{if(stopped)return;stopped=true;options.onStop?.(value);view.stop([value]).then(ok=>{if(ok)callback?.(value);});};
  const view=open(container,1,{readOnly:options.remote,remote:options.remote,onRequestStop:()=>finish(Number(result))});
  if(!options.remote)return null;
  const stop=value=>{value=Number(value);if(Number.isInteger(value)&&value>=1&&value<=6)finish(value);};stop.cancel=view.cancel;return stop;
 }
 function multiple(count,callback,itemId,forceSix=false){
  const sync=window.onlineGame?.isOnline?window.onlineGame.sync:null;
  const action=window.GameActionInput?.get('item-use');
  const resumeMenu=()=>{
   if(action&&!action.isCurrent())return;
   document.getElementById('rouletteButton').disabled=false;
   document.getElementById('inventoryButton').disabled=false;
   action?.finish();
  };
  const eventId=createOnlineSyncEventId('multi-dice-roulette');
  let requesting=false;
  const view=open(document.getElementById('multiDiceRoulette'),count,{readOnly:Boolean(sync),onRequestStop:request});
  async function request(){
   if(requesting||view.closed)return;requesting=true;
   try{
    const response=sync?await sync.syncRoulette({eventId,type:'multiDice',action:'stop'}):{ok:true,value:Array.from({length:count},()=>forceSix?6:1+Math.floor(Math.random()*6))};
    if(view.closed)return;
    if(!response?.ok)throw new Error(response?.error||'サイコロの結果を確認できませんでした。');
    if(sync&&response.state)applyOnlineCanonicalState(response.state,'multi-dice-stop',true);
    const values=response.value?.map(Number);
    const complete=await view.stop(values);
    if(complete)callback?.(values.reduce((a,b)=>a+b,0));
   }catch(error){
    if(view.closed)return;
    view.enable(true);
    showEventPopup('サイコロの通信エラー',error.message,()=>{}, {sync:false});
   }finally{requesting=false;}
  }
  if(sync)sync.syncRoulette({eventId,type:'multiDice',action:'start',diceCount:Number(count),itemId:Number(itemId)}).then(async response=>{
   if(view.closed)return;
   if(response?.ok){view.enable(true);return;}
   view.cancel();
   const snapshot=await sync.requestState().catch(()=>null);
   if(snapshot?.ok&&snapshot.state)applyOnlineCanonicalState(snapshot.state,'item-dice-start-rejected');
   showEventPopup('アイテムを使用できません',response?.error||'サーバーでアイテムを確認できませんでした。',resumeMenu,{sync:false});
  }).catch(error=>{if(view.closed)return;view.cancel();showEventPopup('通信エラー',error.message,resumeMenu,{sync:false});});
 }
 function showTreasureBonusPreview(){
  if(treasureBonusPreview&&!treasureBonusPreview.closed)return;
  treasureBonusPreview=open(document.getElementById('diceRoulette'),1,{alignWithSlot:true,preview:true});
 }
 function closeTreasureBonusPreview(){
  treasureBonusPreview?.cancel();
  treasureBonusPreview=null;
 }
 function treasureBonus(treasureEventId,onResult,onError){
  const sync=window.onlineGame?.isOnline?window.onlineGame.sync:null;
  const eventId=createOnlineSyncEventId('treasure-bonus-dice');
  let startReady=!sync,requesting=false,responseForResult=null;
  const view=open(document.getElementById('diceRoulette'),1,{alignWithSlot:true,readOnly:Boolean(sync),onRequestStop:stop,onResult(values){onResult?.(Number(values[0]),responseForResult);}});
  const ready=sync?sync.syncRoulette({eventId,type:'treasureBonus',action:'start',treasureEventId}).then(response=>{
   if(view.closed)return false;
   if(!response?.ok){const error=new Error(response?.error||'宝箱の追加サイコロを開始できませんでした。');view.cancel();onError?.(error);return false;}
   startReady=true;view.enable(true);return true;
  }).catch(error=>{if(!view.closed){view.cancel();onError?.(error);}return false;}):Promise.resolve(true);
  async function stop(){
   if(requesting||view.closed||!startReady)return;requesting=true;
   try{
    const response=sync?await sync.syncRoulette({eventId,type:'treasureBonus',action:'stop',treasureEventId}):{ok:true,value:[1+Math.floor(Math.random()*6)]};
    if(view.closed)return;
    if(!response?.ok)throw new Error(response?.error||'サイコロの出目を確定できませんでした。');
    const values=Array.isArray(response.value)?response.value.map(Number):[Number(response.value)];
    if(values.length!==1||!Number.isInteger(values[0])||values[0]<1||values[0]>6)throw new Error('サイコロの出目が不正です。');
    responseForResult=response;
    view.stop(values);
   }catch(error){
    if(view.closed)return;view.enable(true);requesting=false;onError?.(error);
   }
  }
  return {eventId,ready,stop,confirm:()=>view.confirm(),cancel:()=>view.cancel(),get closed(){return view.closed;}};
 }
 function remoteMulti(data){
  if(data.action==='start'){
   if(remoteItems.has(data.eventId))return;
   remoteItems.clear();remoteItems.set(data.eventId,open(document.getElementById('multiDiceRoulette'),Number(data.diceCount),{readOnly:true,remote:true,instant:data.recovery}));
  }else if(data.action==='stop'){
   let view=remoteItems.get(data.eventId);
   if(!view){
    if(!Array.isArray(data.value))return;
    view=open(document.getElementById('multiDiceRoulette'),data.value.length,{readOnly:true,remote:true,instant:data.recovery});remoteItems.set(data.eventId,view);
   }
   view.stop(data.value.map(Number));
  }
 }
 function remoteTreasureBonus(data){
  if(data.action==='start'){
   remoteTreasureBonuses.get(data.eventId)?.cancel();
   remoteTreasureBonuses.set(data.eventId,open(document.getElementById('diceRoulette'),1,{alignWithSlot:true,readOnly:true,remote:true,instant:data.recovery}));
  }else if(data.action==='stop'){
   let view=remoteTreasureBonuses.get(data.eventId);
   if(!view){view=open(document.getElementById('diceRoulette'),1,{alignWithSlot:true,readOnly:true,remote:true,instant:data.recovery});remoteTreasureBonuses.set(data.eventId,view);}
   const value=Array.isArray(data.value)?data.value.map(Number):[Number(data.value)];
   if(value.length===1&&Number.isInteger(value[0])&&value[0]>=1&&value[0]<=6)view.stop(value);
  }
 }
 function closeRemoteTreasureBonus(eventId){if(eventId)remoteTreasureBonuses.get(eventId)?.cancel();else for(const view of remoteTreasureBonuses.values())view.cancel();if(eventId)remoteTreasureBonuses.delete(eventId);else remoteTreasureBonuses.clear();}
 window.DiceGameUI={single,multiple,treasureBonus,showTreasureBonusPreview,closeTreasureBonusPreview,remoteMulti,remoteTreasureBonus,closeRemoteTreasureBonus,confirmRemote(){for(const view of active)if(view.remote)view.confirm();},cancelAll(){for(const view of active)view.cancel();remoteItems.clear();remoteTreasureBonuses.clear();}};
})();
