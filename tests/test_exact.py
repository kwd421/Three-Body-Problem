#!/usr/bin/env python3
"""Exact-rational property tests and deliberate proof-certificate corruption."""
import json,random,subprocess,copy
from fractions import Fraction as F
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'src'))
from verify_certificate import verify,S
BASE=Path(__file__).resolve().parent
rng=random.Random(20260909)
cases=[]
for _ in range(400):
    a=sorted(rng.randrange(-5*S,5*S) for _ in range(2))
    b=sorted(rng.randrange(-5*S,5*S) for _ in range(2))
    if b[0]<=0<=b[1]:b=sorted([abs(x)+1 for x in b])
    cases.append({'a':list(map(str,a)),'b':list(map(str,b))})
parse_values=['0','-0','0.1','-0.1','1.23456789123456789','1e-40','-1e-40','9e40','.3','-.2']
js="""const V=require(process.argv[1]),I=V._test,fs=require('fs'),d=JSON.parse(fs.readFileSync(0,'utf8'));const rows=d.cases.map(c=>{let a=c.a.map(BigInt),b=c.b.map(BigInt),r={};for(let f of ['add','sub','mul','div'])r[f]=I[f](a,b).map(String);r.square=I.sq(a).map(String);r.root=I.sqrt(I.sq(a)).map(String);return r;});console.log(JSON.stringify({rows,parsed:d.parse_values.map(v=>I.dec(v).map(String))}));"""
out=json.loads(subprocess.run(['node','-e',js,str(BASE.parent/'src/validated.js')],input=json.dumps({'cases':cases,'parse_values':parse_values}),capture_output=True,text=True,check=True,timeout=20).stdout)
checks=0
for c,r in zip(cases,out['rows']):
    a,b=[[F(int(t),S) for t in c[k]] for k in ('a','b')]
    truths={'add':[a[0]+b[0],a[1]+b[1]],'sub':[a[0]-b[1],a[1]-b[0]],'mul':[x*y for x in a for y in b],'div':[x/y for x in a for y in b], 'square':[x*x for x in a] + ([F(0)] if a[0]<=0<=a[1] else [])}
    for op,vals in truths.items():
        l,u=[F(int(x),S) for x in r[op]]
        assert l<=min(vals)<=max(vals)<=u,op
        assert min(vals)-l < F(1,S) and u-max(vals)<F(1,S),op
        checks+=1
    qlo,qhi=map(int,r['square']);lo,hi=map(int,r['root'])
    assert lo*lo<=qlo*S and hi*hi>=qhi*S
    assert (lo+1)**2>qlo*S and (hi-1)**2<qhi*S
    checks+=1
for text,interval in zip(parse_values,out['parsed']):
    lo,hi=[F(int(x),S) for x in interval];q=F(text)
    assert lo<=q<=hi and q-lo<F(1,S) and hi-q<F(1,S)
    checks+=1
base=json.loads((BASE.parent/'research/results/smoke.json').read_text())
mutations=[]
def mutation(name,fn):
    c=copy.deepcopy(base);fn(c);mutations.append((name,c))
mutation('endpoint collapsed to zero',lambda c:c['steps'][-1]['end'].__setitem__(0,['0','0']))
mutation('tube collapsed to zero',lambda c:c['steps'][0]['tube'].__setitem__(0,['0','0']))
mutation('initial position changed',lambda c:c['input']['state'].__setitem__(0,'-2'))
mutation('mass changed',lambda c:c['input']['masses'].__setitem__(0,'3'))
mutation('step removed',lambda c:c['steps'].pop())
mutation('requested horizon changed',lambda c:c['input'].__setitem__('T','.2'))
mutation('non-Newton softening',lambda c:c['input'].__setitem__('epsilon','.001'))
mutation('completion flag forged',lambda c:c.__setitem__('complete',False))
mutation('time denominator zero',lambda c:c['steps'][0].__setitem__('h',['1','0']))
mutation('reversed interval',lambda c:c['steps'][0]['tube'].__setitem__(0,['1','-1']))
rejected=[]
for name,c in mutations:
    try:verify(c)
    except (ValueError,ZeroDivisionError):rejected.append(name)
    else:raise AssertionError('Accepted corrupt certificate: '+name)
# JS must also reject these independent mutations.
js="""const V=require(process.argv[1]),fs=require('fs'),rows=JSON.parse(fs.readFileSync(0,'utf8')).map(c=>{try{V.check(c);return false;}catch(e){return true;}});console.log(JSON.stringify(rows));"""
j=json.loads(subprocess.run(['node','-e',js,str(BASE.parent/'src/validated.js')],input=json.dumps([c for _,c in mutations]),capture_output=True,text=True,check=True,timeout=20).stdout)
assert all(j)
result={'exactRationalArithmeticChecks':checks,'arithmeticPassed':checks,'independentPythonCorruptionsRejected':len(rejected),'javaScriptCorruptionsRejected':sum(j),'mutations':rejected}
(BASE.parent/'research/results/exact_tests.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
