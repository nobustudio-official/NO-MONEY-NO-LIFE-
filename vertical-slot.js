/* Shared gold/treasure reel. Presentation only; callers own reward and sync. */
(function(){
 'use strict';
 const active=new WeakMap(),stepMs=120;
 function start(roulette,output,items){
  if(!roulette||!output||!Array.isArray(items)||!items.length)return {cancel(){},stop(text,done){if(done)done();}};
  active.get(output)?.cancel();
  let animation=null,frame=0,stopped=false,stopping=false,observer=null;
  output.replaceChildren();
  const viewport=document.createElement('div'),strip=document.createElement('div');
  viewport.className='slot-reel-viewport';strip.className='slot-reel-strip';
  // One candidate cycle plus padding is enough: transform wraps by a full
  // cycle, so the visible row sequence is identical on both sides of the wrap.
  for(let i=0;i<items.length+12;i++){
   const row=document.createElement('div');row.className='slot-reel-item';row.textContent=String(items[i%items.length]);strip.append(row);
  }
  viewport.append(strip);output.append(viewport);
  const height=parseFloat(getComputedStyle(strip.firstElementChild).height)||30;
  const from=-(items.length+5)*height,to=-5*height,cycle=items.length*stepMs;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  strip.style.transform=`translateY(${from}px)`;
  function clean(){cancelAnimationFrame(frame);animation?.cancel();animation=null;observer?.disconnect();observer=null;if(active.get(output)===controller)active.delete(output);}
  function cancel(){if(stopped)return;stopped=true;clean();}
  function finish(text,done){if(stopped)return;stopped=true;output.textContent=String(text);clean();if(typeof done==='function')done();}
  const controller={cancel,stop(text,done){
   if(stopped||stopping)return;stopping=true;
   // Freeze the actual compositor position before cancelling the loop. Never
   // jump back to a JavaScript timer's last requested destination.
   const matrix=getComputedStyle(strip).transform;
   const current=matrix==='none'?from:new DOMMatrixReadOnly(matrix).m42;
   animation?.cancel();animation=null;cancelAnimationFrame(frame);
   strip.style.transform=`translateY(${current}px)`;
   const targetIndex=Math.max(0,Math.ceil(-current/height)-4),target=-targetIndex*height;
   strip.children[targetIndex].textContent=String(text);
   const distance=target-current,duration=distance/height*stepMs*2;
   if(reduced||distance<=0){finish(text,done);return;}
   if(typeof strip.animate==='function'){
    animation=strip.animate([{transform:`translateY(${current}px)`},{transform:`translateY(${target}px)`}],{duration,easing:'cubic-bezier(0.333333,0.666667,0.666667,1)',fill:'forwards'});
    animation.finished.then(()=>finish(text,done)).catch(()=>{});
   }else{
    const began=performance.now();
    const tick=now=>{if(stopped)return;const p=Math.min(1,(now-began)/duration);strip.style.transform=`translateY(${current+distance*(2*p-p*p)}px)`;if(p<1)frame=requestAnimationFrame(tick);else finish(text,done);};
    frame=requestAnimationFrame(tick);
   }
  }};
  active.set(output,controller);
  observer=new MutationObserver(()=>{if(!output.isConnected||roulette.style.display==='none')cancel();});
  observer.observe(roulette,{attributes:true,attributeFilter:['style'],childList:true,subtree:true});
  if(!reduced){
   if(typeof strip.animate==='function')animation=strip.animate([{transform:`translateY(${from}px)`},{transform:`translateY(${to}px)`}],{duration:cycle,iterations:Infinity,easing:'linear'});
   else{
    const began=performance.now();
    const tick=now=>{if(stopped||stopping)return;strip.style.transform=`translateY(${from+(to-from)*((now-began)%cycle)/cycle}px)`;frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
   }
  }
  return controller;
 }
 window.VerticalSlot=Object.freeze({start});
})();
