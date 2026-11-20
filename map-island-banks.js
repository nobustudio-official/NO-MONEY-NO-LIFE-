/* Raised islands: dedicated side materials follow the same outline as the land. */
(function(){
 'use strict';
 const data=window.MapRegionData,materials=window.MapCliffMaterials;
 const ns='http://www.w3.org/2000/svg',depth=26,channelWidth=36,repeatWidth=360;
 const regions={
  ruins:{material:'ruins',base:'#8d805e',lip:'#ddc795'},
  town:{material:'city',base:'#8c8270',lip:'#d6c6a2'},
  capital:{material:'city',base:'#77828b',lip:'#bacbd1'},
  grassland:{material:'soil',base:'#815e3d',lip:'#91b749'},
  forest:{material:'soil',base:'#694f36',lip:'#68873e'},
  desert:{material:'sandstone',base:'#b17b42',lip:'#ead29a'},
  snow:{material:'snow',base:'#727e8b',lip:'#e4edf2'},
  volcano:{material:'basalt',base:'#555160',lip:'#8b838c'}
 };
 function add(parent,name,attrs){const el=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);parent.append(el);return el;}
 function sample(defs,path){
  const geometry=add(defs,'path',{d:path}),length=geometry.getTotalLength(),count=Math.ceil(length/16);
  return Array.from({length:count+1},(_,i)=>{
   const distance=length*i/count,p=geometry.getPointAtLength(distance);
   const a=geometry.getPointAtLength(Math.max(0,distance-1)),b=geometry.getPointAtLength(Math.min(length,distance+1));
   const size=Math.hypot(b.x-a.x,b.y-a.y)||1;
   return {x:p.x,y:p.y,nx:-(b.y-a.y)/size,ny:(b.x-a.x)/size};
  });
 }
 function lakePath(){
  const lake=data.lake,angle=lake.rotation*Math.PI/180;
  return Array.from({length:181},(_,i)=>{
   const t=i/180*Math.PI*2,x=Math.cos(t)*lake.radiusX,y=Math.sin(t)*lake.radiusY;
   return `${i?'L':'M'}${lake.x+x*Math.cos(angle)-y*Math.sin(angle)},${lake.y+x*Math.sin(angle)+y*Math.cos(angle)}`;
  }).join(' ')+' Z';
 }
 function definitions(defs){
  for(const [id,material]of Object.entries(materials)){
   const pattern=add(defs,'pattern',{id:`map-cliff-${id}`,patternUnits:'userSpaceOnUse',width:repeatWidth,height:depth});
   const crop=add(pattern,'svg',{width:repeatWidth,height:depth,viewBox:material.crop,preserveAspectRatio:'none',overflow:'hidden'});
   add(crop,'image',{href:material.image,width:material.width,height:material.height});
  }
  const shade=add(defs,'linearGradient',{id:'map-cliff-shade',x1:0,y1:0,x2:0,y2:1});
  for(const [offset,color,opacity]of [[0,'#fff0b0',.08],[.3,'#584326',0],[1,'#243b3b',.32]])add(shade,'stop',{offset,'stop-color':color,'stop-opacity':opacity});
  const filter=add(defs,'filter',{id:'map-island-cast-shadow',x:'-10%',y:'-10%',width:'120%',height:'120%'});
  add(filter,'feGaussianBlur',{stdDeviation:3});
 }
 function drawFaces(parent,points,style){
  const faces=add(parent,'g',{class:'map-cliff-faces'});let along=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y),start=along;along+=length;
   if(!a.visible||!b.visible||length<.001)continue;
   const dx=(b.x-a.x)/length,dy=(b.y-a.y)/length;
   const segment=add(faces,'g',{transform:`matrix(${dx} ${dy} 0 1 ${a.x-dx*start} ${a.y-dy*start})`});
   add(segment,'rect',{x:start,y:0,width:length+.15,height:depth,fill:`url(#map-cliff-${style.material})`});
   add(segment,'rect',{x:start,y:0,width:length+.15,height:depth,fill:'url(#map-cliff-shade)'});
   add(segment,'path',{d:`M${start} .6H${start+length+.15}`,fill:'none',stroke:style.lip,'stroke-opacity':.65,'stroke-width':1.2});
  }
 }
 function drawHiddenShoreShadow(parent,points){
  // Reuse the exact shoreline samples. Three translucent bands soften toward
  // the water; one compound path per band avoids darker joins between samples.
  for(const [width,opacity]of [[12,.15],[7,.22],[2.5,.38]]){
   const quads=[];
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!a.shadowVisible||!b.shadowVisible)continue;
    quads.push(`M${a.x},${a.y} L${b.x},${b.y} L${b.x+b.nx*width},${b.y+b.ny*width} L${a.x+a.nx*width},${a.y+a.ny*width} Z`);
   }
   if(quads.length)add(parent,'path',{d:quads.join(' '),fill:'#10394b',opacity});
  }
 }
 function draw(svg,defs){
  definitions(defs);
  const context=document.createElement('canvas').getContext('2d');context.lineWidth=channelWidth;
  const coastPath=defs.querySelector('#map-continent-clip path').getAttribute('d');
  const coastShape=new Path2D(coastPath),lakeD=lakePath(),lakeShape=new Path2D(lakeD);
  const coast=sample(defs,coastPath),lake=sample(defs,lakeD);
  const layer=add(svg,'g',{class:'map-island-banks','pointer-events':'none'});
  // Below every island body/top: neighboring land naturally hides these bands.
  // Avoid another world-size mask and its expensive intermediate render surface.
  const contactShadows=add(layer,'g',{class:'map-hidden-shore-shadows'});
  for(const region of data.regions){
   const style=regions[region.id],shape=new Path2D(region.path),id=`map-island-${region.id}`;
   const silhouette=add(defs,'g',{id:`${id}-silhouette`,'clip-path':'url(#map-continent-clip)',mask:'url(#map-island-mask)'});
   add(silhouette,'path',{d:region.path});
   const island=add(layer,'g',{class:'map-island-solid','data-island':region.id,'data-material':style.material});
   add(island,'use',{class:'map-island-shadow',href:`#${id}-silhouette`,transform:`translate(5 ${depth+5})`,
    fill:'#12353f',opacity:.25,filter:'url(#map-island-cast-shadow)'});
   const body=add(island,'g',{class:'map-island-body'});
   for(let y=depth;y>=0;y-=2)add(body,'use',{href:`#${id}-silhouette`,transform:`translate(0 ${y})`,fill:style.base});
   const mask=add(defs,'mask',{id:`${id}-volume`,maskUnits:'userSpaceOnUse',x:0,y:0,width:9216,height:7424+depth,style:'mask-type: luminance'});
   for(let y=0;y<=depth;y+=2)add(mask,'use',{href:`#${id}-silhouette`,transform:`translate(0 ${y})`,fill:'white'});
   const rim=add(island,'g',{class:'map-island-rim',mask:`url(#${id}-volume)`});
   const boundaryShapes=data.boundaryLinks.filter(link=>link.regions.includes(region.id)).map(link=>new Path2D(link.path));
   const contact=add(contactShadows,'g',{'data-shore-shadow':region.id});
   for(const [source,kind]of [[coast,'coast'],[sample(defs,region.path),'region'],[lake,'lake']]){
    const points=source.map(p=>{
     let {nx,ny}=p;
     const test=kind==='coast'?coastShape:kind==='lake'?lakeShape:shape;
     if(context.isPointInPath(test,p.x+nx*4,p.y+ny*4)){nx=-nx;ny=-ny;}
     if(kind==='lake'){nx=-nx;ny=-ny;}
     const inset=kind==='region'?channelWidth/2:0,x=p.x-nx*inset,y=p.y-ny*inset;
     const inside=kind==='coast'?context.isPointInPath(shape,p.x-nx*2,p.y-ny*2):
      kind==='lake'?context.isPointInPath(shape,p.x-nx*2,p.y-ny*2):context.isPointInPath(coastShape,p.x,p.y)&&!context.isPointInPath(lakeShape,x,y);
     const inChannel=kind!=='region'&&boundaryShapes.some(boundary=>context.isPointInStroke(boundary,x,y));
     const shore=inside&&!inChannel;
     return{x,y,nx,ny,visible:shore&&ny>.015,shadowVisible:shore&&ny<=.015};
    });
    drawFaces(rim,points,style);
    drawHiddenShoreShadow(contact,points);
   }
  }
 }
 window.MapIslandBanks=Object.freeze({draw,depth,channelWidth,regions,
  assetUrls:Object.values(materials).map(material=>material.image)});
})();
