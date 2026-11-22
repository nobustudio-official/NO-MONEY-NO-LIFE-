/* Normal-battle reward presentation. Server/offline callers retain settlement rules. */
(function(){
 'use strict';
 let flow=null,sequence=0,home=null;
 const number=value=>Number(value||0).toLocaleString('ja-JP');
 const local=()=>!window.onlineGame?.isOnline||window.isLocalOnlineTurn();
 function close(){
  if(flow?.battleElement&&flow.screenClick)flow.battleElement.removeEventListener('click',flow.screenClick);
  const popup=document.getElementById('rewardPopup');
  if(popup){popup.style.display='none';popup.dataset.rewardFlowActive='false';if(home?.isConnected&&popup.parentElement!==home)home.append(popup);}
  document.getElementById('battleMainPopup')?.classList.remove('battle-reward-mode');
  flow=null;
 }
 function markSelected(type){
  const choices=document.getElementById('rewardChoices');
  choices.classList.add('br-reward-claimed');
  for(const button of choices.querySelectorAll('button')){
   button.disabled=true;
   const chosen=button.dataset.reward===type;
   button.classList.toggle('br-card-selected',chosen);
   button.classList.toggle('br-card-dismissed',!chosen);
   if(chosen){const slot=button.parentElement;slot.style.translate=getComputedStyle(slot).translate;slot.classList.add('br-slot-selected');}
  }
 }
 function receive(reward,battleId){
  if(!flow||(battleId&&String(flow.battleId)!==String(battleId)))return;
  if(flow.reward)return;
  flow.reward={type:reward.type,value:Number(reward.value)||0};
  markSelected(reward.type);
  const message=document.getElementById('rewardMessage');message.replaceChildren();
  const players=window.players||[];
  let index=players.indexOf(flow.player);
  if(index<0&&flow.player.id!=null)index=players.findIndex(player=>player.id!=null&&String(player.id)===String(flow.player.id));
  if(index<0&&flow.player.characterId!=null){
   const matches=players.map((player,i)=>String(player.characterId)===String(flow.player.characterId)?i:-1).filter(i=>i>=0);
   if(matches.length===1)index=matches[0];
  }
  const icon=window.getPlayerCharacterIcon?.(index);
  if(icon){const face=document.createElement('img');face.className='announcement-portrait';face.src=icon;face.alt=flow.player.name;message.parentElement.prepend(face);message.parentElement.classList.add('has-portrait');}
  const amount=document.createElement('strong');amount.className=reward.type==='money'?'br-money':'br-mana';
  amount.textContent=number(reward.value)+(reward.type==='money'?'G':'');
  if(reward.type==='money')message.append(flow.player.name+'は ',amount,' を受け取った！');
  else message.append(flow.player.name+'の魔力が ',amount,' 上がった！');
  const next=document.getElementById('rewardNext');next.hidden=false;next.disabled=!local();
  window.GameSE?.play?.(reward.type==='money'?'moneyDisplay':'magicPowerUp',{eventId:'battle-reward:'+flow.key}).catch(()=>{});
 }
 function show(player,callback,turn,monster,battleId=null){
  if(flow&&document.getElementById('rewardPopup')?.dataset.rewardFlowActive==='true')return;
  const battle=document.getElementById('battleMainPopup'),popup=document.getElementById('rewardPopup');
  if(!battle||!popup)return;
  if(!home)home=popup.parentElement;
  close();
  const multiplier=window.getMonsterInflationMultiplier();
  const rewards=[{type:'money',value:calculateMonsterGoldReward(monster?.goldReward||0,multiplier)},
   {type:'magicPower',value:Math.ceil((Number(monster?.magicReward||0)*multiplier-1e-7)/10)*10}];
  flow={player,callback,battleId,key:battleId||'offline-'+(++sequence),reward:null,pending:false,battleElement:battle};
  const current=flow;
  battle.querySelector('.battle-main-screen').append(popup);battle.classList.add('battle-reward-mode');
  popup.className='battle-reward-layer';popup.dataset.rewardFlowActive='true';
  popup.replaceChildren();
  const choices=document.createElement('div');choices.id='rewardChoices';choices.className='br-choices';choices.setAttribute('role','group');choices.setAttribute('aria-label','戦闘報酬の選択');
  const banner=document.createElement('div');banner.className='reward-announcement';
  const message=document.createElement('div');message.id='rewardMessage';message.setAttribute('aria-live','polite');message.textContent='報酬を1つ選んでください。';
  const next=document.createElement('button');next.id='rewardNext';next.type='button';next.textContent='次へ▶';next.hidden=true;
  next.onclick=()=>{if(flow!==current||!flow.reward||!local())return;window.GameSE?.play?.('confirm',{shared:true}).catch(()=>{});const finish=flow.callback;close();if(finish)finish();};
  current.screenClick=event=>{if(flow===current&&flow.reward&&local()&&!event.target.closest('#rewardNext'))next.click();};
  battle.addEventListener('click',current.screenClick);
  banner.append(message,next);banner.onclick=event=>{if(!event.target.closest('button')&&!next.hidden&&!next.disabled)next.click();};
  for(const reward of rewards){
   const slot=document.createElement('div');slot.className='br-card-slot';
   const button=document.createElement('button');button.type='button';button.dataset.reward=reward.type;button.disabled=!local();
   const front=document.createElement('span');front.className='br-card-front';
   const icon=document.createElement('img');icon.src=reward.type==='money'?'images/ui/icons/interface/gold.webp':'images/ui/icons/interface/mana.webp';icon.alt='';
   const label=document.createElement('span');label.className='br-reward-label';label.append(reward.type==='money'?'ゴールド':'魔力');
   const amount=document.createElement('span');amount.className=reward.type==='money'?'br-money':'br-mana';amount.textContent='＋'+number(reward.value)+(reward.type==='money'?'G':'');label.append(amount);front.append(icon,label);button.append(front);slot.append(button);choices.append(slot);
   button.onclick=async event=>{
    event.stopPropagation();
    if(flow!==current||flow.pending||flow.reward||!local())return;
    flow.pending=true;choices.querySelectorAll('button').forEach(card=>card.disabled=true);
    try{
     const sync=window.onlineGame?.isOnline?window.onlineGame.sync:null;
     if(sync){
      if(!battleId)throw Error('戦闘情報を確認できませんでした。');
      const response=await sync.actNormalBattle('reward',{rewardType:reward.type,battleId},window.createOnlineSyncEventId('battle-reward'));
      if(flow!==current)return;
      if(!response?.ok||!response.state||!response.battle)throw Error(response?.error||'報酬を確定できませんでした。');
      window.applyOnlineCanonicalState(response.state,'normal-battle-reward',true);
      receive(response.battle.reward,battleId);
     }else{
      if(reward.type==='money')player.money+=reward.value;else player.magicPower+=reward.value;
      window.updatePlayerStatusUI(player);receive(reward);
     }
    }catch(error){
     if(flow!==current)return;
     flow.pending=false;choices.querySelectorAll('button').forEach(card=>card.disabled=!local());
     message.textContent='報酬を確定できませんでした。'+error.message+' もう一度選んでください。';
    }
   };
  }
  popup.append(choices,banner);popup.style.display='block';
  window.GameSE?.play?.('rewardDisplay',{eventId:'battle-reward-display:'+flow.key}).catch(()=>{});
 }
 window.BattleRewardUI=Object.freeze({show,receive,close});
})();
