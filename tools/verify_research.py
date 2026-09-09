"""Independent certificate replay and exact, outward-rounded theorem assertions."""
from pathlib import Path
from fractions import Fraction as Q
import sys,json,hashlib
R=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(R/'src'))
from verify_certificate import verify,S
p=R/'research/results/asymmetric_T1.json'
c=json.loads(p.read_text())
r=verify(c)
assert r['complete'] and r['reached']=='1' and r['steps']==512
assert Q(r['minDistanceLower'])>Q('0.07536')
assert Q(r['contractionUpper'])<Q(1)
width=max(int(b)-int(a) for a,b in c['steps'][-1]['end'][:6])
assert Q(width,S)<Q('0.00056')
r['certificateSHA256']=hashlib.sha256(p.read_bytes()).hexdigest()
r['theorem']={'timeInterval':['0','1'],'allPairDistanceStrictLower':'0.07536','endpointPositionWidthStrictUpper':'0.00056','scope':'This exact planar IVP; not all initial conditions, chaos, or infinite time.'}
(R/'research/results/independent_T1.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(r,ensure_ascii=False,indent=2))
