(function(root,factory){
    const bridgeRules=root?.BridgeCollapseRules||(typeof module==='object'&&module.exports?require('./bridge-collapse-rules'):null);
    const api=factory(bridgeRules);
    if(typeof module==='object'&&module.exports)module.exports=api;
    if(root)root.BridgeMuggingRules=api;
})(typeof window!=='undefined'?window:null,function(bridgeRules){
    'use strict';
    const CHANCE=0.8;
    const FEE=30000;
    function feeForBossCount(bossDefeatedCount=0){
        const count=Math.max(0,Math.floor(Number(bossDefeatedCount)||0));
        return Math.floor((FEE*Math.pow(1.1,count)+1e-7)/100)*100;
    }
    function crossedBridge(path){
        if(!Array.isArray(path)||path.length<2)return false;
        // 最後の一歩が橋を渡る移動である場合に限る。
        return Boolean(bridgeRules?.isBridgeEdge(path[path.length-2],path[path.length-1]));
    }
    function shouldOccur(random=Math.random){return random()<CHANCE;}
    return Object.freeze({CHANCE,FEE,feeForBossCount,crossedBridge,shouldOccur});
});
