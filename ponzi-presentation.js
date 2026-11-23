(function(){
 'use strict';
 const intro=['こんにちは。冒険者の皆様。','ここまで素晴らしいご活躍ですね！','そんな優秀な冒険者様の方々に、あるご協力のお願いに参りました。','その名も……Magic Kids Project。','未来の子供たちのための出資を募っております。','出資金は子供たちの育成や、事業運営に充てられます。','出資いただいたゴールドは、いつでもお返し可能です。','また、事業運営で得た収益の一部を3ターンに一度、お渡しいたします。','少額でも構いません。ぜひご検討よろしくお願いいたします。'];
 const ending=['配当金の支払いが行われず、エリート不動産屋も姿を現さない・・・。','その後、出資したゴールドが帰ってくることはなかった。','プレイヤー達は詐欺にあった！出資したゴールドを失った！'];
 const fmt=n=>Math.floor(Number(n)||0).toLocaleString('ja-JP');let session=null,root=null,previousInert=null;
 let resumeRevealBGM=null;
 let stopPageAdvance=null;
 function mount(){if(root)return;root=document.createElement('section');root.id='ponzi-preview';root.hidden=true;root.innerHTML=`<div class="ponzi-outer"></div><div class="ponzi-shade"></div><header class="ponzi-hud"><strong>Magic Kids Project</strong><span data-player></span><span>所持ゴールド <b data-gold></b>G</span><span>出資額 <b data-invest></b>G</span></header><div class="ponzi-frame"><div class="ponzi-bg"></div><img class="ponzi-character" src="images/characters/npc/shops/エリート不動産屋.webp" alt="エリート不動産屋"><div class="ponzi-panel" role="button" tabindex="0"><div class="ponzi-speaker">エリート不動産屋</div><p class="ponzi-text"></p><span class="ponzi-next">次へ ▶</span></div><div class="ponzi-actions br-choices" hidden></div><button class="ponzi-choice-back" type="button" hidden>戻る</button><div class="ponzi-amount-panel" hidden><label>出資額（10,000G単位）</label><div class="ponzi-amount-row"><button type="button" data-step="-1">−</button><input type="number" min="10000" step="10000"><button type="button" data-step="1">＋</button></div><button class="ponzi-execute" type="button">実行</button><button class="ponzi-amount-back" type="button">戻る</button></div><section class="ponzi-sp04" hidden><h2>Magic Kids Project</h2><div class="ponzi-payout-head"><span>名前</span><span>出資金</span><span>配当</span><span>利回り</span></div><div class="ponzi-payout-rows"></div><button class="ponzi-payout-next" type="button">次へ</button></section></div>`;root.querySelector('.ponzi-frame').insertAdjacentHTML('beforeend','<section class="ponzi-report" aria-label="事業成果レポート" hidden><h2>Magic Kids Project 事業成果レポート</h2><div class="ponzi-report-choice"><div class="br-card-slot"><button type="button" data-frame-id="BT03-G" class="ponzi-report-view"><span class="br-card-front">レポートを見る</span></button></div></div></section>');root.querySelector('.ponzi-bg').style.backgroundImage='url("images/characters/npc/shops/資産店.webp")';root.querySelector('.ponzi-outer').style.backgroundImage='url("images/characters/npc/shops/資産店.webp")';document.body.append(root);}
 const el=selector=>root.querySelector(selector);
 function close(notify=true){if(!session)return;stopPageAdvance?.();stopPageAdvance=null;const old=session;session=null;root.hidden=true;window.Plane02Layout?.release(el('.ponzi-frame'));const game=document.querySelector('.game-container');if(game&&previousInert!==null)game.inert=previousInert;previousInert=null;resumeRevealBGM?.();resumeRevealBGM=null;if(notify)old.sync?.('close');}
 function stageForPhase(ponzi, stage) {
  if (ponzi.phase === 'payout') {
   if (stage === 'payout' || (stage === 'payoutGreeting' && !ponzi.payout.failed)) return stage;
   return 'report';
  }
  if (ponzi.phase === 'choices') {
   return ['intro', 'greeting', 'offer', 'choice', 'amount', 'confirm'].includes(stage) ? stage : 'offer';
  }
  return ponzi.phase;
 }
 function restoreStage(view, state, stage, line) {
  view.state = state;
  view.stage = stageForPhase(state.ponzi, stage);
  view.line = view.stage === stage ? line : 0;
 }
 function buttons(list){const box=el('.ponzi-actions');box.replaceChildren();box.hidden=false;list.forEach(([label,handler],i)=>{const slot=document.createElement('div'),button=document.createElement('button'),front=document.createElement('span');slot.className='br-card-slot';button.type='button';button.dataset.frameId=i?'BT03-S':'BT03-G';button.dataset.choice=i?'decline':'work';front.className='br-card-front';front.textContent=label;button.append(front);button.disabled=session.observer||session.busy;button.onclick=handler;slot.append(button);box.append(slot);});}
 function render(notify=true){
  const s=session;if(!s)return;const state=s.state,p=state.ponzi,player=state.players[state.activePlayerIndex];if(!p||!player){close(false);return;}
  stopPageAdvance?.();stopPageAdvance=null;
  if (!resumeRevealBGM && (s.stage === 'ending' || (s.stage === 'payout' && p.payout.failed))) {
   resumeRevealBGM = window.pauseAreaBGM();
  }
  if(root.hidden){const game=document.querySelector('.game-container');if(game){previousInert=game.inert;game.inert=true;}}root.hidden=false;window.Plane02Layout?.apply(el('.ponzi-frame'));root.dataset.stage=s.stage;el('[data-player]').textContent=player.name;el('[data-gold]').textContent=fmt(player.money);el('[data-invest]').textContent=fmt(p.investments[state.activePlayerIndex]);
  const panel=el('.ponzi-panel'),text=el('.ponzi-text'),speaker=el('.ponzi-speaker');panel.onclick=null;panel.onkeydown=null;el('.ponzi-next').hidden=true;el('.ponzi-actions').hidden=true;el('.ponzi-choice-back').hidden=s.stage!=='choice'||s.observer;el('.ponzi-amount-panel').hidden=s.stage!=='amount';el('.ponzi-sp04').hidden=s.stage!=='payout';el('.ponzi-report').hidden=s.stage!=='report';speaker.textContent=s.stage==='ending'?'':'エリート不動産屋';
  const advance=fn=>{el('.ponzi-next').hidden=false;if(!s.observer){const advancePage=()=>{if(session!==s||s.busy)return;window.GameSE?.play?.('confirm',{shared:true}).catch(error=>console.warn('[SE] 画面送り音を再生できません:',error));fn();};panel.onclick=advancePage;panel.onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();advancePage();}};stopPageAdvance=window.CommonAnnouncements?.bindPageAdvance(root,advancePage);}};
  const go=stage=>{s.stage=stage;s.line=0;render();};
  if(s.stage==='intro'){text.textContent=intro[s.line];advance(()=>{if(++s.line>=intro.length)go('offer');else render();});}
  else if(s.stage==='greeting'){text.textContent=`${player.name}さん、こんにちは。出資についてご案内します。`;advance(()=>go('offer'));}
  else if(s.stage==='report'){const button=el('.ponzi-report-view');button.disabled=s.observer||s.busy;button.onclick=()=>{window.GameSE?.play?.('confirm',{shared:true}).catch(error=>console.warn('[SE] 画面送り音を再生できません:',error));go(p.payout?.failed?'payout':'payoutGreeting');};}
  else if(s.stage==='payoutGreeting'){text.textContent='こんにちは。配当金をお渡ししにきました。';advance(()=>go('payout'));}
  else if(s.stage==='offer'){text.textContent=p.round===0?`${player.name}さん、出資しますか？`:`${player.name}さん、追加出資または解約を選べます。`;buttons(p.round===0?[['出資する',()=>go('amount')],['見送る',()=>submit('decline')]]:[['追加・解約',()=>go('choice')],['断る',()=>submit('decline')]]);}
  else if(s.stage==='choice'){text.textContent='追加出資または解約を選んでください。';buttons([['追加出資',()=>go('amount')],['解約',()=>go('confirm')]]);el('.ponzi-choice-back').onclick=()=>go('offer');}
  else if(s.stage==='amount'){text.textContent=`${player.name}さんの出資額を入力してください。`;const input=el('.ponzi-amount-row input'),unit=window.PonziRules.config.investmentUnit,max=Math.floor(Math.max(0,player.money)/unit)*unit;input.max=String(max);input.value=String(max?Math.min(max,Math.max(unit,Math.ceil(player.money/2/unit)*unit)):0);input.disabled=s.observer;el('.ponzi-execute').disabled=s.observer||max<unit;el('.ponzi-execute').onclick=()=>submit('invest',Number(input.value));el('.ponzi-amount-back').disabled=s.observer;el('.ponzi-amount-back').onclick=()=>go(p.round?'choice':'offer');root.querySelectorAll('[data-step]').forEach(button=>{button.disabled=s.observer;button.onclick=()=>{input.value=String(Math.min(max,Math.max(unit,Number(input.value)+Number(button.dataset.step)*unit)));};});}
  else if(s.stage==='confirm'){text.textContent=`${player.name}さんの出資額 ${fmt(p.investments[state.activePlayerIndex])}G を全額返金して解約しますか？`;buttons([['解約を確定',()=>submit('cancel')],['戻る',()=>go('choice')]]);}
  else if(s.stage==='thanks'){text.textContent='ありがとうございます。また3ターン後に伺います。';advance(()=>submit('acknowledge'));}
  else if(s.stage==='payout'){text.textContent='';const rows=el('.ponzi-payout-rows');rows.replaceChildren();state.players.forEach((person,i)=>{const row=document.createElement('div');row.className='ponzi-payout-row';const name=document.createElement('span');name.className='ponzi-payout-name';const icon=document.createElement('img');icon.src=window.getPlayerCharacterIcon?.(i)||'';icon.alt='';name.append(icon,document.createTextNode(person.name));const inv=document.createElement('span');inv.textContent=fmt(p.payout.investments[i])+'G';const pay=document.createElement('strong');pay.textContent='＋'+fmt(p.payout.amounts[i])+'G';const rate=document.createElement('span');rate.textContent=p.payout.failed?'0％':Math.round(window.PonziRules.config.payoutRate*100)+'％';row.append(name,inv,pay,rate);rows.append(row);});el('.ponzi-payout-next').disabled=s.observer||s.busy;el('.ponzi-payout-next').onclick=()=>{window.GameSE?.play?.('confirm',{shared:true}).catch(error=>console.warn('[SE] 画面送り音を再生できません:',error));submit('continue');};}
  else if(s.stage==='ending'){
   text.textContent=ending[s.line];
   const reveal=s.line===ending.length-1;
   if (reveal && !s.revealSoundPlayed) {
    s.revealSoundPlayed = true;
    window.GameSE?.play('ponziReveal').catch(error=>console.warn('[SE] ポンジ発覚音を再生できません:',error));
   }
   advance(()=>{if(reveal)submit('finish');else{s.line++;render();}});
  }
  if(s.stage==='payout'&&!s.observer){const next=el('.ponzi-payout-next');stopPageAdvance=window.CommonAnnouncements?.bindPageAdvance(root,()=>{if(session===s&&!s.busy&&!next.disabled)next.onclick();});}
   if(panel.parentElement!==root)root.append(panel);
   window.TelopStandard?.apply(panel,{message:text,next:el('.ponzi-next'),speaker});
   if(notify&&!s.observer)s.sync?.('open',{stage:s.stage,line:s.line});
 }
 async function submit(action,amount){const s=session;if(!s||s.busy||s.observer)return;s.busy=true;try{const next=await s.submit(action,amount);if(session!==s)return;if(!next)throw new Error('イベント操作を確定できませんでした。');if(action==='invest')window.GameSE?.play?.('payment').catch(error=>console.warn('[SE] 出資の支払い音を再生できません:',error));s.state=next;s.busy=false;if(!window.PonziRules.pending(next)){const done=s.done;close();done?.();return;}s.stage=next.ponzi.phase==='payout'?'payout':next.ponzi.phase==='ending'?'ending':next.ponzi.phase==='thanks'?'thanks':'offer';s.line=0;render();}catch(error){s.busy=false;alert(error.message||'イベント操作を確定できませんでした。');render();}}
 function open(state,options){mount();if(session&&!session.observer)return;const p=state.ponzi;session={state,observer:false,submit:options.submit,sync:options.sync,done:options.done,busy:false,line:0,stage:p.phase==='payout'?'report':p.phase==='ending'?'ending':p.phase==='thanks'?'thanks':p.round===0&&state.activePlayerIndex===0?'intro':'greeting'};render();}
 function observe(state, data) {
  if (session && !session.observer) return;
  if (!window.PonziRules.pending(state)) { close(false); return; }
  mount();
  session ||= { observer:true, busy:false };
  restoreStage(session, state, data.stage, data.line || 0);
  render(false);
 }
 function reconcile(state) {
  const s = session;
  if (!s || s.observer || !state) return;
  s.busy = false;
  if (!window.PonziRules.pending(state)) {
   const done = s.done;
   close();
   done?.();
   return;
  }
  restoreStage(s, state, s.stage, s.line);
  render();
 }
 window.PonziPresentation=Object.freeze({open,observe,close,reconcile,closeObserver:()=>{if(session?.observer)close(false);},isOpen:()=>Boolean(session&&!session.observer)});
})();
