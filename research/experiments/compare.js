const fs=require('fs'),path=require('path');
const input={state:['-1','0','1','0','0','1','0','0.3','0','-0.2','-0.1','0'],masses:['1','2','3'],T:'1',order:14,stepPower:8};
for(const name of ['legacy','scheduler','weighted']){
 const V=require('./'+name+'.js'),t=performance.now();
 const c=V.integrate(input);fs.writeFileSync(path.join(__dirname,name+'_T1.json'),JSON.stringify(c));
 console.log(JSON.stringify({method:name,complete:c.complete,time:c.reached,steps:c.steps.length,rejected:c.summary.rejected,minDistance:c.summary.minDistanceLower,width:c.summary.maxPositionWidth,reason:c.reason,ms:performance.now()-t}));
}
