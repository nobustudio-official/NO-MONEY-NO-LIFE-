/* Asset purchase view delegates to the shared approved shop panels. */
(function(){
 'use strict';
 function render({player,playerIndex,assets,title,canPurchase,ownerIcon,onBuy,onClose,headerAction,suppressGreeting=false}){
  GamePanels.show({id:'assetPurchasePopup',listId:'assetPurchaseList',closeId:'assetPurchaseCloseButton',kind:'asset-shop',
   player,playerIndex,screenType:'asset-purchase',title,scene:ASSET_SCENE_CONTENTS,voice:false,
   greeting:'本日はどの子をご指名ですか？',purchaseThanks:'ご指名ありがとうございます。',feedback:false,onClose,headerAction,widths:['38%','23%','13%','12%','14%'],canAct:()=>canPurchase,
   onView:panel=>window.syncOnlineScreenView?.('asset-purchase',player,'open',{panel,suppressGreeting}),
   rows:()=>assets.filter(Boolean).sort(compareAssetPurchaseOrder)
    .map(asset=>({key:'asset:'+asset.id,name:asset.name,values:[Number(asset.price).toLocaleString('ja-JP')+'G',asset.yield+'％'],classes:['gp-price','gp-yield'],
     owner:asset.owner==null?null:ownerIcon(asset.owner),disabled:asset.owner!=null||player.money<asset.price,
     label:asset.owner!=null?(Number(asset.owner)===playerIndex?'所有済み':'売却済み'):player.money<asset.price?'資金不足':'購入',
     action:button=>onBuy(asset.id,button)}))});
 }
 window.AssetShopUI=Object.freeze({render,close:()=>GamePanels.get('assetPurchasePopup')?.presentation?.close()});
})();
