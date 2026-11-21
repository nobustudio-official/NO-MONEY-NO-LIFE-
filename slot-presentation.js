/* Gold/treasure slot input and retained arrival banner. No reward rules here. */
(function(){
 'use strict';
 let current=null;
 const excluded='.game-hud,.action-menu,.action-menu-button,.online-recovery-panel';
 function clear(){
  if(!current)return;
  current.observer.disconnect();current.layoutObserver?.disconnect();window.removeEventListener('resize',current.position);cancelAnimationFrame(current.raf);document.removeEventListener('click',current.click,true);
  current.banner.remove();current=null;
 }
 function watch(roulette,{player,icon}={}){
  const name=roulette.id==='goldRoulette'?'お金':roulette.id==='itemRoulette'?'宝箱':null;
  if(!name)return;
  clear();
  const banner=document.createElement('div');banner.id='slotArrivalBanner';banner.className='event-popup common-announcement slot-arrival-announcement';banner.setAttribute('role','status');
  if(icon){const face=document.createElement('img');face.className='announcement-portrait';face.src=icon;face.alt=player?.name||'プレイヤー';banner.append(face);}
  else banner.classList.add('announcement-no-portrait');
  const message=document.createElement('div');message.className='event-popup-message';message.textContent=name+'マスに止まった！';banner.append(message);
  document.body.append(banner);
  window.CommonAnnouncements?.fitText?.(message);
  const hud=document.querySelector('.game-screen > .game-hud')||document.querySelector('.game-hud');
  const state={banner,observer:null,layoutObserver:null,click:null,position:null,raf:0};
  state.position=()=>{
   if(state.raf)return;
   state.raf=requestAnimationFrame(()=>{
    state.raf=0;
    if(!roulette.isConnected||!banner.isConnected)return;
    const upper=hud?.getBoundingClientRect().bottom??0;
    const lower=banner.getBoundingClientRect().top;
    roulette.style.top=`${Math.round((upper+lower)/2)}px`;
   });
  };
  state.layoutObserver=window.ResizeObserver?new ResizeObserver(state.position):null;
  if(hud)state.layoutObserver?.observe(hud);
  state.layoutObserver?.observe(banner);
  window.addEventListener('resize',state.position,{passive:true});
  state.position();
  const click=event=>{
   if(event.target.closest(excluded))return;
   if(!roulette.isConnected||getComputedStyle(roulette).display==='none'){clear();return;}
   // Consume the whole gesture: it must not also move the map, open details,
   // acknowledge a subsequent result, or submit a second stop request.
   event.preventDefault();event.stopImmediatePropagation();
   if(window.onlineGame?.isOnline&&!window.isLocalOnlineTurn())return;
   if(typeof roulette.onclick==='function')roulette.onclick.call(roulette,event);
  };
  const observer=new MutationObserver(()=>{if(!roulette.isConnected||roulette.style.display==='none')clear();});
  observer.observe(roulette,{attributes:true,attributeFilter:['style']});
  state.observer=observer;state.click=click;current=state;document.addEventListener('click',click,true);
 }
 window.SlotPresentation=Object.freeze({watch,clear});
})();
