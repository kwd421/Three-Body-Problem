/* Three Body Lab v1.3: validated finite-time IVP integration.
 * MIT. No external dependencies. Core endpoints are integers / 2^192.
 * Certificates prove only stated finite-time enclosures, conditional on this
 * implementation and integer runtime. NOT a formal proof-assistant artifact.
 */
(function(root){
'use strict';
const BITS=192, S=1n<<BigInt(BITS), Z=[0n,0n], O=[S,S], PAIRS=[[0,1],[0,2],[1,2]];
const abs=x=>x<0n?-x:x, min=(a,b)=>a<b?a:b, max=(a,b)=>a>b?a:b;
function floor(n,d){if(d===0n)throw Error('division by zero');if(d<0n){n=-n;d=-d;}let q=n/d;if(n<0n&&n%d)q--;return q;}
const ceil=(n,d)=>-floor(-n,d);
function isqrt(n){if(n<0n)throw Error('negative square root');if(n<2n)return n;let x=1n<<BigInt((n.toString(2).length+1)>>1);for(;;){const y=(x+n/x)>>1n;if(y>=x)return x;x=y;}}
function gcd(a,b){a=abs(a);b=abs(b);while(b){const c=a%b;a=b;b=c;}return a;}
function rat(n,d=1n){if(d===0n)throw Error('zero denominator');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return [n/g,d/g];}
const radd=(a,b)=>rat(a[0]*b[1]+b[0]*a[1],a[1]*b[1]);
const rsub=(a,b)=>rat(a[0]*b[1]-b[0]*a[1],a[1]*b[1]);
const rcmp=(a,b)=>a[0]*b[1]-b[0]*a[1];
function parse(s){s=String(s).trim();if(s.length>100)throw Error('decimal too long');const m=/^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(s);if(!m||!(m[2]||m[3]))throw Error('finite decimal required');const e=Number(m[4]||0)-(m[3]||'').length;if(!Number.isInteger(e)||Math.abs(e)>100)throw Error('decimal exponent outside safe input range');let n=BigInt((m[2]||'')+(m[3]||''));if(m[1]==='-')n=-n;return e>=0?rat(n*10n**BigInt(e)):rat(n,10n**BigInt(-e));}
const fromRat=x=>[floor(x[0]*S,x[1]),ceil(x[0]*S,x[1])];
const dec=s=>fromRat(parse(s));
const int=n=>[BigInt(n)*S,BigInt(n)*S];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const neg=a=>[-a[1],-a[0]];
const sub=(a,b)=>[a[0]-b[1],a[1]-b[0]];
function mul(a,b){const v=[a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]];return [floor(v.reduce(min),S),ceil(v.reduce(max),S)];}
function div(a,b){if(b[0]<=0n&&b[1]>=0n)throw Error('interval denominator contains zero');let lo=null,hi=null;for(const x of a)for(const y of b){const l=floor(x*S,y),u=ceil(x*S,y);lo=lo===null?l:min(lo,l);hi=hi===null?u:max(hi,u);}return [lo,hi];}
function sq(a){const lo=a[0]<=0n&&a[1]>=0n?0n:min(a[0]*a[0],a[1]*a[1]),hi=max(a[0]*a[0],a[1]*a[1]);return [floor(lo,S),ceil(hi,S)];}
function sqrt(a){if(a[0]<0n)throw Error('negative interval sqrt');const lo=isqrt(a[0]*S),n=a[1]*S,u=isqrt(n);return [lo,u*u===n?u:u+1n];}
const amag=a=>max(abs(a[0]),abs(a[1]));
const hull=(a,b)=>[min(a[0],b[0]),max(a[1],b[1])];
function intersection(a,b){const c=[max(a[0],b[0]),min(a[1],b[1])];if(c[0]>c[1])throw Error('disjoint enclosures: implementation or range failure');return c;}
const subset=(a,b,strict=false)=>strict?a[0]>b[0]&&a[1]<b[1]:a[0]>=b[0]&&a[1]<=b[1];
function inflate(a){const pad=(a[1]-a[0])/4n+(S>>100n)+2n;return [a[0]-pad,a[1]+pad];}
function geometry(X){return PAIRS.map(([i,j])=>{const d=[sub(X[2*j],X[2*i]),sub(X[2*j+1],X[2*i+1])],s=add(sq(d[0]),sq(d[1]));if(s[0]<=0n)throw Error('box does not certify separated bodies');const r=sqrt(s);if(r[0]<=0n)throw Error('distance lower bound rounded to zero');return {i,j,d,s,r,b:div(O,mul(s,r))};});}
function field(X,m){const f=X.slice(6).concat(Array.from({length:6},()=>Z));for(const p of geometry(X)){for(let k=0;k<2;k++){const g=mul(p.d[k],p.b);f[6+2*p.i+k]=add(f[6+2*p.i+k],mul(m[p.j],g));f[6+2*p.j+k]=sub(f[6+2*p.j+k],mul(m[p.i],g));}}return f;}
/* ||D F||_infinity <= max(1,8 max_i sum_(j!=i) m_j/d_ij^3).
 * ||D (u/|u|^3)||_2=2/|u|^3, ||.||_inf <=sqrt(2)||.||_2;
 * both own and other body's position blocks contribute. 4 sqrt(2)<8.
 */
// Weighted norm max(sqrt(K)*|dr|_inf, |dv|_inf) gives Lipschitz sqrt(K).
function bounds(X,m,weighted=true){const g=geometry(X),sums=[Z,Z,Z];let dmin=null;for(const p of g){sums[p.i]=add(sums[p.i],mul(m[p.j],p.b));sums[p.j]=add(sums[p.j],mul(m[p.i],p.b));dmin=dmin===null?p.r[0]:min(dmin,p.r[0]);}const K=max(S,8n*sums.map(x=>x[1]).reduce(max));const L=weighted?sqrt([K,K])[1]:K;return {L,dmin};}
function tube(Y,m,h){const H=[0n,h[1]],f0=field(Y,m);let X=Y.map((y,k)=>inflate(hull(y,add(y,mul(H,f0[k])))));
for(let it=0;it<14;it++){if(X.some(x=>amag(x)>S*1000000000000n))throw Error('candidate box exceeds search budget');const f=field(X,m),image=Y.map((y,k)=>add(y,mul(H,f[k])));if(image.every((y,k)=>subset(y,X[k],true))){const b=bounds(X,m),q=ceil(h[1]*b.L,S);if(q>=S)throw Error('Picard contraction not certified');return {X,f,q,...b,iterations:it+1};}X=X.map((x,k)=>subset(image[k],x,true)?x:inflate(hull(x,image[k])));}
throw Error('Picard box inclusion not certified');}
/* Position-series coefficients; n! is already divided out. */
function coefficients(Y,m,degree){const a=Array.from({length:degree+1},()=>Array.from({length:6},()=>Z));a[0]=Y.slice(0,6);a[1]=Y.slice(6);
const ps=PAIRS.map(([i,j])=>({i,j,d:[],s:[],b:[]}));
for(let n=0;n<=degree-2;n++)for(const p of ps){const {i,j,d,s,b}=p;d[n]=[sub(a[n][2*j],a[n][2*i]),sub(a[n][2*j+1],a[n][2*i+1])];let sn=Z;
if(n===0)sn=add(sq(d[0][0]),sq(d[0][1]));else for(let k=0;k<=n;k++)for(let z=0;z<2;z++)sn=add(sn,mul(d[k][z],d[n-k][z]));s[n]=sn;
if(n===0){if(sn[0]<=0n)throw Error('Taylor box contains possible collision');b[0]=div(O,mul(sn,sqrt(sn)));}
else {let sum=Z;for(let k=1;k<=n;k++)sum=add(sum,mul(int(2*n+k),mul(s[k],b[n-k])));b[n]=neg(div(sum,mul(int(2*n),s[0])));}
for(let z=0;z<2;z++){let f=Z;for(let k=0;k<=n;k++)f=add(f,mul(d[k][z],b[n-k]));f=div(f,int((n+1)*(n+2)));a[n+2][2*i+z]=add(a[n+2][2*i+z],mul(m[j],f));a[n+2][2*j+z]=sub(a[n+2][2*j+z],mul(m[i],f));}}
return a;}
function endpoint(Y,m,h,X,p,fX=null){const a=coefficients(Y,m,p),b=coefficients(X,m,p+1);let hp=O;for(let i=0;i<p;i++)hp=mul(hp,h);const out=[];
for(let j=0;j<12;j++){const k=j%6;let v=Z;for(let n=p-1;n>=0;n--){const c=j<6?a[n][k]:mul(int(n+1),a[n+1][k]);v=add(mul(v,h),c);}const remainder=j<6?b[p][k]:mul(int(p+1),b[p+1][k]);out[j]=add(v,mul(hp,remainder));}
const f=fX||field(X,m);return out.map((v,k)=>intersection(v,add(Y[k],mul(h,f[k]))));}
const pack=X=>X.map(a=>a.map(String));
const unpack=X=>{if(!Array.isArray(X)||X.length!==12)throw Error('certificate box shape');return X.map(a=>{if(!Array.isArray(a)||a.length!==2||a.some(v=>typeof v!=='string'||v.length>200||! /^-?\d+$/.test(v)))throw Error('invalid endpoint');const b=a.map(BigInt);if(b[0]>b[1])throw Error('reversed interval');return b;});};
function outDecimal(x,digits=24,upper=false){const q=(upper?ceil:floor)(x*10n**BigInt(digits),S),negative=q<0n,a=abs(q).toString().padStart(digits+1,'0');return (negative?'-':'')+a.slice(0,-digits)+'.'+a.slice(-digits);}
const display=X=>X.map(a=>[outDecimal(a[0]),outDecimal(a[1],24,true)]);
const approx=x=>Number(x)/Number(S); // Presentation only; NEVER used in a proof decision.
function validateInput(input){if(!input||!Array.isArray(input.state)||input.state.length!==12||!Array.isArray(input.masses)||input.masses.length!==3)throw Error('12 state values and 3 masses required');
const state=input.state.map(String),masses=input.masses.map(String),Y=state.map(dec),m=masses.map(dec);if(Y.some(x=>amag(x)>S*100000000n)||m.some(x=>x[0]<=0n||x[1]>S*100000000n))throw Error('finite positive masses and bounded state required');
if(input.G!==undefined&&String(input.G)!=='1')throw Error('proof mode requires G=1');if(input.epsilon!==undefined&&parse(input.epsilon)[0]!==0n)throw Error('proof mode certifies only unsoftened Newton gravity (epsilon=0)');
const T=parse(input.T??'0.1');if(T[0]<=0n||rcmp(T,rat(2n))>0n)throw Error('proof horizon must be in (0,2]');const order=input.order??12;if(!Number.isInteger(order)||order<4||order>28)throw Error('order must be an integer 4..28');
const stepPower=input.stepPower??7;if(!Number.isInteger(stepPower)||stepPower<5||stepPower>16)throw Error('stepPower must be integer 5..16');geometry(Y);return {Y,m,T,order,stepPower,state,masses};}
function integrate(input,emit=()=>{}){const q=validateInput(input),{m,T,order,stepPower}=q;let Y=q.Y,t=rat(0n),hcap=rat(1n,1n<<BigInt(stepPower)),minR=null,maxQ=0n,rejected=0,attemptCount=0;const steps=[];let reason=null;
const certificate={schema:'three-body-interval-certificate-2',engine:'1.3.0',bits:BITS,model:'planar Newton; G=1; epsilon=0',input:{state:q.state,masses:q.masses,T:String(input.T??'0.1'),G:'1',epsilon:'0',order,stepPower},steps};
while(rcmp(t,T)<0n){if(steps.length>=2048){reason='2048-step proof budget exhausted';break;}let hr=rcmp(rsub(T,t),hcap)<0n?rsub(T,t):hcap,accepted=false;
for(let attempt=0;attempt<12;attempt++){if(++attemptCount>4096){reason='4096-attempt proof budget exhausted';break;}try{const h=fromRat(hr),b=tube(Y,m,h),next=endpoint(Y,m,h,b.X,order,b.f);if(next.some(x=>x[1]-x[0]>S/5n))throw Error('enclosure width exceeds proof budget');steps.push({h:hr.map(String),tube:pack(b.X),end:pack(next)});Y=next;t=radd(t,hr);minR=minR===null?b.dmin:min(minR,b.dmin);maxQ=max(maxQ,b.q);accepted=true;if(steps.length%4===0||rcmp(t,T)===0n)emit({steps:steps.length,t:Number(t[0])/Number(t[1]),T:Number(T[0])/Number(T[1]),maxWidth:Math.max(...Y.map(x=>approx(x[1]-x[0])))});break;}
catch(e){rejected++;hr=rat(hr[0],hr[1]*2n);if(rcmp(hr,rat(1n,1n<<22n))<0n||attempt===11){reason=e.message;break;}}}
if(!accepted)break;}
certificate.complete=rcmp(t,T)===0n;certificate.reached=t.map(String);certificate.reason=reason;certificate.summary={steps:steps.length,rejected,minDistanceLower:minR===null?null:outDecimal(minR,24),contractionUpper:outDecimal(maxQ,24,true),endpoint:display(Y),maxPositionWidth:Math.max(...Y.slice(0,6).map(x=>approx(x[1]-x[0]))),maxStateWidth:Math.max(...Y.map(x=>approx(x[1]-x[0])))};
return certificate;}
function check(cert,emit=()=>{}){if(!cert||!['three-body-interval-certificate-1','three-body-interval-certificate-2'].includes(cert.schema)||cert.bits!==BITS||!Array.isArray(cert.steps)||cert.steps.length>2048)throw Error('unknown or oversized certificate');const q=validateInput(cert.input);if(cert.schema==='three-body-interval-certificate-1'&&q.order>16)throw Error('legacy certificate order outside 4..16');let Y=q.Y,t=rat(0n),minR=null,maxQ=0n;
for(let n=0;n<cert.steps.length;n++){const s=cert.steps[n];if(!s.h||s.h.length!==2||s.h.some(x=>typeof x!=='string'||x.length>100||!/^\d+$/.test(x)))throw Error('bad time step');const hr=rat(BigInt(s.h[0]),BigInt(s.h[1]));if(hr[0]<=0n||rcmp(radd(t,hr),q.T)>0n)throw Error('time interval outside claim');const h=fromRat(hr),X=unpack(s.tube),next=unpack(s.end),f=field(X,q.m);const H=[0n,h[1]],im=Y.map((y,k)=>add(y,mul(H,f[k])));if(!im.every((v,k)=>subset(v,X[k],true)))throw Error('Picard inclusion failed at step '+n);const b=bounds(X,q.m,cert.schema==='three-body-interval-certificate-2'),cq=ceil(h[1]*b.L,S);if(cq>=S)throw Error('contraction failed');const E=endpoint(Y,q.m,h,X,q.order,f);if(!E.every((v,k)=>subset(v,next[k])))throw Error('endpoint enclosure too small at step '+n);Y=next;t=radd(t,hr);minR=minR===null?b.dmin:min(minR,b.dmin);maxQ=max(maxQ,cq);if(n%8===0)emit({step:n+1,total:cert.steps.length});}
if(!Array.isArray(cert.reached)||cert.reached.length!==2||rcmp(t,rat(...cert.reached.map(BigInt)))!==0n)throw Error('reached time mismatch');const complete=rcmp(t,q.T)===0n;if(cert.complete!==complete)throw Error('completion flag mismatch');return {verified:true,complete,steps:cert.steps.length,reached:t.map(String),minDistanceLower:minR===null?null:outDecimal(minR,24),contractionUpper:outDecimal(maxQ,24,true),endpoint:display(Y),maxPositionWidth:Math.max(...Y.slice(0,6).map(x=>approx(x[1]-x[0]))),maxStateWidth:Math.max(...Y.map(x=>approx(x[1]-x[0])))};}
const api={integrate,check,display,outDecimal,version:'1.3.0',BITS,_test:{S,Z,O,floor,ceil,isqrt,rat,parse,fromRat,dec,int,add,sub,neg,mul,div,sq,sqrt,field,geometry,coefficients,endpoint,tube,bounds,pack,unpack}};root.ThreeBodyValidated=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
