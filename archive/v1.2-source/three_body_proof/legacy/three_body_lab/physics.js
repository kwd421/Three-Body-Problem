/* Three Body Lab v1.1.0 — dimensionless planar Newtonian point masses.
 * Original implementation, MIT license. No external runtime dependencies.
 * State = [x1,y1,x2,y2,x3,y3,vx1,vy1,vx2,vy2,vx3,vy3].
 * DP5(4): Dormand & Prince (1980); Taylor recurrence: previous local-series demo.
 * This is an experimental double-precision solver, not an interval certificate.
 */
(function (root) {
  'use strict';
  const VERSION = '1.1.0';
  const PAIRS = [[0, 1], [0, 2], [1, 2]];
  const DEFAULTS = { method: 'rk45', rtol: 1e-10, atol: 1e-12, dt: .002,
    maxStep: .02, minStep: 1e-12, G: 1, epsilon: 0, stopRadius: 1e-5,
    encounterFactor: .15, guardFixed: true };
  const copy = x => Float64Array.from(x);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  class SolverError extends Error {
    constructor(code, message) { super(message); this.name = 'SolverError'; this.code = code; }
  }
  function validate(y, m, o = DEFAULTS) {
    if (!y || y.length !== 12 || !m || m.length !== 3) throw new SolverError('INPUT', '위치·속도 12개와 질량 3개가 필요합니다.');
    for (const x of y) if (!Number.isFinite(x) || Math.abs(x) > 1e8) throw new SolverError('INPUT', '위치·속도는 유한한 수이며 절댓값이 1e8 이하여야 합니다.');
    for (const x of m) if (!Number.isFinite(x) || x < 1e-8 || x > 1e8) throw new SolverError('INPUT', '질량은 1e-8 이상 1e8 이하의 양수여야 합니다.');
    if (!['rk45', 'rk4', 'leapfrog', 'taylor'].includes(o.method)) throw new SolverError('INPUT', '지원하지 않는 적분기입니다.');
    for (const k of ['rtol', 'atol', 'dt', 'maxStep', 'minStep', 'G', 'stopRadius', 'encounterFactor']) {
      if (!Number.isFinite(o[k]) || o[k] <= 0) throw new SolverError('INPUT', k + '는 유한한 양수여야 합니다.');
    }
    if (o.rtol < 1e-14 || o.rtol > .01 || o.atol < 1e-16 || o.atol > .01) throw new SolverError('INPUT', '허용오차 범위를 벗어났습니다.');
    if (o.dt < 1e-8 || o.dt > 1 || o.maxStep > 1 || o.minStep > o.maxStep || o.minStep > o.dt) throw new SolverError('INPUT', '시간 간격 범위를 벗어났습니다.');
    if (!Number.isFinite(o.epsilon) || o.epsilon < 0 || o.epsilon > 10) throw new SolverError('INPUT', '연화 길이는 0 이상 10 이하여야 합니다.');
    if (o.G > 1e8 || o.stopRadius > 1e6 || o.encounterFactor > .5) throw new SolverError('INPUT', '물리·안전 설정 범위를 벗어났습니다.');
    if (o.epsilon === 0 && minDistance(y) <= o.stopRadius) throw new SolverError('COLLISION', '초기 두 물체가 중첩되었거나 안전 중단 거리 안에 있습니다.');
    return true;
  }
  function minDistance(y) {
    let d = Infinity;
    for (const [i, j] of PAIRS) d = Math.min(d, Math.hypot(y[2*j]-y[2*i], y[2*j+1]-y[2*i+1]));
    return d;
  }
  function center(y, m) {
    let cx=0,cy=0,vx=0,vy=0,M=0;
    for(let i=0;i<3;i++){ M+=m[i];cx+=m[i]*y[2*i];cy+=m[i]*y[2*i+1];vx+=m[i]*y[6+2*i];vy+=m[i]*y[7+2*i]; }
    return {x:cx/M,y:cy/M,vx:vx/M,vy:vy/M,M};
  }
  function recenter(y, m) {
    const s = copy(y), c = center(s,m);
    for(let i=0;i<3;i++){s[2*i]-=c.x;s[2*i+1]-=c.y;s[6+2*i]-=c.vx;s[7+2*i]-=c.vy;}
    return s;
  }
  function rhs(y, m, o, out = new Float64Array(12)) {
    out.fill(0);
    for(let k=0;k<6;k++) out[k]=y[k+6];
    for(const [i,j] of PAIRS){
      const dx=y[2*j]-y[2*i], dy=y[2*j+1]-y[2*i+1], d2=dx*dx+dy*dy;
      if(o.epsilon===0 && d2<=o.stopRadius*o.stopRadius) throw new SolverError('COLLISION','근접 안전 한계에 도달했습니다. 충돌을 임의로 통과시키지 않고 중단합니다.');
      const q=d2+o.epsilon*o.epsilon, inv=o.G/(q*Math.sqrt(q));
      const fx=dx*inv,fy=dy*inv;
      out[6+2*i]+=m[j]*fx;out[7+2*i]+=m[j]*fy;
      out[6+2*j]-=m[i]*fx;out[7+2*j]-=m[i]*fy;
    }
    for(const x of out) if(!Number.isFinite(x)) throw new SolverError('NONFINITE','비유한 가속도가 발생하여 중단했습니다.');
    return out;
  }
  function diagnostics(y,m,o){
    let K=0,U=0,L=0,px=0,py=0;
    for(let i=0;i<3;i++){
      const x=y[2*i],yy=y[2*i+1],vx=y[6+2*i],vy=y[7+2*i];
      K+=.5*m[i]*(vx*vx+vy*vy);L+=m[i]*(x*vy-yy*vx);px+=m[i]*vx;py+=m[i]*vy;
    }
    for(const [i,j] of PAIRS){const dx=y[2*j]-y[2*i],dy=y[2*j+1]-y[2*i+1];U-=o.G*m[i]*m[j]/Math.sqrt(dx*dx+dy*dy+o.epsilon*o.epsilon);}
    const c=center(y,m);
    return {K,U,E:K+U,L,px,py,cx:c.x,cy:c.y,cvx:c.vx,cvy:c.vy,minR:minDistance(y)};
  }
  function encounterTime(y,m,o){
    let tau=Infinity;
    for(const [i,j] of PAIRS){
      const d=Math.hypot(y[2*j]-y[2*i],y[2*j+1]-y[2*i+1],o.epsilon);
      const v=Math.hypot(y[6+2*j]-y[6+2*i],y[7+2*j]-y[7+2*i]);
      tau=Math.min(tau,Math.sqrt(d*d*d/(o.G*(m[i]+m[j]))),d/Math.max(v,1e-100));
    }
    return tau;
  }
  function scaledError(a,b,y,o,divisor=1){
    let sum=0;
    for(let i=0;i<12;i++){const e=(a[i]-b[i])/(divisor*(o.atol+o.rtol*Math.max(Math.abs(y[i]),Math.abs(a[i]))));sum+=e*e;}
    return Math.sqrt(sum/12);
  }
  const DP_A=[[],[1/5],[3/40,9/40],[44/45,-56/15,32/9],[19372/6561,-25360/2187,64448/6561,-212/729],[9017/3168,-355/33,46732/5247,49/176,-5103/18656],[35/384,0,500/1113,125/192,-2187/6784,11/84]];
  const DP_B=[35/384,0,500/1113,125/192,-2187/6784,11/84,0];
  const DP_LOW=[5179/57600,0,7571/16695,393/640,-92097/339200,187/2100,1/40];
  function dpStep(y,h,m,o){
    const k=[],temp=new Float64Array(12);
    for(let s=0;s<7;s++){
      for(let z=0;z<12;z++){let v=y[z];for(let j=0;j<s;j++)v+=h*DP_A[s][j]*k[j][z];temp[z]=v;}
      k.push(rhs(temp,m,o));
    }
    const high=copy(y),low=copy(y);
    for(let z=0;z<12;z++)for(let j=0;j<7;j++){high[z]+=h*DP_B[j]*k[j][z];low[z]+=h*DP_LOW[j]*k[j][z];}
    return {y:high,error:scaledError(high,low,y,o),evals:7,exponent:1/5};
  }
  function rk4Step(y,h,m,o){
    const k1=rhs(y,m,o),temp=new Float64Array(12);
    for(let i=0;i<12;i++)temp[i]=y[i]+h*k1[i]/2;
    const k2=rhs(temp,m,o);
    for(let i=0;i<12;i++)temp[i]=y[i]+h*k2[i]/2;
    const k3=rhs(temp,m,o);
    for(let i=0;i<12;i++)temp[i]=y[i]+h*k3[i];
    const k4=rhs(temp,m,o),out=new Float64Array(12);
    for(let i=0;i<12;i++)out[i]=y[i]+h*(k1[i]+2*k2[i]+2*k3[i]+k4[i])/6;
    return {y:out,error:0,evals:4};
  }
  function leapfrogStep(y,h,m,o){
    const f=rhs(y,m,o),out=copy(y);
    for(let i=0;i<6;i++){out[i+6]+=h*f[i+6]/2;out[i]+=h*out[i+6];}
    const g=rhs(out,m,o);
    for(let i=0;i<6;i++)out[i+6]+=h*g[i+6]/2;
    return {y:out,error:0,evals:2};
  }
  // Position polynomial degree 17 and differentiated velocity degree 16.
  // Therefore the full-state method has order 16; evaluated afresh each step.
  function taylorPolynomial(y,h,m,o,degree=17){
    const a=Array.from({length:degree+1},()=>new Float64Array(6));a[0].set(y.subarray(0,6));a[1].set(y.subarray(6));
    const pairs=PAIRS.map(([i,j])=>({i,j,dx:new Float64Array(degree-1),dy:new Float64Array(degree-1),s:new Float64Array(degree-1),b:new Float64Array(degree-1)}));
    for(let n=0;n<=degree-2;n++){
      for(const p of pairs){
        const {i,j,dx,dy,s,b}=p;dx[n]=a[n][2*j]-a[n][2*i];dy[n]=a[n][2*j+1]-a[n][2*i+1];
        let sn=0;for(let k=0;k<=n;k++)sn+=dx[k]*dx[n-k]+dy[k]*dy[n-k];
        s[n]=sn+(n===0?o.epsilon*o.epsilon:0);
        if(n===0){if(o.epsilon===0&&sn<=o.stopRadius*o.stopRadius)throw new SolverError('COLLISION','Taylor 전개 중심이 안전 거리 안에 있습니다.');b[0]=s[0]**(-1.5);}
        else {let bn=0;for(let k=1;k<=n;k++)bn+=(n+k/2)*s[k]*b[n-k];b[n]=-bn/(n*s[0]);}
        let fx=0,fy=0;for(let k=0;k<=n;k++){fx+=dx[k]*b[n-k];fy+=dy[k]*b[n-k];}
        const f=o.G/((n+1)*(n+2));
        a[n+2][2*i]+=f*m[j]*fx;a[n+2][2*i+1]+=f*m[j]*fy;
        a[n+2][2*j]-=f*m[i]*fx;a[n+2][2*j+1]-=f*m[i]*fy;
      }
    }
    const out=new Float64Array(12);
    for(let z=0;z<6;z++){
      let r=0,v=0;for(let n=degree;n>=0;n--)r=r*h+a[n][z];for(let n=degree;n>=1;n--)v=v*h+n*a[n][z];out[z]=r;out[z+6]=v;
    }
    return out;
  }
  function taylorStep(y,h,m,o){
    const full=taylorPolynomial(y,h,m,o),half=taylorPolynomial(y,h/2,m,o),fine=taylorPolynomial(half,h/2,m,o);
    return {y:fine,error:scaledError(fine,full,y,o,65535),evals:0,exponent:1/17};
  }
  class Simulator {
    constructor(y,m,options={}){
      this.o={...DEFAULTS,...options};validate(y,m,this.o);this.y=copy(y);this.initial=copy(y);this.m=copy(m);this.t=0;this.timeComp=0;
      this.h=Math.min(this.o.maxStep,this.o.dt);this.stats={steps:0,rejected:0,evals:0,lastH:0,minH:Infinity,maxH:0,maxEnergyError:0,minR:Infinity};
      this.base=diagnostics(y,m,this.o);this.energyScale=Math.max(Math.abs(this.base.E),1e-12*(this.base.K+Math.abs(this.base.U)),1e-30);
      this.LScale=Math.max(1,Math.abs(this.base.L));this.status='ready';this.stopReason='';this.stopCode='';this.measure();
    }
    measure(){
      const d=diagnostics(this.y,this.m,this.o);d.dE=(d.E-this.base.E)/this.energyScale;d.dL=d.L-this.base.L;d.dP=Math.hypot(d.px-this.base.px,d.py-this.base.py);
      d.comError=Math.hypot(d.cx-this.base.cx-this.base.cvx*this.t,d.cy-this.base.cy-this.base.cvy*this.t);
      this.stats.maxEnergyError=Math.max(this.stats.maxEnergyError,Math.abs(d.dE));this.stats.minR=Math.min(this.stats.minR,d.minR);return d;
    }
    stepTo(target){
      if(!Number.isFinite(target)||target<this.t-1e-12)throw new SolverError('TIME','목표 시간은 현재 시간 이상이어야 합니다.');
      const remaining=target-this.t;
      if(remaining<=8*Number.EPSILON*Math.max(1,Math.abs(target))){this.t=target;this.timeComp=0;return false;}
      if(this.status==='stopped')throw new SolverError(this.stopCode,this.stopReason);
      const adaptive=this.o.method==='rk45'||this.o.method==='taylor';
      let h=Math.min(remaining,adaptive?this.h:this.o.dt,this.o.maxStep);
      const cap=this.o.encounterFactor*encounterTime(this.y,this.m,this.o);
      if(adaptive)h=Math.min(h,cap);
      else if(this.o.guardFixed&&h>cap) return this.fail('RESOLUTION','고정 시간 간격이 근접 운동에 비해 큽니다. Δt를 줄이거나 RK45로 전환하세요.');
      let result,attempt=0;
      while(true){
        if(h<this.o.minStep||this.t+h===this.t)return this.fail('MIN_STEP','필요 시간 간격이 최소 한계보다 작습니다. 정칙화 또는 더 높은 정밀도가 필요합니다.');
        try{
          if(this.o.method==='rk45')result=dpStep(this.y,h,this.m,this.o);
          else if(this.o.method==='taylor')result=taylorStep(this.y,h,this.m,this.o);
          else if(this.o.method==='rk4')result=rk4Step(this.y,h,this.m,this.o);
          else result=leapfrogStep(this.y,h,this.m,this.o);
          this.stats.evals+=result.evals;
          if(!Array.from(result.y).every(Number.isFinite))throw new SolverError('NONFINITE','계산이 유한 범위를 벗어났습니다.');
          if(this.o.epsilon===0&&minDistance(result.y)<=this.o.stopRadius)throw new SolverError('COLLISION','근접 안전 한계에 도달했습니다.');
        }catch(e){
          if(adaptive&&(e.code==='COLLISION'||e.code==='NONFINITE')&&attempt<40){h*=.25;this.stats.rejected++;attempt++;continue;}
          return this.fail(e.code||'NUMERIC',e.message);
        }
        if(!adaptive||result.error<=1){
          this.y=result.y;
          // Compensated time summation prevents a spurious tiny final step
          // after many fixed steps (e.g. 300 * .02 landing just below 6).
          const correctedH=h-this.timeComp,nextT=this.t+correctedH;
          this.timeComp=(nextT-this.t)-correctedH;this.t=nextT;this.stats.steps++;this.stats.lastH=h;this.stats.minH=Math.min(this.stats.minH,h);this.stats.maxH=Math.max(this.stats.maxH,h);
          if(adaptive)this.h=Math.min(this.o.maxStep,h*clamp(result.error===0?4:.9*result.error**(-result.exponent),.2,4));
          this.status='running';this.measure();return true;
        }
        this.stats.rejected++;attempt++;
        if(attempt>50)return this.fail('REJECTIONS','오차 허용 기준을 만족하지 못해 중단했습니다.');
        h*=clamp(.9*result.error**(-result.exponent),.1,.5);
      }
    }
    fail(code,message){this.status='stopped';this.stopCode=code;this.stopReason=message;throw new SolverError(code,message);}
    advanceTo(target,maxSteps=500000){
      if(!Number.isFinite(target)||target<this.t)throw new SolverError('TIME','목표 시간은 현재 시간 이상의 유한한 수여야 합니다.');
      if(!Number.isInteger(maxSteps)||maxSteps<1||maxSteps>5000000)throw new SolverError('BUDGET','스텝 예산은 1~5000000의 정수여야 합니다.');
      let steps=0;
      while(this.t<target-8*Number.EPSILON*Math.max(1,target)){
        this.stepTo(target);if(++steps>maxSteps)return this.fail('BUDGET','계산 스텝 한도를 초과했습니다.');
      }
      this.t=target;this.timeComp=0;return this.y;
    }
  }
  function rmsDifference(a,b,positionsOnly=false){let s=0;const n=positionsOnly?6:12;for(let i=0;i<n;i++)s+=(a[i]-b[i])**2;return Math.sqrt(s/n);}
  function relativeStateDifference(a,b){let s=0,n=0;for(let i=0;i<12;i++){s+=(a[i]-b[i])**2;n+=b[i]**2;}return Math.sqrt(s/Math.max(n,1e-30));}
  function perturb(y,m,delta){const out=copy(y),M=m[0]+m[1]+m[2];out[0]+=delta;const shift=delta*m[0]/M;for(let i=0;i<3;i++)out[2*i]-=shift;return out;}
  function mulberry32(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
  function preset(id,seed=314159){
    let y,m,title,description,period=null;
    if(id==='figure8'){
      // A rotation by pi of Montgomery / Simo's published rounded conditions.
      m=[1,1,1];y=[.97000436,-.24308753,-.97000436,.24308753,0,0,.466203685,.43236573,.466203685,.43236573,-.93240737,-.86473146];
      title='8자 궤도';description='세 물체가 같은 8자를 따라가는 주기궤도. 출판된 반올림 초기값이므로 완벽한 폐곡선은 아닙니다.';period=6.32591398;
    }else if(id==='equilateral'){
      m=[1,1,1];y=new Array(12).fill(0);const w=3**(-.25);
      for(let i=0;i<3;i++){const a=2*Math.PI*i/3;y[2*i]=Math.cos(a);y[2*i+1]=Math.sin(a);y[6+2*i]=-w*Math.sin(a);y[7+2*i]=w*Math.cos(a);}
      title='정삼각형 회전';description='정확한 원운동 해와 직접 비교하는 기준시험. 작은 오차나 섭동에도 대칭은 깨질 수 있습니다.';period=2*Math.PI/w;
    }else if(id==='asymmetric'){
      m=[1,2,3];y=[-1,0,1,0,0,1,0,.3,0,-.2,-.1,0];title='이전 비대칭 예제';description='앞서 Taylor 급수로 검산한 질량 1·2·3의 동일 초기조건. 질량중심 이동도 그대로 보존합니다.';
    }else if(id==='butterfly'){
      const p=preset('random',19);m=p.m;y=p.y;title='민감도 실험';description='시드 19의 비대칭 초기조건. 위치를 아주 조금 바꾼 복제 궤도와, 정밀도만 높인 궤도를 나란히 검사합니다.';
    }else if(id==='closepass'){
      m=[1,1,1];y=[-1,0,1,0,.18,.86,.1,.28,-.15,-.22,.05,-.06];y=recenter(y,m);title='극근접 스트레스';description='매우 작은 근접 거리에서 수치 오차가 증폭되는 스트레스 시험. 궤도 차이를 곧바로 혼돈의 증거로 해석하지 마세요.';
    }else if(id==='hierarchy'){
      m=[1,1,.25];const R=3.8,M=2.25,vRel=Math.sqrt(M/R);const vb=-.25/M*vRel,vo=2/M*vRel;
      y=[-.5,-.25/M*R,.5,-.25/M*R,0,2/M*R,.25/M*vRel,-Math.sqrt(.5),.25/M*vRel,Math.sqrt(.5),-2/M*vRel,0];
      title='쌍성 + 바깥 천체';description='가까운 쌍성과 바깥 동반성. 서로 다른 운동 시간척도를 비교하는 초기조건이며 정확한 원궤도 해는 아닙니다.';
    }else if(id==='random'){
      const rng=mulberry32(seed>>>0);m=[.5+rng(),.5+rng(),.5+rng()];y=new Array(12).fill(0);
      for(let i=0;i<3;i++){const a=2*Math.PI*i/3+(rng()-.5)*.5,r=.75+rng()*.5;y[2*i]=r*Math.cos(a);y[2*i+1]=r*Math.sin(a);y[6+2*i]=(rng()-.5)*.7;y[7+2*i]=(rng()-.5)*.7;}
      y=recenter(y,m);title='시드 랜덤';description='시드 '+(seed>>>0)+'로 재현 가능한 초기조건. 같은 시드와 설정이면 같은 계산을 반복합니다.';
    }else throw new SolverError('INPUT','알 수 없는 프리셋입니다.');
    return {id,title,description,y:Array.from(y),m,period,seed:seed>>>0};
  }
  function exactEquilateral(t){const y=new Float64Array(12),w=3**(-.25);for(let i=0;i<3;i++){const a=2*Math.PI*i/3+w*t;y[2*i]=Math.cos(a);y[2*i+1]=Math.sin(a);y[6+2*i]=-w*Math.sin(a);y[7+2*i]=w*Math.cos(a);}return y;}
  function run(y,m,o,T){const s=new Simulator(y,m,o);s.advanceTo(T);return s;}
  const API={VERSION,DEFAULTS,PAIRS,SolverError,validate,copy,minDistance,center,recenter,rhs,diagnostics,encounterTime,Simulator,rmsDifference,relativeStateDifference,perturb,preset,exactEquilateral,taylorPolynomial,run,mulberry32};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;
  root.ThreeBodyPhysics=API;
})(typeof globalThis!=='undefined'?globalThis:this);
