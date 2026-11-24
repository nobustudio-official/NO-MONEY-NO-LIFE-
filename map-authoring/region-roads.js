/* Rotatable, image-based road materials for the map workshop. */
(function(root){
 'use strict';
 const styles=Object.freeze({
  'grassland-road':{name:'草原：敷石の街道',asset:'grassland-road.webp',band:[163/512,351/512],edge:'#70583b'},
  'forest-road':{name:'森林：苔むした山道',asset:'forest-road.webp',band:[168/512,344/512],edge:'#413329'},
  'desert-road':{name:'砂漠：砂岩の道',asset:'desert-road.webp',band:[154/512,357/512],edge:'#785039'},
  'snow-road':{name:'雪山：氷雪の道',asset:'snow-road.webp',band:[165/512,358/512],edge:'#596a7c'},
  'ruins-road':{name:'古代遺跡：風化した石畳',asset:'ruins-road.webp',band:[107/409,298/409],edge:'#5e594f'},
  'volcano-road':{name:'火山：黒曜石の道',asset:'volcano-road.webp',band:[107/409,299/409],edge:'#262328'},
  'lake-road':{name:'湖：木の遊歩道',asset:'lake-road.webp',band:[108/409,298/409],edge:'#57402d'}
 });
 const assetRoot=typeof document==='undefined'?'':new URL('../images/map/roads/region-study-v1/',document.currentScript.src).href;
 const materials=new Map();let loading=null;
 async function prepare(){
  if(!loading)loading=Promise.all(Object.entries(styles).map(async([id,style])=>{
   const image=new Image();
   try{
    if(root.MapDetailLevel?.loadImage)await root.MapDetailLevel.loadImage(image,assetRoot+style.asset,2);
    else{image.src=assetRoot+style.asset;await image.decode();}
    if(image.naturalWidth)materials.set(id,image);
   }catch{/* A color fallback keeps the road editable if an image is unavailable. */}
  }));
  await loading;return Object.keys(styles).filter(id=>!materials.has(id));
 }
 function path(ctx,points,dx=0,dy=0){ctx.beginPath();ctx.moveTo(points[0].x+dx,points[0].y+dy);for(const point of points.slice(1))ctx.lineTo(point.x+dx,point.y+dy);}
 function draw(ctx,points,id,active=false){
  const style=styles[id],material=materials.get(id);if(!style||!points||points.length<2)return false;
  ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
  path(ctx,points,2,3);ctx.strokeStyle='#17334733';ctx.lineWidth=40;ctx.stroke();
  if(active){path(ctx,points);ctx.strokeStyle='#f6d38a';ctx.lineWidth=44;ctx.stroke();}
  path(ctx,points);ctx.strokeStyle=material?style.edge:'#695b49';ctx.lineWidth=36;ctx.stroke();
  if(material)MapCapitalRoads.drawStrip(ctx,points,material,style.band);
  else{
   path(ctx,points);ctx.strokeStyle=({ 'grassland-road':'#c49c63','forest-road':'#684a34','desert-road':'#dda45c','snow-road':'#b8cde3','ruins-road':'#aaa08d','volcano-road':'#39363a','lake-road':'#a97849' })[id];ctx.lineWidth=28;ctx.stroke();
  }
  ctx.restore();return true;
 }
 const api=Object.freeze({styles,prepare,draw,ready:()=>[...materials.keys()]});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MapRegionRoads=api;
})(typeof window!=='undefined'?window:globalThis);
