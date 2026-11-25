/* Approved job scene text and result placement. No money or turn rules here. */
(function(){
 'use strict';
 const homes=new WeakMap();
 const choiceCleanups=new WeakMap();
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const gold=value=>Number(value).toLocaleString('ja-JP')+'G';
 function workResult(name,turns,reward){return escape(name)+'は'+Number(turns)+'ターン、バイトをします。<br>報酬 <strong>'+gold(reward)+'</strong> は、バイト終了時に受け取ります。';}
 function releaseChoices(scene){const root=scene?.popup?.querySelector('.job-scene');choiceCleanups.get(root)?.();}
 function placeChoices(scene){
  const root=scene?.popup?.querySelector('.job-scene'),cards=root?.querySelector('.job-choices'),panel=root?.querySelector('.job-choice-panel'),staff=root?.querySelector('.job-staff');
  if(!root||!cards||!panel||!staff)return;
  releaseChoices(scene);
  const update=()=>{
   if(!root.isConnected||panel.hidden||scene.popup.style.display==='none')return;
   if(window.MapScene?.deferViewportUpdate?.(update))return;
   const frame=root.getBoundingClientRect(),person=staff.getBoundingClientRect(),telop=panel.getBoundingClientRect();
   if(!frame.height||!person.height||!telop.height)return;
   const center=(person.top+person.bottom)/2,bottom=telop.top-8;
   const height=Math.max(48,2*(bottom-center)),top=bottom-height;
   cards.style.left=(telop.left-frame.left)+'px';cards.style.right=(frame.right-telop.right)+'px';cards.style.top=(top-frame.top)+'px';cards.style.bottom='auto';cards.style.height=height+'px';
  };
  let frameId=0;
   const schedule=()=>{if(window.MapScene?.deferViewportUpdate?.(update))return;if(!frameId)frameId=requestAnimationFrame(()=>{frameId=0;update();});};
  const observer=new ResizeObserver(schedule);[root,panel,staff].forEach(node=>observer.observe(node));
  window.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
  let done=false;
  const cleanup=()=>{if(done)return;done=true;observer.disconnect();window.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('resize',schedule);window.visualViewport?.removeEventListener('scroll',schedule);if(frameId)cancelAnimationFrame(frameId);['left','right','top','bottom','height'].forEach(property=>cards.style.removeProperty(property));choiceCleanups.delete(root);};
  choiceCleanups.set(root,cleanup);schedule();
 }
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
   document.body.append(popup);
   const choices=scene.querySelector('.job-choice-panel'),dialogue=scene.querySelector('.job-dialogue-box');
   if(choices)choices.hidden=true;if(dialogue)dialogue.style.display='none';
  }else if(popup.parentElement!==homes.get(popup)&&homes.get(popup)?.isConnected){homes.get(popup).append(popup);}
 }
 function restoreResult(){const popup=document.getElementById('eventPopup');if(popup)placeResult(popup,null);}
 window.JobPresentation=Object.freeze({paintChoices,placeChoices,releaseChoices,workResult,refusalResult:name=>escape(name)+'はバイトを断った。',placeResult,restoreResult});
})();
