/* Fixed movement display. Game rules and online authority remain in game.js. */
(function(){
 'use strict';
 function ensure(){
  let panel=document.getElementById('diceMovementPanel');
  if(!panel){
   panel=document.createElement('div');panel.id='diceMovementPanel';panel.className='dice-movement-panel';panel.hidden=true;
   panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
   const value=document.createElement('span');value.className='dice-movement-remaining';panel.append(value);document.body.append(panel);
  }
  return panel;
 }
 function layout(panel){
   if(window.MapScene?.deferViewportUpdate?.(updateLayout))return;
  const hud=document.querySelector('.game-hud'),destination=document.querySelector('.game-hud .hud-destination');
  const action=document.querySelector('.action-menu-button'),name=document.querySelector('.game-hud .hud-player-name');
  const hudBox=hud?.getBoundingClientRect(),destinationBox=destination?.getBoundingClientRect(),actionBox=action?.getBoundingClientRect();
  panel.style.top=`${hudBox&&hudBox.height?hudBox.bottom+16:100}px`;
  panel.style.right=`${destinationBox&&destinationBox.width?Math.max(16,innerWidth-destinationBox.right):16}px`;
  panel.style.width=`${actionBox&&actionBox.width?actionBox.width:190}px`;
  panel.style.height=`${actionBox&&actionBox.height?actionBox.height:92}px`;
  if(hud){const style=getComputedStyle(hud);for(const property of ['backgroundImage','backgroundColor','border','borderRadius','boxShadow','color'])panel.style[property]=style[property];}
  const text=getComputedStyle(name||document.body);
  panel.style.fontFamily=text.fontFamily;panel.style.fontWeight=name?text.fontWeight:'900';panel.style.fontSize=name?text.fontSize:'30px';
 }
 function show(steps,observer=false){
  if(!Number.isInteger(Number(steps))||Number(steps)<=0){hide(observer);return;}
  const panel=ensure();panel.classList.toggle('observer-dice-movement-counter',observer);
  panel.querySelector('.dice-movement-remaining').textContent=`あと${Number(steps)}マス`;
  panel.hidden=false;layout(panel);
 }
 function hide(observerOnly=false){const panel=document.getElementById('diceMovementPanel');if(panel&&(!observerOnly||panel.classList.contains('observer-dice-movement-counter')))panel.remove();}
  function updateLayout(){const panel=document.getElementById('diceMovementPanel');if(panel&&!panel.hidden)layout(panel);}
  addEventListener('resize',updateLayout);
 window.DiceMovementCounter={ensure,show,hide};
})();
