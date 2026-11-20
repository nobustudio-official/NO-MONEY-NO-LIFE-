/* One stone and one timber design, with separate ground-plane orientations. */
(function(root){
 'use strict';
 const styles=Object.freeze({
  'bridge-stone':{name:'石橋',file:'stone',color:'#ad9b85',horizontal:{crop:[39,122,2097,497],deckY:320},vertical:{version:2,crop:[245,31,535,1479],deckX:512,deckWidth:320,deckStart:125,deckEnd:1300}},
  'bridge-wood':{name:'木橋',file:'wood',color:'#ab794e',horizontal:{crop:[23,75,2130,564],deckY:310},vertical:{version:2,crop:[260,30,504,1461],deckX:512,deckWidth:330,deckStart:125,deckEnd:1285}}
 });
 const assetRoot=typeof document==='undefined'?'':new URL('../images/map/roads/bridge-study-v1/',document.currentScript.src).href;
 const images=new Map();let loading=null;
 // Crop and deck measurements were taken on the original artwork.
 const sourceSize={horizontal:[2172,724],vertical:[1024,1536]};
 const isBridge=id=>id==='bridge'||Boolean(styles[id]);
 const resolve=id=>id==='bridge'?'bridge-stone':id;
 async function prepare(){
  if(!loading)loading=Promise.all(Object.entries(styles).flatMap(([id,style])=>['horizontal','vertical'].map(async direction=>{
   const image=new Image();const source=assetRoot+style.file+'-bridge-'+direction+'-v'+(style[direction].version??1)+'.webp';
   try{
    if(root.MapDetailLevel?.touchDevice)await root.MapDetailLevel.loadImage(image,source,2);
    else{image.src=source;await image.decode();}
    if(image.naturalWidth)images.set(id+':'+direction,image);
   }catch{/* Draw a visible fallback and report missing assets. */}
  })));
  await loading;return 4-images.size;
 }
 function draw(ctx,points,id,active=false){
  id=resolve(id);const style=styles[id];if(!style||points.length<2)return false;
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  for(let i=1;i<points.length;i++){
   const p=points[i-1],q=points[i],horizontal=Math.abs(q.x-p.x)>=Math.abs(q.y-p.y);
   const a=horizontal?(p.x<=q.x?p:q):(p.y<=q.y?p:q),b=a===p?q:p;
   const length=horizontal?b.x-a.x:b.y-a.y;if(length<=0)continue;
   const direction=horizontal?'horizontal':'vertical',image=images.get(id+':'+direction);
   if(active){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle='#f6d38a';ctx.lineWidth=50;ctx.stroke();}
   if(!image){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=style.color;ctx.lineWidth=36;ctx.stroke();continue;}
   const [sx,sy,sw,sh]=style[direction].crop;
   const [originalWidth,originalHeight]=sourceSize[direction];
   const rx=image.naturalWidth/originalWidth,ry=image.naturalHeight/originalHeight;
   const crop=[sx*rx,sy*ry,sw*rx,sh*ry];
   // Keep deck centres on the road. Undersides extend down, not into the route.
   if(horizontal){const scale=36/225;ctx.drawImage(image,...crop,a.x,a.y+(sy-style.horizontal.deckY)*scale,length,sh*scale);}
   else{const v=style.vertical,crossScale=36/v.deckWidth,alongScale=length/(v.deckEnd-v.deckStart);ctx.drawImage(image,...crop,a.x+(sx-v.deckX)*crossScale,a.y+(sy-v.deckStart)*alongScale,sw*crossScale,sh*alongScale);}
  }
  ctx.restore();return true;
 }
 const api=Object.freeze({styles,isBridge,prepare,draw,ready:()=>[...images.keys()]});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MapBridgeRoads=api;
})(typeof window!=='undefined'?window:globalThis);
