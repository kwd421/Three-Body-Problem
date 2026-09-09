#!/usr/bin/env python3
"""Independent DOP853 cross-check of the actual JavaScript engine.
Requires Python NumPy/SciPy and Node. This is empirical validation, not proof.
"""
from pathlib import Path
import json, subprocess, sys
import numpy as np
from scipy.integrate import solve_ivp
BASE=Path(__file__).resolve().parent
js=r'''
const P=require('./physics.js'),E=require('./experiments.js');
let cases=[];
for(const id of ['equilateral','figure8','asymmetric','hierarchy','butterfly']){
  const p=P.preset(id);
  for(const T of [0.1,2,6]) for(const method of ['rk45','taylor']){
    const options={...P.DEFAULTS,method,rtol:1e-11,atol:1e-13};
    const s=P.run(p.y,p.m,options,T);
    cases.push({id,T,method,y0:p.y,m:p.m,options,y:Array.from(s.y),stats:s.stats});
  }
}
const sp=P.preset('asymmetric');for(const method of ['rk45','taylor']){
  const options={...P.DEFAULTS,method,epsilon:.05,rtol:1e-11,atol:1e-13};const s=P.run(sp.y,sp.m,options,2);
  cases.push({id:'softened_asymmetric',T:2,method,y0:sp.y,m:sp.m,options,y:Array.from(s.y),stats:s.stats});
}
const p=P.preset('figure8'),b=P.preset('butterfly');
const data={y:p.y,m:p.m,options:P.DEFAULTS,T:6,delta:1e-6};
const experiments=[E.execute('benchmark',{}),E.execute('compare',data),E.execute('reversal',data),E.execute('sensitivity',{...data,y:b.y,m:b.m,T:20})];
let guards=[];
for(const [name,fn] of [
 ['negative mass',()=>new P.Simulator(p.y,[-1,1,1])],
 ['nonfinite target time',()=>new P.Simulator(p.y,p.m).advanceTo(NaN)],
 ['backward target time',()=>new P.Simulator(p.y,p.m).advanceTo(-1)],
 ['invalid step budget',()=>new P.Simulator(p.y,p.m).advanceTo(1,0)],
 ['nonfinite state',()=>new P.Simulator([NaN,...p.y.slice(1)],p.m)],
 ['unknown method',()=>new P.Simulator(p.y,p.m,{method:'unknown'})],
 ['unsafe fixed step',()=>P.run([-.001,0,.001,0,1,0,0,0,0,0,0,0],p.m,{method:'leapfrog',dt:.02},.02)],
 ['initial collision',()=>new P.Simulator([0,0,0,0,1,0,0,0,0,0,0,0],p.m)]
]){try{fn();guards.push({name,passed:false});}catch(e){guards.push({name,passed:true,code:e.code});}}
const a=P.preset('asymmetric');let stress=[];
for(const opts of [{method:'rk4',dt:.02,maxStep:.02,guardFixed:false},{method:'rk4',dt:.02,maxStep:.02,guardFixed:true},{method:'rk45',rtol:1e-10,atol:1e-12}]){
 const r=E.one(a.y,a.m,opts,2);stress.push({options:opts,ok:r.ok,t:r.sim?.t,stats:r.sim?.stats,error:r.error});
}
console.log(JSON.stringify({cases,experiments,guards,stress}));
'''
raw=json.loads(subprocess.check_output(['node','-e',js],cwd=BASE,text=True))
cache={}
checks=[]
for c in raw['cases']:
    key=(c['id'],c['T'])
    if key not in cache:
        masses=np.array(c['m']);eps=c['options']['epsilon'];G=c['options']['G']
        def rhs(t,y):
            r=y[:6].reshape(3,2);vel=y[6:].reshape(3,2);acc=np.zeros_like(r)
            for i in range(3):
                for j in range(3):
                    if i==j:continue
                    d=r[j]-r[i]
                    acc[i]+=G*masses[j]*d/(np.dot(d,d)+eps*eps)**1.5
            return np.concatenate((vel.ravel(),acc.ravel()))
        sol=solve_ivp(rhs,(0,c['T']),c['y0'],method='DOP853',rtol=2.5e-14,atol=1e-15,max_step=.01)
        if not sol.success:raise RuntimeError(sol.message)
        cache[key]=sol.y[:,-1]
    ref=cache[key]
    c['dop853_state_rms']=float(np.sqrt(np.mean((np.array(c['y'])-ref)**2)))
    c['dop853_position_rms']=float(np.sqrt(np.mean((np.array(c['y'])[:6]-ref[:6])**2)))
    c['dop853_max_component']=float(np.max(np.abs(np.array(c['y'])-ref)))
    # Predeclared empirical gate: 1e-5 for these six-unit runs including close
    # encounters. It does not assert this tolerance for arbitrary initial data.
    c['gate']=1e-5
    c['passed']=c['dop853_max_component']<c['gate']
    checks.append(c)
    print(f"{c['id']:21s} T={c['T']:4g} {c['method']:7s} max_component={c['dop853_max_component']:.3e} {'PASS' if c['passed'] else 'FAIL'}")
raw['independent_reference']={'solver':'SciPy DOP853','rtol':2.5e-14,'atol':1e-15,'max_step':.01,'note':'Agreement is not a rigorous true-error bound.'}
raw['summary']={'crosschecks_passed':sum(c['passed'] for c in checks),'crosschecks_total':len(checks),'max_position_rms':max(c['dop853_position_rms'] for c in checks),'max_state_component':max(c['dop853_max_component'] for c in checks)}
(BASE/'numerical_results.json').write_text(json.dumps(raw,ensure_ascii=False,indent=2))
print('\nSUMMARY',raw['summary'])
for e in raw['experiments']:
    print('\n'+e['title'])
    for row in e['rows']:print(' | '.join(row))
print('\nSTRESS',json.dumps(raw['stress'],ensure_ascii=False,indent=2))
if not all(c['passed'] for c in checks) or not all(g['passed'] for g in raw['guards']):sys.exit(1)
for exp in raw['experiments']:
    if exp['kind'] in ('compare','reversal'):
        assert all(row[-1]=='완료' for row in exp['rows']), 'Unexpected endpoint or comparison abort'

