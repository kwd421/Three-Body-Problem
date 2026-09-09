#!/usr/bin/env python3
"""Verify BOTH orbit witnesses, then enclose finite-time position amplification."""
import json,sys
from fractions import Fraction as F
from pathlib import Path
from verify_certificate import verify,box_from_json,number,sub,add,square,root,div,ZERO,outward_decimal

def norm(xs):
    q=ZERO
    for x in xs:q=add(q,square(x))
    return root(q)
def show(a):return [outward_decimal(a[0]),outward_decimal(a[1],up=True)]
def verify_pair(c):
    if c.get('schema')!='three-body-interval-pair-1':raise ValueError('wrong pair schema')
    a,b=c['base'],c['perturbed']
    checks=[verify(a),verify(b)]
    if not all(x['complete'] for x in checks):raise ValueError('pair needs full certificates')
    if F(a['input']['T'])!=F(b['input']['T']):raise ValueError('different horizons')
    if list(map(F,a['input']['masses']))!=list(map(F,b['input']['masses'])):raise ValueError('different masses')
    ya,yb=box_from_json(a['steps'][-1]['end']),box_from_json(b['steps'][-1]['end'])
    init=norm([sub(number(b['input']['state'][k]),number(a['input']['state'][k])) for k in range(6)])
    end=norm([sub(yb[k],ya[k]) for k in range(6)])
    ratio=div(end,init)
    masses=list(map(F,a['input']['masses']));da=[F(b['input']['state'][k])-F(a['input']['state'][k]) for k in range(12)]
    com=[sum(masses[i]*da[2*i+k] for i in range(3))/sum(masses) for k in range(2)]
    return {'verified':True,'orbitChecks':checks,'initialNorm':show(init),'finalNorm':show(end),'amplification':show(ratio),
            'amplificationStrictlyAbove2':ratio[0]>number(2)[1],
            'centerOfMassShift':list(map(str,com)),'initialVelocitiesUnchanged':all(x==0 for x in da[6:])}
if __name__=='__main__':
    if len(sys.argv)!=2:raise SystemExit('python verify_pair.py pair_certificate.json')
    try:print(json.dumps(verify_pair(json.loads(Path(sys.argv[1]).read_text())),indent=2))
    except (ValueError,KeyError,TypeError,ZeroDivisionError) as e:raise SystemExit('REJECTED: '+str(e))
