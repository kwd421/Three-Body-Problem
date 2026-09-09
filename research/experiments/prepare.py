"""Recreate the exploratory variants from the immutable v1.2 source."""
from pathlib import Path
root=Path(__file__).resolve().parent
base=(root.parent.parent/'archive/v1.2-source/three_body_proof/validated.js').read_text()
(root/'legacy.js').write_text(base)
b=base.replace("version:'1.2.0'","version:'1.3-scheduler'")
b=b.replace('let Y=q.Y,t=rat(0n),hcap=','let suggested=null; let Y=q.Y,t=rat(0n),hcap=')
b=b.replace('let hr=rcmp(rsub(T,t),hcap)<0n?rsub(T,t):hcap,accepted=false;','const proposal=suggested||hcap; let hr=rcmp(rsub(T,t),proposal)<0n?rsub(T,t):proposal,accepted=false;')
b=b.replace('accepted=true;if(steps.length','accepted=true; suggested=rcmp(rat(hr[0]*2n,hr[1]),hcap)>0n?hcap:rat(hr[0]*2n,hr[1]);if(steps.length')
(root/'scheduler.js').write_text(b)
c=b.replace("schema:'three-body-interval-certificate-1'","schema:'three-body-interval-certificate-2'")
c=c.replace("cert.schema!=='three-body-interval-certificate-1'","cert.schema!=='three-body-interval-certificate-2'")
c=c.replace('const L=max(S,8n*sums.map(x=>x[1]).reduce(max));return {L,dmin};','const K=max(S,8n*sums.map(x=>x[1]).reduce(max));const L=sqrt([K,K])[1];return {L,dmin,K};')
c=c.replace("version:'1.3-scheduler'","version:'1.3-weighted'")
(root/'weighted.js').write_text(c)
print('Exploratory variants only; use src/ for the production verifier.')
