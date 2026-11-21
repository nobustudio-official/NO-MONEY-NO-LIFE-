/* Approved shop/holdings presentation. Game/server callbacks own all gameplay. */
(function () {
    'use strict';
    const views=new Map(), format=n=>Number(n).toLocaleString('ja-JP');
    const clock=()=>window.onlineGame?.sync?.serverNow?.() ?? Date.now();
    const node=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
    const anchorCleanups=new WeakMap();
    function anchorFrame(root) {
        anchorCleanups.get(root)?.();
        if(root.id==='soundSettingsPopup')root.style.display='flex';
        const screen=document.querySelector('.game-screen'),banner=screen?.querySelector('.game-hud'),dice=screen?.querySelector('#rouletteButton');
        if(!screen||!banner||!dice)return null;
        const update=()=>{
            if(root.style.display==='none'||!root.isConnected)return;
            const bounds=screen.getBoundingClientRect(),header=banner.getBoundingClientRect(),button=dice.getBoundingClientRect();
            if(!bounds.width||!bounds.height||!header.height||!button.width)return;
            const gap=17,top=header.bottom+gap,left=button.right+gap;
            const right=bounds.right-(45+(49-gap)),bottom=bounds.bottom-21;
            if(right<=left||bottom<=top)return;
            root.style.setProperty('--gp-inv-top',`${top}px`);
            root.style.setProperty('--gp-inv-left',`${left}px`);
            root.style.setProperty('--gp-inv-width',`${right-left}px`);
            root.style.setProperty('--gp-inv-height',`${bottom-top}px`);
            root.setAttribute('data-anchored','');
        };
        let frame=0;
        const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
        const observer=new ResizeObserver(schedule);[screen,banner,dice].forEach(el=>observer.observe(el));
        window.addEventListener('resize',schedule,{passive:true});
        window.visualViewport?.addEventListener('resize',schedule,{passive:true});
        window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
        let cleaned=false;
        const cleanup=()=>{
            if(cleaned)return;cleaned=true;
            observer.disconnect();window.removeEventListener('resize',schedule);
            window.visualViewport?.removeEventListener('resize',schedule);
            window.visualViewport?.removeEventListener('scroll',schedule);anchorCleanups.delete(root);
            if(frame)cancelAnimationFrame(frame);root.removeAttribute('data-anchored');
        };
        anchorCleanups.set(root,cleanup);
        schedule();
        return cleanup;
    }
    function anchorOwnedPanel(v) {
        v.anchorCleanup?.();v.anchorCleanup=null;
        if(v.config?.scene){
            v.anchorCleanup=window.Plane02Layout?.apply(v.root)||null;
            return;
        }
        if(!['inventory','assets','magic-list'].includes(v.config?.kind))return;
        v.anchorCleanup=anchorFrame(v.root);
    }
    function make(id,listId,closeId,shop) {
        const root=document.getElementById(id);
        let view=views.get(id);if(view?.root===root){if(!view.scroll.contains(view.table))view.scroll.replaceChildren(view.table);return view;}
        if(!root)throw Error('表示先がありません: '+id);
        const oldList=document.getElementById(listId),close=document.getElementById(closeId)||node('button');
        oldList?.remove();close.remove();root.replaceChildren();root.className='gp-root '+(shop?'gp-shop':'gp-owned');root.dataset.gamePanel='';root.style.cssText='display:none';
        root.setAttribute('role','dialog');root.setAttribute('aria-labelledby',id+'Title');
        const panel=node('section','gp-panel'),heading=node('header','gp-heading'),title=node('h1');title.id=id+'Title';
        const summary=node('div','gp-summary'),headerAction=node('button','gp-header-action');headerAction.type='button';headerAction.hidden=true;heading.append(title,headerAction,summary);
        const columns=node('div','gp-columns');columns.hidden=true;
        const scroll=oldList?.tagName==='DIV'?oldList:node('div');scroll.className='gp-scroll';scroll.tabIndex=0;
        const table=node('table','gp-table'),cols=node('colgroup'),body=oldList?.tagName==='TBODY'?oldList:node('tbody');
        if(!oldList)scroll.id=listId;body.replaceChildren();table.append(cols,body);scroll.replaceChildren(table);
        const footer=node('footer','gp-footer'),detail=node('div','gp-detail'),icon=node('img','gp-detail-icon'),copy=node('div','gp-copy'),effect=node('div','gp-effect'),note=node('div','gp-note'),usage=node('div','gp-usage');
        icon.hidden=true;icon.alt='';copy.append(effect,note);note.hidden=true;usage.hidden=true;detail.append(icon,copy,usage);
        close.id=closeId;close.type='button';close.className='gp-close';close.replaceChildren(document.createTextNode(shop?'店を出る':'閉じる'));
        footer.append(detail,close);
        panel.append(heading,columns,scroll,footer);root.append(panel);
        let staff,hello,background;
        if(shop){background=node('img','gp-background');background.alt='';const side=node('aside','gp-side');staff=node('img','gp-staff');hello=node('p','gp-hello');side.append(staff,hello);root.prepend(background);root.append(side);}
        view={id,root,panel,title,summary,headerAction,columns,scroll,table,cols,body,footer,detail,icon,effect,note,usage,close,staff,hello,background,selected:null,hovered:null,waits:new Map(),busy:new Set(),fading:new Set(),notice:null,noticeText:null};views.set(id,view);
        scroll.onpointerleave=()=>{view.hovered=null;describe(view);publish(view);};
        scroll.addEventListener('scroll',()=>{if(!view.remote&&view.config?.canAct())publish(view);},{passive:true});
        root.addEventListener('click',e=>{if(!view.config?.canAct()||e.target.closest('tr[data-key]'))return;view.selected=null;view.hovered=null;describe(view);publish(view);});
        new ResizeObserver(()=>fit(view)).observe(scroll);
        return view;
    }
    function snapshot(v) {return {key:v.selected??v.hovered,pinned:v.selected!==null,scrollTop:v.scroll.scrollTop,noticeKey:v.notice,cooldowns:[...v.waits].filter(([,until])=>until>clock()).map(([key,until])=>({key,until}))};}
    function publish(v) {
        if(v.remote||v.root.style.display==='none'||!v.root.isConnected||!v.config?.canAct())return;
        v.config.onView?.({key:v.selected??v.hovered,pinned:v.selected!==null,scrollTop:v.scroll.scrollTop,
            noticeKey:v.notice,cooldowns:[...v.waits].filter(([,until])=>until>clock()).map(([key,until])=>({key,until}))});
    }
    function describe(v) {
        const c=v.config,row=v.data?.find(r=>r.key===(v.selected??v.hovered));
        v.effect.textContent=row?.description || c.hint || '';
        v.detail.hidden=!c.hint&&!row?.description;
        v.icon.hidden=!row?.icon;if(row?.icon)v.icon.src=row.icon;
        v.note.hidden=!row||!c.costNote;v.note.textContent=c.costNote||'';
        v.usage.hidden=row?.usage===undefined;if(row?.usage!==undefined)v.usage.textContent='使用コストは魔力に比例します\n現時点の使用コスト：'+format(row.usage)+'G';
        v.body.querySelectorAll('tr[data-key]').forEach(tr=>tr.toggleAttribute('data-selected',tr.dataset.key===v.selected));
    }
    function fit(v) {
        if(v.root.style.display==='none'||!v.config)return;
        v.scroll.style.setProperty('--gp-row-height',Math.max(36,Math.min(62,Math.floor((v.scroll.clientHeight-5)/10)-5))+'px');
        const gutter=v.scroll.offsetWidth-v.scroll.clientWidth;v.columns.style.marginRight=gutter+'px';
        if(['assets','sale-assets'].includes(v.config.kind)){
            const values=v.body.querySelector('tr[data-key]')?.querySelectorAll('.gp-number');
            const bounds=v.title.parentElement.getBoundingClientRect(),table=v.table.getBoundingClientRect();
            v.summary.style.height=v.config.kind==='assets'?v.title.getBoundingClientRect().height+'px':'';
            v.summary.querySelectorAll('span').forEach((group,index)=>{
                // Empty lists have no numeric cell to measure. Keep the same
                // price/yield column anchors instead of falling back to the title.
                const target=values?.[index]?.getBoundingClientRect().right
                    ?? (v.config.kind==='sale-assets'
                        ? table.left+table.width*(index===0?.76:.88)-(index===0?24:22)
                        : table.left+table.width*(index===0?.70:.92)+(index===0?56:40));
                group.style.right=(bounds.right-target)+'px';
            });
        }
    }
    function buttons(v) {
        for(const r of v.data||[]){const button=v.body.querySelector('tr[data-key="'+r.key+'"] button');if(!button)continue;
            const waiting=(v.waits.get(r.key)||0)>clock(),busy=v.busy.has(r.key);
            button.disabled=!v.config.canAct()||Boolean(r.disabled)||busy||waiting||v.fading.has(r.key);
            if(!r.useButton){button.textContent=waiting?'購入済み':busy?'購入中':r.label||'購入';
                if(!button.classList.contains('gp-wait'))button.style.setProperty('--gp-wait-delay',Math.min(0,(v.waits.get(r.key)||0)-clock()-1000)+'ms');
                button.classList.toggle('gp-wait',waiting);}
        }
        v.scroll.inert=!v.config.canAct();
        v.close.disabled=!v.config.canAct()||v.busy.size>0;v.headerAction.disabled=!v.config.canAct()||v.busy.size>0;v.root.toggleAttribute("data-readonly",!v.config.canAct());
    }
    function purchased(v,key) {
        v.notice=key;v.waits.set(key,clock()+1000);
        draw(v);publish(v);
        setTimeout(()=>{if((v.waits.get(key)||0)<=clock()){v.waits.delete(key);buttons(v);publish(v);}},1010);
    }
    function setNotice(v,name){v.noticeText=name+'\n'+(v.config.actionThanks||v.config.purchaseThanks||'お買い上げありがとう！');if(v.hello)v.hello.textContent=v.noticeText;}
    function fade(v,key,row){if(v.fading.has(key))return;v.fading.add(key);v.notice=key;const notice=row||v.data.find(entry=>entry.key===key);const config=v.config;if(notice)setNotice(v,notice.name);const liveRow=[...v.body.querySelectorAll('tr[data-key]')].find(entry=>entry.dataset.key===key);liveRow?.classList.add('gp-row-fading');buttons(v);
        setTimeout(()=>{v.fading.delete(key);if(config.fadeOnSuccess&&v.notice===key)v.notice=null;config.onFadeComplete?.(notice);if(v.root.style.display!=='none')draw(v);},1000);}
    function bind(v,tr,r) {
        tr.dataset.key=r.key;
        tr.onpointerenter=()=>{if(!v.config.canAct())return;v.hovered=r.key;describe(v);publish(v);};
        tr.onfocusin=()=>{if(!v.config.canAct())return;v.hovered=r.key;describe(v);publish(v);};
        tr.onfocusout=e=>{if(!v.scroll.contains(e.relatedTarget)){v.hovered=null;describe(v);publish(v);}};
        tr.onclick=e=>{if(!v.config.canAct()||e.target.closest('button'))return;v.selected=r.key;describe(v);publish(v);};
        tr.onkeydown=e=>{if(e.target.closest('button')||!v.config.canAct())return;if(e.key==='Enter'||e.key===' '){e.preventDefault();v.selected=r.key;describe(v);publish(v);}};
    }
    function draw(v) {
        const c=v.config,previousScroll=v.scroll.scrollTop;v.data=c.rows();v.title.textContent=c.title;
        v.cols.innerHTML=(c.widths||['56%','28%','16%']).map(width=>'<col style="width:'+width+'">').join('');
        v.columns.style.gridTemplateColumns=c.widths?.join(' ')||'';
        v.table.setAttribute('aria-label',c.title);v.body.replaceChildren();
        for(const r of v.data){const tr=node('tr');
            if(r.section){tr.className='gp-section';const cell=node('td','',r.section);cell.colSpan=c.columns?.length||3;tr.append(cell);v.body.append(tr);continue;}
            bind(v,tr,r);const name=node('td'),label=node('span','gp-name',r.name);label.tabIndex=0;name.append(label);tr.append(name);
            for(const [index,value]of (r.values||[]).entries()){const cell=node('td',r.classes?.[index]||'gp-price'),text=node('span','gp-number',value);
                const passiveStatusAtRowEnd=c.kind==='inventory'&&Number(r.group)>0&&!r.useButton&&index===(r.values.length-1);
                if(passiveStatusAtRowEnd){cell.colSpan=2;cell.classList.add('gp-status-end');}
                cell.append(text);tr.append(cell);}
            if(r.owner!==undefined){const cell=node('td','gp-owner');if(r.owner){const img=node('img');img.src=r.owner;img.alt='所有者';cell.append(img);}else cell.textContent='ー';tr.append(cell);}
            if(r.action||r.useButton){const cell=node('td','gp-action'),button=r.useButton||node('button','gp-button');button.type='button';button.classList.add('gp-button');
                if(!r.useButton)button.onclick=()=>{if(!c.canAct()||button.disabled||v.busy.has(r.key)||(v.waits.get(r.key)||0)>clock())return;
                    v.busy.add(r.key);buttons(v);
                    Promise.resolve().then(()=>r.action(button)).then(ok=>{v.busy.delete(r.key);if(ok!==false&&c.fadeOnSuccess){fade(v,r.key,r);publish(v);}else if(ok!==false&&c.feedback!==false)purchased(v,r.key);else{if(ok!==false&&c.purchaseThanks)v.notice=r.key;draw(v);publish(v);}}).catch(error=>{v.busy.delete(r.key);draw(v);console.error('[panel] 操作に失敗:',error);});};
                cell.append(button);tr.append(cell);
            }else if(c.kind==='inventory'&&!(Number(r.group)>0&&!r.useButton)){tr.append(node('td','gp-action'));}
            if(['assets','sale-assets'].includes(c.kind)&&r.leading){const lead=node('td','gp-branch',r.leading);tr.insertBefore(lead,tr.firstChild);}
            if(v.fading.has(r.key))tr.classList.add('gp-row-fading');
            v.body.append(tr);
        }
        if(!v.data.length){const tr=node('tr'),empty=node('td','gp-empty',c.empty||'所持していません。');empty.colSpan=c.widths?.length||5;tr.append(empty);v.body.append(tr);}
        v.columns.replaceChildren();v.columns.hidden=!c.columns;
        for(const label of c.columns||[])v.columns.append(node('span','',label));
        v.summary.replaceChildren();
        for(const item of c.summary?.()||[]){const group=node('span','',item.label),value=node('strong',item.yield?'gp-yield':'',item.value);group.append(value);v.summary.append(group);}
        v.summary.hidden=Boolean(c.headerAction);
        v.root.classList.toggle('gp-assets',c.kind==='assets');
        v.root.classList.toggle('gp-sale-items',c.kind==='sale-items');
        v.root.classList.toggle('gp-sale-magic',c.kind==='sale-magic');
        v.root.classList.toggle('gp-sale-assets',c.kind==='sale-assets');
        v.root.classList.toggle('gp-inventory',c.kind==='inventory');
        v.root.classList.toggle('gp-magic-list',c.kind==='magic-list');
        v.close.textContent=c.closeLabel||(c.scene?'店を出る':'閉じる');
        v.close.onclick=()=>{if(!c.canAct())return;v.anchorCleanup?.();v.root.style.display='none';c.onClose?.();};
        v.headerAction.hidden=!c.headerAction;v.headerAction.textContent=c.headerAction?.label||'';v.headerAction.onclick=()=>{if(c.canAct())c.headerAction?.onClick?.();};
        if(v.hello){const notice=v.data.find(row=>row.key===v.notice);if(notice)v.noticeText=notice.name+'\n'+(c.actionThanks||c.purchaseThanks||'お買い上げありがとう！');v.hello.textContent=v.root.classList.contains('gp-shop-no-staff')?'':v.noticeText||c.greeting||'';}
        describe(v);buttons(v);v.scroll.scrollTop=previousScroll;requestAnimationFrame(()=>fit(v));
    }
    function show(config) {
        const v=make(config.id,config.listId,config.closeId,Boolean(config.scene));
        if(v.root.style.display==='none'||v.player!==config.player){v.selected=null;v.hovered=null;v.notice=null;v.noticeText=null;v.waits.clear();v.busy.clear();v.scroll.scrollTop=0;}
        v.config=config;v.player=config.player;
        v.root.classList.toggle('gp-shop-no-staff',Boolean(config.scene&&['item-list','magic-menu','asset-purchase','sale-list'].includes(config.screenType)));
        if(config.scene){v.background.src=config.scene.backgroundImage;if(v.root.classList.contains('gp-shop-no-staff')){v.staff.removeAttribute('src');v.staff.alt='';if(v.hello)v.hello.textContent='';}else{v.staff.src=config.scene.staffImage;v.staff.alt=config.scene.name+'の店員';}
            if(config.voice&&!v.presentation)v.presentation=ShopPresentation.create(v.root,{voice:config.voice});}
        v.root.style.display='block';draw(v);anchorOwnedPanel(v);if(config.voice!==false)v.presentation?.present();return v;
    }
    function remote(screenType,data,playerIndex) {
        const v=[...views.values()].find(entry=>entry.config?.screenType===screenType&&entry.root.style.display==='block'&&entry.config.playerIndex===playerIndex);
        if(!v||!data)return false;
        v.remote=true;
        try{const valid=key=>v.data.some(r=>r.key===key)?key:null;
            v.selected=data.pinned?valid(data.key):null;v.hovered=data.pinned?null:valid(data.key);v.notice=valid(data.noticeKey);
            v.waits=new Map((data.cooldowns||[]).filter(entry=>valid(entry.key)).map(entry=>[entry.key,entry.until]));
            draw(v);v.scroll.scrollTop=data.scrollTop||0;
        }finally{v.remote=false;}
        return true;
    }
    function refresh(){for(const v of views.values())if(v.root.style.display==='block'){if(v.config.rebuild)v.config.rebuild();else draw(v);}}
    window.GamePanels=Object.freeze({show,remote,refresh,anchorFrame:id=>{const root=document.getElementById(id);return root?anchorFrame(root):null;},releaseFrame:id=>{const root=document.getElementById(id);if(root)anchorCleanups.get(root)?.();},fade:(id,key,row)=>{const v=views.get(id);if(v)fade(v,key,row);},setNotice:(id,name)=>{const v=views.get(id);if(v)setNotice(v,name);},isOpen:id=>views.get(id)?.root.style.display==='block',get:id=>views.get(id),snapshot:id=>snapshot(views.get(id))});
})();
