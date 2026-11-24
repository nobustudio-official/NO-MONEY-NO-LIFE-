(function(root){
 'use strict';
 const imported=typeof module!=='undefined'&&module.exports?require('./imported-small-objects'):root.MapImportedSmallObjects||[];
 const regions=[['capital','王都','🏰'],['town','街','🏘️'],['grassland','草原','🌾'],['forest','森林','🌳'],['lake','湖','💧'],['desert','砂漠','🌵'],['snow','雪山','❄️'],['ruins','古代遺跡','🏛️'],['volcano','火山','🌋']];
 const rows=[
  ['capital','王城と中央広場','🏰','街灯','💡','花壇','🌷'],
  ['town','市場','⛺','小さな民家','🏠','木箱と樽','📦'],
  ['grassland','風車小屋','🏡','野花と草の茂み','🌼','小さな岩','🪨'],
  ['forest','巨大な古木','🌳','キノコの群生','🍄','倒木','🪵'],
  ['lake','湖に浮かぶ祠','⛩️','水面の岩','🪨','スイレン','🪷'],
  ['desert','オアシス','🏝️','サボテン','🌵','砂に埋まった壺','🏺'],
  ['snow','氷の洞窟','🧊','雪の針葉樹','🌲','氷柱の付いた岩','🪨'],
  ['ruins','巨大な石の門','🏛️','折れた石柱','🗿','苔むした石碑','🪦'],
  ['volcano','噴火口','🌋','黒い火山岩','🪨','蒸気の割れ目','♨️']
 ];
 const objects=rows.flatMap(([region,...values])=>[0,1,2].map(i=>({id:region+'-'+i,region,name:values[i*2],symbol:values[i*2+1],kind:i?'small':'landmark',width:i?150:460,height:i?110:350,asset:null})));
 objects.find(o=>o.id==='capital-0').asset='images/map/objects/optimized/capital/royal-castle-v2-70pct.webp';
 const images={'town-0':['ギルドの建物','optimized/town/guild-v1-70pct.png'],'grassland-0':['丘の上の風車小屋','optimized/grassland/windmill-v1-70pct.png'],'forest-0':['巨大な古木','optimized/forest/ancient-tree-v2-70pct.png'],'desert-0':['ヤシの木に囲まれたオアシス','desert/oasis-v1.png'],'snow-0':['青く光る氷の洞窟','optimized/snow/ice-cave-v1-70pct.png'],'ruins-0':['崩れかけた巨大な石の門','optimized/ruins/ruined-gate-v1-70pct.png'],'volcano-0':['火山','volcano/mini-volcano-v1.png']};
 for(const [id,[name,path]]of Object.entries(images))Object.assign(objects.find(o=>o.id===id),{name,asset:'images/map/objects/'+path.replace(/\.png$/i,'.webp')});
 objects.find(o=>o.id==='town-0').symbol='🏛️';
 objects.push({id:'grassland-tree-cluster',region:'grassland',name:'木と岩の茂み',symbol:'🌳',kind:'small',width:240,height:210,asset:'images/map/objects/optimized/grassland/tree-rock-cluster-70pct.webp'});
 objects.push(...imported);
 const data={regions:regions.map(([id,name,symbol])=>({id,name,symbol})),objects,
  roadStyles:[{id:'stone',name:'石畳',color:'#c1b7a5'},{id:'capital-ivory',name:'王都1：白石の大通り',color:'#e2e5df'},{id:'capital-slate',name:'王都2：青灰石の街路',color:'#a3b6c4'},{id:'capital-brick',name:'王都3：赤茶レンガの街路',color:'#c2977e'},{id:'grassland-road',name:'草原：敷石の街道',color:'#c49c63'},{id:'forest-road',name:'森林：苔むした山道',color:'#684a34'},{id:'desert-road',name:'砂漠：砂岩の道',color:'#dda45c'},{id:'snow-road',name:'雪山：氷雪の道',color:'#b8cde3'},{id:'ruins-road',name:'古代遺跡：風化した石畳',color:'#aaa08d'},{id:'volcano-road',name:'火山：黒曜石の道',color:'#39363a'},{id:'lake-road',name:'湖：木の遊歩道',color:'#a97849'},{id:'trail',name:'土の道（仮）',color:'#b48d58'},{id:'bridge-stone',name:'石橋',color:'#ad9b85'},{id:'bridge-wood',name:'木橋',color:'#ab794e'},{id:'bridge',name:'橋（旧データ互換・石橋）',color:'#ad9b85'},{id:'sea',name:'海上ルート（仮）',color:'#b6d9df'}]};
 if(typeof module!=='undefined'&&module.exports)module.exports=data;else root.MapObjectCatalog=data;
})(typeof window!=='undefined'?window:globalThis);
