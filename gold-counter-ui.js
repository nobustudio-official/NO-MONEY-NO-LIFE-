/* HUD presentation only; canonical balances are never interpolated. */
(function(){
 'use strict';
 const duration=1000;
 let owner=null,node=null,target=null,displayed=0,frame=0;
 function paint(){if(node?.isConnected)node.textContent=Math.round(displayed).toLocaleString('ja-JP')+'G';}
 function update(element,value,key){
  value=Number(value);if(!element||!Number.isFinite(value))return;
  if(node!==element||owner!==key||target===null){cancelAnimationFrame(frame);frame=0;node=element;owner=key;target=displayed=value;paint();return;}
  if(target===value)return;
  cancelAnimationFrame(frame);target=value;const from=displayed,started=performance.now();
  function tick(now){
   const progress=Math.min(1,Math.max(0,(now-started)/duration));
   displayed=progress===1?value:Math.round(from+(value-from)*(1-Math.pow(1-progress,3)));
   if(progress<1&&from!==value)displayed=value>from?Math.min(displayed,value-1):Math.max(displayed,value+1);
   paint();frame=progress<1?requestAnimationFrame(tick):0;
  }
  frame=requestAnimationFrame(tick);
 }
 function animate(element,from,value){
  from=Number(from);value=Number(value);
  if(!element||!Number.isFinite(from)||!Number.isFinite(value))return;
  const started=performance.now();
  element.textContent=Math.round(from).toLocaleString('ja-JP')+'G';
  function tick(now){
   if(!element.isConnected)return;
   const progress=Math.min(1,Math.max(0,(now-started)/duration));
   let shown=progress===1?value:Math.round(from+(value-from)*(1-Math.pow(1-progress,3)));
   if(progress<1&&from!==value)shown=value>from?Math.min(shown,value-1):Math.max(shown,value+1);
   element.textContent=shown.toLocaleString('ja-JP')+'G';
   if(progress<1)requestAnimationFrame(tick);
  }
  if(from!==value)requestAnimationFrame(tick);
 }
 window.GoldCounterUI=Object.freeze({update,animate});
})();
