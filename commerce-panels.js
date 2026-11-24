/* Game adapter for shared panels. Existing item-use handlers are retained. */
(function () {
    'use strict';
    let runtime;
    const pendingSales=new Map();let saleActionBusy=false;
    const f=n=>Number(n).toLocaleString('ja-JP');
    function context(player,screenType) {
        return {player,playerIndex:runtime.players().indexOf(player),screenType,canAct:()=>runtime.canAct(player),
            onView:panel=>runtime.sync(screenType,player,'open',{panel})};
    }
    function close(player,id,finish) {
        document.getElementById(id).style.display='none';
        runtime.sync('',player,'close');if(finish)runtime.finish(player);
    }
    function summary(player) {
        const holdings=calculateAssetHoldings(player);
        return [{label:'保有資産額',value:f(holdings.value)+'G'},
            {label:'平均利回り',value:holdings.weightedAverageYield===null?'ー':holdings.weightedAverageYield.toFixed(1)+'％',yield:true}];
    }
    function showAssets(player) {
        const id='assetPopup';
        const branchByAsset=new Map();Object.entries(ASSET_BOXES||{}).forEach(([branchId,branch])=>(branch.contents||[]).forEach(assetId=>branchByAsset.set(Number(assetId),{id:Number(branchId),name:branch.name})));
        GamePanels.show({...context(player,'asset-list'),id,listId:'assetList',closeId:'assetCloseButton',kind:'assets',title:'資産一覧',
            empty:'資産はありません。',summary:()=>summary(player),columns:['支店名','資産名','価格','利回り'],widths:['21%','32%','23%','24%'],rows:()=> {
                const owners=Object.fromEntries(Object.entries(ASSET_CONTENTS).map(([assetId,asset])=>[assetId,asset.owner]));
                const monopolized=window.AssetMonopolyRules?.monopolizedAssetIds(ASSET_BOXES,owners,runtime.players().indexOf(player))||new Set();
                const assets=(player.assets||[]).map(assetId=>{const id=Number(assetId),asset=ASSET_CONTENTS[id],branch=branchByAsset.get(id);return asset?{id,...asset,branchId:branch?.id||999,branchName:(branch?.name||'支店未分類')+'支店',displayYield:Number(asset.yield||0)*(monopolized.has(id)?2:1)}:null;}).filter(a=>a?.name)
                    .sort((a,b)=>a.branchId-b.branchId||Number(a.name==='モブ')-Number(b.name==='モブ')||a.price-b.price||b.displayYield-a.displayYield);
                const rows=[];let previousBranch=null;for(const asset of assets){if(asset.branchId!==previousBranch){rows.push({section:asset.branchName});previousBranch=asset.branchId;}
                    rows.push({key:'asset:'+asset.id,name:asset.name,leading:asset.branchName,values:[f(marketPrice(asset.price))+'G',asset.displayYield+'％'],classes:['gp-price','gp-yield']});}
                return rows;
            },
            onClose:()=>close(player,id,false)});
        runtime.sync('asset-list',player,'open',{panel:GamePanels.snapshot(id)});
    }
    function showMagic(player) {
        const id='magicPopup';
        GamePanels.show({...context(player,'magic-status'),id,listId:'magicList',closeId:'magicCloseButton',kind:'magic-list',title:'魔法一覧',
            columns:['魔法名','使用コスト'],widths:['76%','24%'],costNote:'使用コストは魔力値に応じて増加します',
            hint:'選択すると、魔法の説明文が表示されます',empty:'魔法はありません。',
            rows:()=> (player.magic||[]).slice().sort((a,b)=>Number(a)-Number(b)).map(id=>({id,...MAGIC_CONTENTS[id]})).filter(m=>m.name)
                .map(m=>({key:'magic:'+m.id,name:m.name,values:[f(calculateMagicCost(player,m,{magicPowerRate:1}))+'G'],description:m.effect,icon:m.icon})),
            onClose:()=>close(player,id,false)});
        runtime.sync('magic-status',player,'open',{panel:GamePanels.snapshot(id)});
    }
    function showSales(player,category,returnToShop,remote=false){
        const id='salePopup',playerIndex=runtime.players().indexOf(player),screenType='sale-list';
        const expectedSquareType=category==='item'?'shop':category==='magic'?'magic_shop':'asset';
        const canSell=()=>!remote&&!saleActionBusy&&runtime.canAct(player)&&mapData.some(square=>Number(square.id)===Number(player.position)&&square.type===expectedSquareType);
        const scene=category==='item'?SHOP_SCENE_CONTENTS:category==='magic'?MAGIC_SHOP_SCENE_CONTENTS:ASSET_SCENE_CONTENTS;
        const shopPopup=category==='item'?'shopPopup':category==='magic'?'magicShopPopup':'assetPurchasePopup';
        const branchByAsset=new Map();Object.entries(ASSET_BOXES||{}).forEach(([branchId,branch])=>(branch.contents||[]).forEach(assetId=>branchByAsset.set(Number(assetId),{id:Number(branchId),name:branch.name})));
        const priceOf=entry=>marketPrice(entry.price);
        const pendingKey=key=>playerIndex+':'+key;
        const opening = remote ? null : runtime.sync(screenType,player,'open',{category});
        const rowList=()=>{
            const result=[];
            if(category==='item'){
                const fading = [...pendingSales.values()].find(row=>row.kind==='item'&&row.playerIndex===playerIndex);
                const removed = fading && player.inventory.length < fading.inventoryLength;
                (player.inventory||[]).forEach((entry,index)=>{const itemId=Number(getInventoryItemId(entry)),item=ITEM_CONTENTS[itemId];if(!item)return;
                    const key='inventory:'+(removed&&index>=fading.index?index+1:index),pending=pendingSales.get(pendingKey(key));
                    const sellable = canSellItem(item);
                    result.push(pending||{key,name:item.name||item.effect,price:sellable?priceOf(item):0,sellable,description:item.effect,id:itemId,index,kind:'item'});
                });
                if(removed)result.splice(fading.index,0,fading);
            }else if(category==='magic'){
                (player.magic||[]).forEach(id=>{const spellId=Number(id),spell=MAGIC_CONTENTS[spellId];if(!spell)return;
                    const key='magic:'+spellId,pending=pendingSales.get(pendingKey(key));
                    result.push(pending||{key,name:spell.name,price:priceOf(spell),description:spell.effect,id:spellId,kind:'magic'});
                });
            }else{
                const monopolized=window.AssetMonopolyRules?.monopolizedAssetIds(ASSET_BOXES,Object.fromEntries(Object.entries(ASSET_CONTENTS).map(([assetId,asset])=>[assetId,asset.owner])),playerIndex)||new Set();
                (player.assets||[]).map(Number).sort((a,b)=>(branchByAsset.get(a)?.id||999)-(branchByAsset.get(b)?.id||999)||a-b).forEach(assetId=>{
                    const asset=ASSET_CONTENTS[assetId];if(!asset)return;const key='asset:'+assetId,pending=pendingSales.get(pendingKey(key));
                    const branch=branchByAsset.get(assetId);
                    result.push(pending||{key,name:asset.name,price:priceOf(asset),yield:Number(asset.yield||0)*(monopolized.has(assetId)?2:1),leading:branch?.name||'未分類',branchId:branch?.id||999,id:assetId,kind:'asset'});
                });
            }
            for(const [key,row]of pendingSales)if(key.startsWith(playerIndex+':')&&row.kind===category&&!result.some(item=>item.key===row.key))result.push(row);
            if(category==='asset'){
                return result.sort((a,b)=>(a.branchId||999)-(b.branchId||999)||a.id-b.id);
            }
            return result;
        };
        const openReturn=()=>{window.syncOnlineScreenView?.('',player,'close');if(returnToShop)returnToShop();};
        GamePanels.show({id,listId:'saleList',closeId:'saleCloseButton',kind:category==='asset'?'sale-assets':category==='magic'?'sale-magic':'sale-items',player,playerIndex,
            screenType,saleCategory:category,scene,voice:false,title:category==='item'?'アイテム売却':category==='magic'?'魔法売却':'資産売却',
            summary:category==='asset'?()=>summary(player):undefined,
            columns:category==='asset'?['支店名','資産名','売却額','利回り']:['売却対象','売却額'],
            widths:category==='asset'?['21%','32%','23%','12%','12%']:['56%','28%','16%'],
            closeLabel:'戻る',actionThanks:'を売却しました。',fadeOnSuccess:true,feedback:false,canAct:canSell,
            hint:category==='asset'?'':'選択すると、売却対象の説明が表示されます。',
            onView:panel=>runtime.sync(screenType,player,'open',{category,panel}),onClose:openReturn,
            rows:()=>rowList().map(row=>row.section?row:{key:row.key,name:row.name,leading:row.leading,description:category==='asset'?'':row.description,
                values:category==='asset'?[f(row.price)+'G',row.yield+'％']:[f(row.price)+'G'],classes:category==='asset'?['gp-price','gp-yield']:['gp-price'],label:row.sellable===false?'売却不可':'売却',
                disabled:row.sellable===false||pendingSales.has(pendingKey(row.key)),action:async()=>{
                    if(saleActionBusy||row.sellable===false)return false;
                    saleActionBusy=true;
                    const pending=pendingKey(row.key);
                    let sold=false;
                    try{
                        const sync=window.onlineGame?.isOnline?window.onlineGame.sync:null;
                        const opened=await opening;
                        if(opened?.ok===false)throw new Error(opened.error);
                        const fading={...row,playerIndex,inventoryLength:player.inventory?.length};
                        pendingSales.set(pending,fading);
                        if(sync){
                            const response=await sync.requestSale(category,row.id,row.index,runtime.saleId());
                            if(!response?.ok||!response.state)throw new Error(response?.error||'売却を確認できませんでした。');
                            fading.price=response.price;
                            runtime.apply(response.state,'sale');
                        }else if(category==='item'){
                            const entry=player.inventory?.[row.index];if(entry==null||Number(getInventoryItemId(entry))!==row.id)return false;
                            player.inventory.splice(row.index,1);
                        }else if(category==='magic'){
                            const index=(player.magic||[]).findIndex(id=>Number(id)===row.id);if(index<0)return false;
                            player.magic.splice(index,1);
                        }else{
                            const index=(player.assets||[]).findIndex(id=>Number(id)===row.id);if(index<0||ASSET_CONTENTS[row.id]?.owner==null||Number(ASSET_CONTENTS[row.id].owner)!==playerIndex)return false;
                            player.assets.splice(index,1);ASSET_CONTENTS[row.id].owner=null;
                        }
                        if(!sync)player.money=Number(player.money)+row.price;
                        sold=true;
                        runtime.checkpoint?.(category === 'asset' ? 'asset-store' : 'store', category === 'asset'
                            ? { assetIds: (mapData.find(s => Number(s.id) === Number(player.position))?.typeIds || []).flatMap(id => ASSET_BOXES[id]?.contents || []) }
                            : { kind: category === 'magic' ? 'magic' : 'item' });
                        window.GameSE?.play('moneyDisplay',{shared:true}).catch(()=>{});runtime.update(player);runtime.render();GamePanels.refresh();return true;
                    }catch(error){runtime.event('売却できません',error.message,()=>{});return false;}
                    finally{if(!sold){pendingSales.delete(pending);saleActionBusy=false;}}
                }}),
            onFadeComplete:row=>{if(row)pendingSales.delete(pendingKey(row.key));if(!remote)saleActionBusy=false;}
        });
        if(!remote){const current=GamePanels.get(shopPopup);if(current){current.presentation?.close();current.root.style.display='none';}runtime.sync(screenType,player,'open',{category,panel:GamePanels.snapshot(id)});}
    }
    function prepareRemoteSale(data){
        const view=GamePanels.get('salePopup');
        if(!data||view?.root.style.display!=='block'||view.config.playerIndex!==Number(data.playerIndex)||view.config.saleCategory!==data.category)return;
        const player=runtime.players()[Number(data.playerIndex)],id=Number(data.contentId);if(!player)return;
        const key=data.category==='item'?'inventory:'+Number(data.inventoryIndex):data.category==='magic'?'magic:'+id:'asset:'+id;
        let row;
        if(data.category==='item'){const item=ITEM_CONTENTS[id];if(!item)return;row={key,name:item.name||item.effect,price:Number(data.price)||0,description:item.effect,id,index:Number(data.inventoryIndex),kind:'item',playerIndex:Number(data.playerIndex),inventoryLength:player.inventory.length};}
        else if(data.category==='magic'){const spell=MAGIC_CONTENTS[id];if(!spell)return;row={key,name:spell.name,price:Number(data.price)||0,description:spell.effect,id,kind:'magic'};}
        else{const asset=ASSET_CONTENTS[id];if(!asset)return;const [branchId,branch]=Object.entries(ASSET_BOXES||{}).find(([,entry])=>(entry.contents||[]).some(assetId=>Number(assetId)===id))||[];row={key,name:asset.name,price:Number(data.price)||0,yield:Number(asset.yield)||0,leading:branch?.name||'未分類',branchId:Number(branchId)||999,id,kind:'asset'};}
        if(data.restoreNotice){GamePanels.setNotice('salePopup',row.name);return;}
        pendingSales.set(Number(data.playerIndex)+':'+key,row);GamePanels.fade('salePopup',key,row);
    }
    function upgradeInventory(player) {
        const id='inventoryPopup',list=document.getElementById('inventoryList');
        const originals=[...list.querySelectorAll('.inventory-item')].map(el=>({index:Number(el.dataset.inventoryIndex),button:el.querySelector("button")}));
        const config={...context(player,'inventory'),id,listId:'inventoryList',closeId:'inventoryCloseButton',kind:'inventory',title:'アイテム一覧',
            empty:'アイテムはありません。',hint:'選択すると、アイテムの説明文が表示されます',
            summary:()=>{
                const remaining=Math.max(0,Number(player.itemSealChecks)||0)+(player.itemSealedThisTurn?1:0);
                return remaining>0?[{label:'',value:`あと${remaining}ターン使用不可`,seal:true}]:[];
            },
            rebuild:()=>runtime.inventory(player),onClose:()=>close(player,id,false),
            rows:()=>{
                const rows=originals.map(({index,button})=>{
                    const entry=player.inventory[index],itemId=getInventoryItemId(entry),item=ITEM_CONTENTS[itemId];
                    if(!item)return null;
                    const passive=item.category==='passive',timed=passive&&item.effectDuration?.endsWith('turn');
                    const remaining=timed?Math.max(0,Number(entry?.remainingUses??item.effectDuration.replace('turn',''))):null;
                    if(button)button.className='gp-button';
                    const transferUnavailable=Number(itemId)===19&&window.MoneyTransferUI&&!runtime.players().some(other=>other!==player&&(MoneyTransferUI.limit(player)>0||MoneyTransferUI.limit(other)>0));
                    if(button&&transferUnavailable)button.title='送金・強奪できる相手がいません';
                    return {key:'inventory:'+index,name:item.name,description:item.effect,id:Number(itemId),group:passive?timed?2:1:0,remaining,disabled:transferUnavailable || (!passive && Boolean(player.itemSealedThisTurn)) || (Number(itemId)===27&&Boolean(window.bridgeCollapseState)) || (window.GuidebookRules?.isBook(entry) && Boolean(player.underground)),
                        values:[passive?timed?'残り '+remaining+'ターン':'所持で効果発動':''],classes:['gp-status'],useButton:button};
                }).filter(Boolean).sort((a,b)=>a.group-b.group||(a.group===2?b.remaining-a.remaining:0)||a.id-b.id);
                if(player.underground?.memo){
                    rows.push({key:'inventory:underground-memo',name:'メモ帳',
                        description:'これまでの班長の出目が記されている。出目が12以上しかない…',
                        values:['地下限定'],classes:['gp-status']});
                }
                return rows;
            }};
        GamePanels.show(config);
    }
    async function purchase(player,category,id) {
        if(!runtime.canAct(player))return false;
        const catalog=category==='item'?ITEM_CONTENTS:category==='power'?POWER_CONTENTS:MAGIC_CONTENTS,product=catalog[id];
        if(!product||(category==='item'&&Number(product.rank)>=99)||(category==='magic'&&(player.magic||[]).includes(id)))return false;
        const price=category==='power'?product.price:marketPrice(product.price);
        if(player.money<price)return false;
        try {
            if(window.onlineGame?.isOnline){
                const response=await window.onlineGame.sync.requestShopPurchase(category,id);
                if(!response?.ok||!response.state){runtime.event('購入できません',response?.error||'サーバーで購入を確認できませんでした。',()=>{});return false;}
                runtime.apply(response.state,'shop-purchase');
            }else{
                player.money-=price;
                if(category==='item')addItem(player,id,runtime.turn());
                else if(category==='power')player.magicPower=(Number(player.magicPower)||0)+Number(product.effect.replace('魔力＋',''));
                else{if(!Array.isArray(player.magic))player.magic=[];player.magic.push(id);}
            }
            if(category==='item')window.GameSE?.play?.('itemObtain',{shared:true})?.catch(()=>{});
            else if(category==='power'||category==='magic')window.GameSE?.play?.('magicPowerUp',{shared:true}).catch(()=>{});
            runtime.update(player);runtime.render();runtime.checkpoint?.('store', {kind:category==='item'?'item':'magic'});return true;
        }catch(error){console.error('[shop] 購入に失敗:',error);runtime.event('通信エラー','購入結果を確認できませんでした。',()=>{});return false;}
    }
    function showStore(player,kind,suppressGreeting=false) {
        const magic=kind==='magic',id=magic?'magicShopPopup':'shopPopup',type=magic?'magic-menu':'item-list';
        const square=mapData.find(s=>Number(s.id)===Number(player.position)),box=SHOP_BOXES[square?.typeId];if(!box)return;
        const scene=magic?MAGIC_SHOP_SCENE_CONTENTS:SHOP_SCENE_CONTENTS;
        const publish = panel => runtime.sync(type,player,'open',{panel,suppressGreeting});
        GamePanels.show({...context(player,type),onView:publish,id,listId:magic?'magicShopList':'shopItemList',closeId:magic?'magicShopCloseButton':'shopCloseButton',
            kind:'shop',title:scene.name,scene,greeting:scene.dialogue(player.name)[1].text,
            headerAction:{label:'売却',onClick:()=>showSales(player,magic?'magic':'item',()=>showStore(player,kind,true))},
            voice:suppressGreeting?false:scene.voice,
            hint:'選択すると、'+(magic?'魔力・魔法':'アイテム')+'の説明文が表示されます',
            rows:()=>{
                const result=[];
                for(const [category,ids]of magic?[['power',box.powerContents],['magic',box.magicContents]]:[['item',box.itemContents]]){
                    const catalog=category==='power'?POWER_CONTENTS:category==='magic'?MAGIC_CONTENTS:ITEM_CONTENTS;
                    const contents=(ids||[]).filter(contentId=>category!=='item'||Number(catalog[contentId]?.rank)<99).slice().sort((a,b)=>catalog[a].price-catalog[b].price);
                    if(category==='magic'&&result.length&&contents.length)result.push({divider:true});
                    for(const contentId of contents){
                        const product=catalog[contentId],known=category==='magic'&&(player.magic||[]).some(id=>Number(id)===Number(contentId));
                        const price=category==='power'?product.price:marketPrice(product.price);
                        result.push({key:category+':'+contentId,name:product.name||product.effect,values:[f(price)+'G'],disabled:known||player.money<price,
                            label:known?'習得済み':player.money<price?'資金不足':'購入',
                            description:product.effect+(category==='power'?'。現在の魔力：'+f(player.magicPower):''),
                            icon:category==='power'?'images/ui/icons/interface/mana.webp':category==='magic'?product.icon:null,
                            usage:category==='magic'?calculateMagicCost(player,product,{magicPowerRate:1}):undefined,
                            action:()=>purchase(player,category,Number(contentId))});
                    }
                }
                return result;
            },onClose:()=>close(player,id,true)});
        publish(GamePanels.snapshot(id));
        runtime.checkpoint?.('store', {kind});
    }
    window.ApprovedCommerce=Object.freeze({configure:options=>{runtime=options;},canAct:player=>runtime.canAct(player),showStore,showAssets,showMagic,showSales,prepareRemoteSale,upgradeInventory});
})();
