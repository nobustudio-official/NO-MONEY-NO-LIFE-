(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.PonziRules=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 const config=Object.freeze({minimumTotalAssetToAppear:100000,investmentUnit:10000,payoutInterval:3,payoutRate:0.3});
 function prepare(state,totalAssetValue=player=>Number(player?.money)||0){
  if(!state||!Array.isArray(state.players)||!state.players.length)return;
  if(!state.ponzi&&state.activePlayerIndex===0&&state.players.every(p=>Number(totalAssetValue(p))>config.minimumTotalAssetToAppear))state.ponzi={phase:'choices',round:0,investments:state.players.map(()=>0),declinedThisRound:state.players.map(()=>false),nextIndex:0,nextPayoutTurn:null,payout:null};
  const p=state.ponzi;if(!p||p.phase!=='waiting'||state.activePlayerIndex!==0||state.currentTurn<p.nextPayoutTurn)return;
  const collapseThreshold=(config.minimumTotalAssetToAppear/2)*state.players.length;
  const totalInvestment=p.investments.reduce((sum,n)=>sum+Number(n||0),0);
  if(totalInvestment===0){p.phase='departed';p.payout=null;return;}
  const failed=totalInvestment>=collapseThreshold
   || p.declinedThisRound?.length===state.players.length&&p.declinedThisRound.every(Boolean);
  const amounts=p.investments.map(n=>failed?0:Math.floor(n*config.payoutRate));
  p.payout={investments:p.investments.slice(),amounts,failed,settled:failed};p.phase='payout';
 }
 function settlePayout(state){
  const payout=state.ponzi.payout;
  // Older saves without this flag have already paid during prepare().
  if(!payout||payout.failed||payout.settled!==false)return;
  payout.amounts.forEach((amount,i)=>{state.players[i].money=Number(state.players[i].money)+amount;});
  payout.settled=true;
 }
 function pending(state){const p=state?.ponzi;if(!p)return false;return ['choices','thanks','refunded'].includes(p.phase)&&Number(p.nextIndex)===Number(state.activePlayerIndex)||(['payout','ending','departed'].includes(p.phase)&&Number(state.activePlayerIndex)===0);}
 function advanceChoice(state){const p=state.ponzi;p.nextIndex++;if(p.nextIndex>=state.players.length){p.nextIndex=0;p.phase='waiting';p.nextPayoutTurn=Number(state.currentTurn)+config.payoutInterval;}else p.phase='choices';}
 function act(state,action,amount){
  const p=state?.ponzi;if(!pending(state))return 'イベント操作の順番が違います。';
  if(p.phase==='choices'){
   const i=state.activePlayerIndex,player=state.players[i];
   if(action==='invest') {if(p.cancelled?.[i])return '解約済みのため、再出資はできません。';const value=Number(amount);if(!Number.isSafeInteger(value)||value<config.investmentUnit||value%config.investmentUnit||value>player.money)return '出資額が不正です。';player.money-=value;p.investments[i]+=value;p.declinedThisRound[i]=false;p.investmentNotice={playerIndex:i,amount:value};p.phase='thanks';return null;}
   else if(action==='cancel'&&p.round>0){if(p.cancelled?.[i])return 'すでに解約しています。';const refund=p.investments[i];player.money+=refund;p.investments[i]=0;p.declinedThisRound[i]=false;p.cancelled||=state.players.map(()=>false);p.cancelled[i]=true;p.refund={playerIndex:i,amount:refund};p.phase='refunded';return null;}
   else if(action==='decline')p.declinedThisRound[i]=true;
   else return '選択内容が不正です。';
   advanceChoice(state);
  }else if(['thanks','refunded'].includes(p.phase)&&action==='acknowledge'){
   delete p.refund;
   delete p.investmentNotice;
   advanceChoice(state);
  }else if(p.phase==='payout'&&action==='receive'){
   settlePayout(state);
  }else if(p.phase==='payout'&&action==='continue'){
   settlePayout(state);
   if(p.payout.failed){p.phase='ending';}else{p.phase='choices';p.round++;p.nextIndex=0;p.payout=null;p.declinedThisRound=state.players.map(()=>false);}
  }else if(['ending','departed'].includes(p.phase)&&action==='finish'){p.investments=p.investments.map(()=>0);p.phase='finished';}
  else return '選択内容が不正です。';
  return null;
 }
 return Object.freeze({config,prepare,pending,act});
});
