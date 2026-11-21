(function(){
    'use strict';
    const backgrounds={capital:'戦闘_街.webp',town:'戦闘_街.webp',grassland:'戦闘1.webp',forest:'戦闘_森.webp',lake:'戦闘_湖.webp',desert:'戦闘_砂漠.webp',snow:'戦闘_雪山.webp',ruins:'戦闘_遺跡.webp',volcano:'戦闘_火山.webp'};
    let active=null;
    const lines=[
        {speaker:'チビリン',text:'おっと。ここを通りたければ通行料をよこしな！'},
        {speaker:'player',text:'チビリンのカツアゲに遭遇した！'},
        {speaker:'player',text:''},
        {speaker:'チビリン',text:'ケケケ！これで今月の営業成績はトップだ！'}
    ];
    const $=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!=null)node.textContent=text;return node;};
    function areaFor(player,squares,regionData){
        const region=window.MapRegionRules?.regionForPlayer(player,squares,regionData);
        return region||{id:'grassland',name:'草原'};
    }
    function build(player,options){
        const region=areaFor(player,options.squares,options.regionData);
        const image=`images/backgrounds/scenes/${backgrounds[region.id]||backgrounds.grassland}`;
        const root=$('section','bridge-mugging');root.setAttribute('aria-label','チビリンのカツアゲイベント');
        const frame=$('div','bridge-mugging-frame'),background=$('div','bridge-mugging-background');background.style.backgroundImage=`url("${image}")`;
        const character=$('img','bridge-mugging-character');character.src='images/characters/enemy/normal/チビリン.webp';character.alt='チビリン';
        const panel=$('div','bridge-mugging-an06');panel.tabIndex=0;panel.setAttribute('role','button');panel.setAttribute('aria-label','会話を進める');
        const speaker=$('span','bridge-mugging-speaker'),icon=$('img','bridge-mugging-player-icon');icon.alt=player.name||'プレイヤー';
        icon.src=options.playerIcon||'';
        const copy=$('p','bridge-mugging-copy'),next=$('span','bridge-mugging-next','次へ ▶');
        panel.append(speaker,icon,copy,next);frame.append(background,character,panel);root.append(frame);document.body.append(root);window.Plane02Layout?.apply(frame);
        return {root,frame,character,panel,speaker,icon,copy,next};
    }
    function render(view,lineIndex,triggered){
        const {character,panel,speaker,icon,copy}=view;
        if(!triggered){
            character.hidden=true;icon.hidden=true;speaker.hidden=false;speaker.textContent='イベント案内';
            copy.textContent='今回はチビリンは現れなかった。';panel.classList.remove('has-player-icon');
            panel.setAttribute('aria-label','今回はチビリンは現れなかった。閉じる');return;
        }
        const line=(lineIndex===2&&view.prevented)?{speaker:'player',text:'無敵の加護でカツアゲを防いだ！'}
            :lineIndex===2?{speaker:'player',text:`${Number(view.fee||window.BridgeMuggingRules.FEE).toLocaleString('ja-JP')}Gをチビリンに奪われた！`}
            :lines[Math.max(0,Math.min(lines.length-1,lineIndex))];
        if(lineIndex===2&&!view.observer&&!view.prevented){
            window.GameSE?.play?.('mugging',{shared:Boolean(view.online),eventId:`${view.eventId}:money-lost`}).catch(error=>console.warn('[SE] カツアゲ音を再生できません:',error));
        }
        character.hidden=false;copy.textContent=line.text;
        const isPlayer=line.speaker==='player';panel.classList.toggle('has-player-icon',isPlayer);
        speaker.hidden=isPlayer;icon.hidden=!isPlayer;speaker.textContent=isPlayer?'':line.speaker;
        panel.setAttribute('aria-label',`${isPlayer?'':line.speaker+'：'}${line.text}。会話を進める`);
    }
    function show(player,options){
        closeRemote(active?.eventId);
        const online=Boolean(options.sync&&options.eventId);
        const lineIndex=Number.isInteger(options.lineIndex)?options.lineIndex:(options.triggered?0:-1);
        const view=build(player,options);view.eventId=options.eventId||`offline-mugging-${Date.now()}`;view.lineIndex=lineIndex;view.triggered=Boolean(options.triggered);view.online=online;view.observer=false;view.busy=false;view.onComplete=options.onComplete;
        view.prevented = options.prevented === true;
        view.fee = Math.max(0,Number(options.fee)||window.BridgeMuggingRules.FEE);
        active=view;
        render(view,lineIndex,view.triggered);
        if(online){
            options.sync.syncUI({eventId:view.eventId,title:'カツアゲ',message:'チビリンのカツアゲイベント',variant:'bridge-mugging',playerIndex:Number(options.playerIndex),lineIndex})
                .then(response=>{if(!response?.ok&&active===view){console.warn('[カツアゲ] 表示同期に失敗:',response?.error);}});
        }
        const advance=async()=>{
            if(active!==view||view.busy)return;
            view.busy=true;
            try{
                if(view.online){
                    const response=await options.sync.actBridgeMugging(view.eventId,view.lineIndex,`${view.eventId}:next:${view.lineIndex}`);
                    if(!response?.ok||!response.state)throw new Error(response?.error||'カツアゲの進行を同期できませんでした。');
                    if(active!==view)return;
                    options.applyState(response.state,'bridge-mugging-action',true);
                    const state=response.state.bridgeMugging;
                    if(!state){finish(view);return;}
                    view.lineIndex=Number(state.lineIndex);view.triggered=Boolean(state.triggered);view.prevented=Boolean(state.prevented);view.fee=Math.max(0,Number(state.fee)||view.fee);render(view,view.lineIndex,view.triggered);
                }else if(!view.triggered||view.lineIndex>=lines.length-1){
                    finish(view);return;
                }else{
                    if(view.lineIndex===1){view.prevented=Boolean(window.DisadvantageImmunityRules?.isActive(player));if(!view.prevented){player.money=(Number(player.money)||0)-view.fee;options.onMoneyChanged?.(player);}}
                    view.lineIndex+=1;render(view,view.lineIndex,true);
                }
            }catch(error){
                console.error('[カツアゲ] 進行に失敗:',error);
                if(!view.online)finish(view);
            }finally{if(active===view)view.busy=false;}
        };
        view.panel.onclick=advance;view.panel.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!event.repeat)advance();}};
        view.stopPageAdvance=window.CommonAnnouncements?.bindPageAdvance(view.root,advance);
        view.panel.focus({preventScroll:true});
    }
    function finish(view){
        if(active!==view)return;
        view.stopPageAdvance?.();window.Plane02Layout?.release(view.frame);view.root.remove();active=null;view.onComplete?.();
    }
    function renderRemote(data){
        if(!data||!Number.isInteger(Number(data.playerIndex)))return;
        const player=window.players?.[Number(data.playerIndex)];if(!player)return;
        if(active&&active.eventId===data.eventId){
            active.lineIndex = Number(data.lineIndex);
            active.triggered = active.lineIndex >= 0;
            active.prevented = data.prevented === true;
            active.fee = Math.max(0,Number(data.fee)||active.fee||window.BridgeMuggingRules.FEE);
            render(active, active.lineIndex, active.triggered);
            return;
        }
        closeRemote(active?.eventId);
        const view=build(player,{squares:window.mapData,regionData:window.MapRegionData,playerIcon:window.getPlayerCharacterIcon?.(Number(data.playerIndex))});
        view.eventId=data.eventId;view.lineIndex=Number(data.lineIndex);view.triggered=view.lineIndex>=0;view.prevented=Boolean(data.prevented);view.fee=Math.max(0,Number(data.fee)||window.BridgeMuggingRules.FEE);view.online=true;view.observer=true;view.busy=true;active=view;
        view.panel.classList.add('is-observer');view.panel.removeAttribute('role');view.panel.tabIndex=-1;
        view.next.hidden=true;
        render(view,view.lineIndex,view.triggered);
    }
    function closeRemote(eventId){
        if(active&&(!eventId||active.eventId===eventId)){active.stopPageAdvance?.();window.Plane02Layout?.release(active.frame);active.root.remove();active=null;}
    }
    function isOpen(){return Boolean(active);}
    window.BridgeMuggingPresentation=Object.freeze({show,renderRemote,closeRemote,isOpen});
})();
