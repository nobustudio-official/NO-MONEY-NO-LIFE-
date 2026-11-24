/* Capital road strips use the same image renderer as the regional roads. */
(function(root){
 'use strict';
 const styles=Object.freeze({
  'capital-ivory':{name:'王都1：白石の大通り',asset:'capital-01-ivory.webp',band:[109/409,296/409],edge:'#927e58',fallback:'#dce1e1'},
  'capital-slate':{name:'王都2：青灰石の街路',asset:'capital-02-slate.webp',band:[103/341,260/341],edge:'#667b8b',fallback:'#a3b6c4'},
  'capital-brick':{name:'王都3：赤茶レンガの街路',asset:'capital-03-brick.webp',band:[110/409,303/409],edge:'#826a5a',fallback:'#c2977e'}
 });
 const assetRoot=typeof document==='undefined'?'':new URL('../images/map/roads/capital-study-v1/',document.currentScript.src).href;
 const images=new Map();let loading=null;
 async function prepare(){
  if(!loading)loading=Promise.all(Object.entries(styles).map(async([id,style])=>{
   const image=new Image();
   try{
    if(root.MapDetailLevel?.loadImage)await root.MapDetailLevel.loadImage(image,assetRoot+style.asset,2);
    else{image.src=assetRoot+style.asset;await image.decode();}
    if(image.naturalWidth)images.set(id,image);
   }catch{/* Readable fallback if a file is unavailable. */}
  }));
  await loading;
  return Object.keys(styles).filter(id=>!images.has(id));
 }
 function path(ctx,ps,dx=0,dy=0){ctx.beginPath();ctx.moveTo(ps[0].x+dx,ps[0].y+dy);for(const p of ps.slice(1))ctx.lineTo(p.x+dx,p.y+dy);}
 function drawStrip(ctx,points,image,[top,bottom]){
  const sourceTop=image.naturalHeight*top,sourceHeight=image.naturalHeight*(bottom-top);
  const height=36,tileWidth=image.naturalWidth*height/sourceHeight;
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);if(!length)continue;
   ctx.save();ctx.translate(a.x,a.y);ctx.rotate(Math.atan2(b.y-a.y,b.x-a.x));
   ctx.beginPath();ctx.rect(0,-height/2,length,height);ctx.clip();
   for(let x=0;x<length;x+=tileWidth)ctx.drawImage(image,0,sourceTop,image.naturalWidth,sourceHeight,x,-height/2,tileWidth,height);
   ctx.restore();
  }
 }
 function draw(ctx,ps,id,active=false){
  if(!styles[id]||ps.length<2)return false;
  const style=styles[id],art=images.get(id);ctx.save();ctx.lineCap='butt';ctx.lineJoin='round';
  // Upper-left light: shadows always fall down/right, regardless of route direction.
  path(ctx,ps,2,3);ctx.strokeStyle='#17334733';ctx.lineWidth=37;ctx.stroke();
  path(ctx,ps);if(active){ctx.strokeStyle='#f6d38a';ctx.lineWidth=44;ctx.stroke();}
  ctx.strokeStyle=style.edge;ctx.lineWidth=36;ctx.stroke();
  if(art)drawStrip(ctx,ps,art,style.band);
  else{path(ctx,ps);ctx.strokeStyle=style.fallback;ctx.lineWidth=28;ctx.stroke();}
  ctx.restore();return true;
 }
 const api=Object.freeze({styles,prepare,draw,drawStrip,ready:()=>[...images.keys()]});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MapCapitalRoads=api;
})(typeof window!=='undefined'?window:globalThis);
