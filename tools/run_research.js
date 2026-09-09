/* Reproduce a fixed, bounded experiment. No autonomous claims or silent tuning. */
'use strict';
const fs=require('fs'),path=require('path'),V=require('../src/validated.js');
const out=path.join(__dirname,'../research/results');fs.mkdirSync(out,{recursive:true});
const input={state:['-1','0','1','0','0','1','0','0.3','0','-0.2','-0.1','0'],masses:['1','2','3'],G:'1',epsilon:'0'};
for(const [name,T,order,stepPower] of [['smoke','.1',12,7],['asymmetric_T1','1',20,9]]){
 const c=V.integrate({...input,T,order,stepPower});
 const verified=V.check(c);
 if(!verified.verified||!verified.complete)throw Error(name+' did not certify its full target');
 fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(c));
 fs.writeFileSync(path.join(out,name+'_js_check.json'),JSON.stringify(verified,null,2)+'\n');
 console.log(name+': verified '+verified.steps+' steps; min distance >= '+verified.minDistanceLower);
}
