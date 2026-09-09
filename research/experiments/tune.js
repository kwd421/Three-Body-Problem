const fs=require('fs');
let s=fs.readFileSync(__dirname+'/weighted.js','utf8').replace('order>16','order>28').replace('4..16','4..28').replace('steps.length>=512','steps.length>=2048').replace('512-step','2048-step').replace('attemptCount>768','attemptCount>4096').replace('768-attempt','4096-attempt');
fs.writeFileSync(__dirname+'/weighted_extended.js',s);
const V=require('./weighted_extended.js');
for(const [order,stepPower] of [[20,9],[24,10],[28,11]]){
 const t=performance.now(),c=V.integrate({state:['-1','0','1','0','0','1','0','0.3','0','-0.2','-0.1','0'],masses:['1','2','3'],T:'1',order,stepPower});
 fs.writeFileSync(__dirname+`/weighted_p${order}_s${stepPower}_T1.json`,JSON.stringify(c));
 console.log(JSON.stringify({order,stepPower,complete:c.complete,reached:c.reached,steps:c.steps.length,rejected:c.summary.rejected,reason:c.reason,minDistance:c.summary.minDistanceLower,width:c.summary.maxPositionWidth,ms:performance.now()-t}));
}
