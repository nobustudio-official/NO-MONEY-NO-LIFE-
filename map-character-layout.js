/* Native sprite bounds; generated from source alpha, no image copies. */
(function(){
const sheets={"images/characters/player/sprites/戦士.png":{"width":1241,"height":1267,"frames":{"down":[27,1,593,632],"up":[620,0,585,633],"left":[33,633,587,618],"right":[620,633,599,618]}},"images/characters/player/sprites/めぐみ.png":{"width":1241,"height":1267,"frames":{"down":[27,0,593,633],"up":[620,0,551,633],"left":[39,633,581,634],"right":[620,633,589,622]}},"images/characters/player/sprites/聖職者.png":{"width":1223,"height":1286,"frames":{"down":[53,0,555,643],"up":[641,0,568,643],"left":[0,643,611,634],"right":[611,643,590,643]}},"images/characters/player/sprites/剣士.png":{"width":1223,"height":1286,"frames":{"down":[13,0,598,639],"up":[611,0,528,635],"left":[13,643,597,628],"right":[612,643,576,627]}},"images/characters/player/sprites/騎士.png":{"width":1223,"height":1286,"frames":{"down":[0,0,567,643],"up":[616,0,565,643],"left":[0,643,611,643],"right":[611,643,596,643]}},"images/characters/player/sprites/魔術師.png":{"width":1223,"height":1286,"frames":{"down":[0,0,579,643],"up":[635,0,540,643],"left":[0,643,611,643],"right":[611,643,600,643]}},"images/characters/player/sprites/鍛冶士.png":{"width":1230,"height":1271,"frames":{"down":[191,0,382,605],"up":[666,0,399,605],"left":[156,649,392,558],"right":[707,649,331,558]}},"images/characters/player/sprites/看護師.png":{"width":1236,"height":1222,"frames":{"down":[14,11,603,600],"up":[618,11,617,600],"left":[38,611,577,603],"right":[618,611,589,603]}},"images/characters/player/sprites/獣人.png":{"width":1239,"height":1270,"frames":{"down":[0,0,619,635],"up":[619,0,564,635],"left":[39,635,580,635],"right":[619,635,562,635]}},"images/characters/player/sprites/エルフ.png":{"width":1239,"height":1270,"frames":{"down":[27,0,592,635],"up":[619,0,578,635],"left":[33,635,586,635],"right":[619,635,580,635]}},"images/characters/player/sprites/義賊.png":{"width":1225,"height":1280,"frames":{"down":[39,1,510,630],"up":[718,0,447,630],"left":[39,652,508,580],"right":[709,670,344,573]}},"images/characters/player/sprites/拳法.png":{"width":1240,"height":1308,"frames":{"down":[31,2,589,648],"up":[621,2,535,648],"left":[6,659,614,624],"right":[626,661,595,619]}}};
// Independent direction images use their visible vertical bounds to keep a
// consistent 100px character height and align the contact point to the square.
const standaloneSprites={
"images/characters/player/directions/めぐみ_back.webp":[612,643,39,617],
"images/characters/player/directions/めぐみ_front.webp":[612,643,39,617],
"images/characters/player/directions/めぐみ_left.webp":[612,643,39,617],
"images/characters/player/directions/めぐみ_right.webp":[612,643,39,617],
"images/characters/player/directions/エルフ_back.webp":[612,643,26,616],
"images/characters/player/directions/エルフ_front.webp":[612,643,26,616],
"images/characters/player/directions/エルフ_left.webp":[612,643,26,616],
"images/characters/player/directions/エルフ_right.webp":[612,643,26,616],
"images/characters/player/directions/剣士_back.webp":[1223,1286,22,1268],
"images/characters/player/directions/剣士_front.webp":[612,643,12,617],
"images/characters/player/directions/剣士_left.webp":[1223,1286,1,1270],
"images/characters/player/directions/剣士_right.webp":[1223,1286,20,1271],
"images/characters/player/directions/戦士_back.webp":[612,643,39,617],
"images/characters/player/directions/戦士_front.webp":[612,643,39,617],
"images/characters/player/directions/戦士_left.webp":[612,643,39,617],
"images/characters/player/directions/戦士_right.webp":[612,643,39,617],
"images/characters/player/directions/獣人_back.webp":[612,643,57,617],
"images/characters/player/directions/獣人_front.webp":[612,643,57,617],
"images/characters/player/directions/獣人_left.webp":[612,643,57,617],
"images/characters/player/directions/獣人_right.webp":[612,643,57,617],
"images/characters/player/directions/看護師_back.webp":[612,643,15,620],
"images/characters/player/directions/看護師_front.webp":[612,643,7,621],
"images/characters/player/directions/看護師_left.webp":[612,643,9,620],
"images/characters/player/directions/看護師_right.webp":[612,643,21,620],
"images/characters/player/directions/義賊_back.webp":[612,643,23,624],
"images/characters/player/directions/義賊_front.webp":[612,643,3,643],
"images/characters/player/directions/義賊_left.webp":[612,643,12,643],
"images/characters/player/directions/義賊_right.webp":[612,643,8,623],
"images/characters/player/directions/聖職者_back.webp":[612,643,9,638],
"images/characters/player/directions/聖職者_front.webp":[612,643,3,643],
"images/characters/player/directions/聖職者_left.webp":[612,643,1,643],
"images/characters/player/directions/聖職者_right.webp":[612,643,3,626],
"images/characters/player/directions/騎士_back.webp":[612,643,12,617],
"images/characters/player/directions/騎士_front.webp":[612,643,12,617],
"images/characters/player/directions/騎士_left.webp":[612,643,12,617],
"images/characters/player/directions/騎士_right.webp":[612,643,12,617],
"images/characters/player/directions/魔術師_back.webp":[612,643,17,617],
"images/characters/player/directions/魔術師_front.webp":[612,643,17,617],
"images/characters/player/directions/魔術師_left.webp":[612,643,17,617],
"images/characters/player/directions/魔術師_right.webp":[612,643,17,617]
};
window.MapCharacterLayout={apply(element,path,direction){
if(!element.classList.contains("player-piece"))return;
const standalone=standaloneSprites[path];
if(standalone){
const [width,height,top,bottom]=standalone,scale=100/(bottom-top);
element.style.backgroundSize=`${width*scale}px ${height*scale}px`;
element.style.backgroundPosition=`${(100-width*scale)/2}px ${100-bottom*scale}px`;
return;
}
const sheet=sheets[path],box=sheet?.frames[direction];if(!box)return;
const scale=100/box[3];
element.style.backgroundSize=`${sheet.width*scale}px ${sheet.height*scale}px`;
element.style.backgroundPosition=`${(100-box[2]*scale)/2-box[0]*scale}px ${-box[1]*scale}px`;
}};
})();
