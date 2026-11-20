/* Approved stop motion, shared by the game and dice preview. */
(function(root){
 'use strict';
 function sample(progress,left,forward){
  const p=Math.max(0,Math.min(1,progress));
  let distance,lift;
  if(p<.52){
   const q=p/.52;distance=.82*q;lift=-42*4*q*(1-q);
  }else if(p<.87){
   const q=(p-.52)/.35;distance=.82+.14*q;lift=-28*4*q*(1-q);
  }else{
   const q=(p-.87)/.13;distance=.96+.04*(1-(1-q)**2);lift=0;
  }
  return{lift,travel:-left*distance,ground:forward*distance,depth:1+.08*Math.min(1,p/.52)};
 }
 const api={id:'one-bounce',sample};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.DiceStopMotion=api;
})(typeof window==='undefined'?globalThis:window);
