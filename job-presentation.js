/* Approved job scene text and result placement. No money or turn rules here. */
(function(){
 'use strict';
 const homes=new WeakMap();
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const gold=value=>Number(value).toLocaleString('ja-JP')+'G';
 function workResult(name,turns,reward){return escape(name)+'は'+Number(turns)+'ターン、バイトをします。<br>報酬 <strong>'+gold(reward)+'</strong> は、バイト終了時に受け取ります。';}
 function paintChoices(scene,wage){
  scene.popup.classList.add('job-approved-layout');
  if(!scene.wage)return;
  const amount=document.createElement('strong');amount.textContent=gold(wage);
  scene.wage.replaceChildren('1ターン働くと ',amount,' を受け取れます。バイトをしますか？');
  const decline=scene.popup.querySelector('.job-none-button');if(decline)(decline.querySelector('.br-card-front')||decline).textContent='断る';
  const work=scene.popup.querySelector('#jobWorkButton');if(work)(work.querySelector('.br-card-front')||work).textContent='1ターン働く';
  const choices=scene.popup.querySelector('.job-choices'),container=scene.popup.querySelector('.job-scene');
  if(choices&&container){
   choices.classList.add('br-choices');
   for(const button of choices.querySelectorAll('button')){
    if(button.parentElement.classList.contains('br-card-slot'))continue;
    const slot=document.createElement('div');slot.className='br-card-slot';button.before(slot);slot.append(button);
    const front=document.createElement('span');front.className='br-card-front';front.textContent=button.textContent;button.replaceChildren(front);
   }
   container.append(choices);
  }
 }
 function placeResult(popup,metadata){
  if(!homes.has(popup))homes.set(popup,popup.parentElement);
  const job=document.getElementById('jobPopup'),scene=job?.querySelector('.job-scene');
  if(metadata?.common&&popup.classList.contains('job-result-popup')&&scene&&job.style.display!=='none'){
   scene.append(popup);
   const choices=scene.querySelector('.job-choice-panel'),dialogue=scene.querySelector('.job-dialogue-box');
   if(choices)choices.hidden=true;if(dialogue)dialogue.style.display='none';
  }else if(popup.parentElement!==homes.get(popup)&&homes.get(popup)?.isConnected){homes.get(popup).append(popup);}
 }
 function restoreResult(){const popup=document.getElementById('eventPopup');if(popup)placeResult(popup,null);}
 window.JobPresentation=Object.freeze({paintChoices,workResult,refusalResult:name=>escape(name)+'はバイトを断った。',placeResult,restoreResult});
})();
