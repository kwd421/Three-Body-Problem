'use strict';
const V=require('./validated.js'),P=require('./legacy/three_body_lab/physics.js'),fs=require('fs'),path=require('path');
const write=(n,c)=>fs.writeFileSync(path.join(__dirname,n),JSON.stringify(c,null,2));
for(const [preset,T,order,stepPower] of [['asymmetric','.1',12,7],['asymmetric','.5',12,7],['asymmetric','.7',14,8],['asymmetric','1',14,8],['figure8','1',12,7]]){
 const p=P.preset(preset);const c=V.integrate({state:p.y.map(String),masses:p.m.map(String),T,order,stepPower});
 V.check(c);const name=preset+'_T'+T.replace('.','p')+'.json';write(name,c);console.log(name,c.complete,c.reached.join('/'),c.summary.steps);
}
const a=JSON.parse(fs.readFileSync(path.join(__dirname,'asymmetric_Tp7.json'),'utf8'));
const input={...a.input,state:['-0.9999995','0','0.9999999','0','-0.0000001','1','0','0.3','0','-0.2','-0.1','0']};
const b=V.integrate(input);V.check(b);write('perturbed_Tp7.json',b);write('pair_certificate.json',{schema:'three-body-interval-pair-1',base:a,perturbed:b});
console.log('pair_certificate.json',a.complete&&b.complete);
