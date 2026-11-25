/* Flatten static scenery once; zoom reuses small bitmap tiles instead of SVG masks. */
(function(){
 'use strict';
 const tileSize=2048;
 const windows=new WeakMap();
 function dataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
 function decode(url){return window.MapDetailLevel.loadImage(new Image(),url,0);}
 function blob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Background tile failed')),'image/webp',.92));}
 async function bake(background,svg){
  background.dataset.rasterState='preparing';
  const urls=[];
  try{
   const source=svg.cloneNode(true);source.setAttribute('xmlns','http://www.w3.org/2000/svg');
   source.setAttribute('width',MapScene.config.width);source.setAttribute('height',MapScene.config.height);
   const images=[...source.querySelectorAll('image[href]')];
   const unique=[...new Set(images.map(image=>image.getAttribute('href')))];
   const embedded=new Map(await Promise.all(unique.map(async url=>{
    const response=await fetch(url);if(!response.ok)throw new Error('Background asset unavailable');
    return [url,await dataUrl(await response.blob())];
   })));
   images.forEach(image=>image.setAttribute('href',embedded.get(image.getAttribute('href'))));
   const svgUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(source)],{type:'image/svg+xml'}));
   urls.push(svgUrl);
   const picture=await decode(svgUrl),coast=MapContinentData.coast;
   const left=Math.max(0,Math.floor(Math.min(...coast.map(p=>p.x))-64));
   const top=Math.max(0,Math.floor(Math.min(...coast.map(p=>p.y))-64));
   const right=Math.min(MapScene.config.width,Math.ceil(Math.max(...coast.map(p=>p.x))+64));
   const bottom=Math.min(MapScene.config.height,Math.ceil(Math.max(...coast.map(p=>p.y))+64));
   const canvas=document.createElement('canvas');canvas.width=right-left;canvas.height=bottom-top;
   canvas.getContext('2d').drawImage(picture,-left,-top);
   const fragment=document.createDocumentFragment(),tiles=[];
   for(let y=0;y<canvas.height;y+=tileSize)for(let x=0;x<canvas.width;x+=tileSize){
    const tile=document.createElement('canvas');tile.width=Math.min(tileSize,canvas.width-x);tile.height=Math.min(tileSize,canvas.height-y);
    tile.getContext('2d').drawImage(canvas,x,y,tile.width,tile.height,0,0,tile.width,tile.height);
    const url=URL.createObjectURL(await blob(tile));urls.push(url);
    const image=await decode(url);image.className='map-background-raster';image.alt='';image.draggable=false;
    Object.assign(image.style,{position:'absolute',left:left+x+'px',top:top+y+'px',width:tile.width+'px',height:tile.height+'px',maxWidth:'none',pointerEvents:'none'});
    fragment.append(image);tiles.push(image);tile.width=tile.height=0;
   }
   canvas.width=canvas.height=0;
   if(!background.isConnected){urls.forEach(url=>URL.revokeObjectURL(url));return;}
   background.append(fragment);svg.style.display='none';
   URL.revokeObjectURL(svgUrl);background.dataset.rasterState='ready';
   // Keep object URLs for the lifetime of this board; revoke them when replaced.
   const observer=new MutationObserver(()=>{if(!background.isConnected){urls.forEach(url=>URL.revokeObjectURL(url));observer.disconnect();}});
   observer.observe(document.body,{childList:true,subtree:true});
  }catch(error){urls.forEach(url=>URL.revokeObjectURL(url));background.dataset.rasterState='fallback';console.warn('[map] 背景の高速表示を準備できません。通常表示を継続します。',error);}
 }
 async function prepare(background,svg){
  window.MapOverviewCache?.prepare(background);
  const data=window.MapBackgroundRasterData;
  if(!data?.tiles?.length){background.dataset.rasterState='fallback';return;}
  const board=background.closest('#mapBoard');
  if(board&&window.MapDetailLevel?.touchDevice){
   const tiles=data.tiles.map(tile=>{
    const element=createTile(tile,new Image());
    element.addEventListener('load',()=>MapDetailLevel.scheduleViewport(board));
    return {...tile,element};
   });
   background.append(...tiles.map(tile=>tile.element));
   windows.set(board,{tiles,svg,background});
   background.dataset.rasterState='ready';
   MapDetailLevel.setZoom(board,getMapZoomUI());
   return;
  }
  background.dataset.rasterState='preparing';
  try{
   const images=await Promise.all(data.tiles.map(async tile=>createTile(tile,await decode(tile.image))));
   if(!background.isConnected)return;
   background.append(...images);svg.style.display='none';background.dataset.rasterState='ready';
   if(board)window.MapOverviewCache?.setZoom(board,getMapZoomUI());
  }catch(error){background.dataset.rasterState='fallback';console.warn('[map] 高速背景を読み込めません。通常表示を継続します。',error);}
 }
 function createTile(tile,image){
  image.className='map-background-raster';image.alt='';image.draggable=false;
  Object.assign(image.style,{position:'absolute',left:tile.x+'px',top:tile.y+'px',width:tile.width+'px',height:tile.height+'px',maxWidth:'none',pointerEvents:'none'});
  return image;
 }
 function setViewport(board,bounds,visible){
  const state=windows.get(board);
  if(!state)return;
  const overview=board.classList.contains('map-overview-active');
  const lowDetail=window.MapDetailLevel?.isLowDetail(board);
  // Below the mobile detail threshold, never request native-resolution tiles.
  if(lowDetail){
   MapDetailLevel.setTileSources(state.tiles,null,visible);
   if(state.svg.style.display!=='none')state.svg.style.display='none';
   if(state.background.classList.contains('map-background-tiles-pending'))state.background.classList.remove('map-background-tiles-pending');
   return;
  }
  const ready=MapDetailLevel.setTileSources(state.tiles,overview?null:bounds,visible);
  const display=ready?'none':'';
  if(state.svg.style.display!==display)state.svg.style.display=display;
  if(state.background.classList.contains('map-background-tiles-pending')!==!ready)state.background.classList.toggle('map-background-tiles-pending',!ready);
 }
 function releaseDetail(board){
  const state=windows.get(board);
  if(!state)return;
  MapDetailLevel.setTileSources(state.tiles,null,null);
  const lowDetail=window.MapDetailLevel?.isLowDetail(board);
  state.svg.style.display=lowDetail?'none':'';
  state.background.classList.remove('map-background-tiles-pending');
 }
 function showFallback(board){
  const state=windows.get(board);
  if(!state||window.MapDetailLevel.isLowDetail(board))return;
  // The mobile fallback is one existing overview image, not the original SVG scenery.
  if(state.svg.children.length!==1||state.svg.children[0].tagName.toLowerCase()!=='image')return;
  if(state.svg.style.display)state.svg.style.display='';
 }
 window.MapBackgroundCache=Object.freeze({prepare,bake,setViewport,releaseDetail,showFallback});
})();
