/* Experiments use the identical engine embedded in the simulator.
 * Refined RK45 is a numerical reference, never an exact oracle.
 * All trials begin at t=0, and aborts are retained instead of hidden.
 */
(function(root){
  'use strict';
  const P=root.ThreeBodyPhysics||(typeof require==='function'?require('./physics.js'):null);
  const fmt=(x)=>Number.isFinite(x)?(Math.abs(x)<1e-99?'0':x.toExponential(3)):'—';
  const methods=[['leapfrog',.02,'Leapfrog · Δt .02'],['leapfrog',.01,'Leapfrog · Δt .01'],['rk4',.02,'RK4 · Δt .02'],['rk4',.01,'RK4 · Δt .01'],['rk45',1e-8,'RK45 · tol 1e-8'],['rk45',1e-10,'RK45 · tol 1e-10'],['taylor',1e-10,'Taylor 16 · tol 1e-10']];
  function one(y,m,o,T){
    const start=performance.now();let s;
    try{s=new P.Simulator(y,m,o);s.advanceTo(T);return {sim:s,ok:true,ms:performance.now()-start};}
    catch(e){return {sim:s,ok:false,error:e.message,code:e.code,ms:performance.now()-start};}
  }
  function reference(y,m,o,T){return one(y,m,{...o,method:'rk45',rtol:1e-12,atol:1e-14,maxStep:.01,dt:.001},T);}
  function report(kind,title,columns,rows,note,extra={}){return {kind,title,columns,rows,note,createdAt:new Date().toISOString(),...extra};}
  function compare(data,emit){
    const {y,m,options,T}=data,ref=reference(y,m,options,T);
    if(!ref.ok)throw new Error('고정밀 기준 계산도 중단되었습니다: '+ref.error);
    const rows=[],raw=[];
    for(let i=0;i<methods.length;i++){
      const [method,h,label]=methods[i],adaptive=method==='rk45'||method==='taylor';
      emit({progress:(i+1)/8,label:label+' 계산 중'});
      const o={...options,method,dt:adaptive?.002:h,maxStep:adaptive?.02:h,rtol:adaptive?h:1e-10,atol:adaptive?h*.01:1e-12};
      const a=one(y,m,o,T);const diff=a.ok?P.rmsDifference(a.sim.y,ref.sim.y,true):NaN;
      rows.push([label,a.ok?fmt(diff):'중단',a.sim?fmt(a.sim.stats.maxEnergyError):'—',a.sim?String(a.sim.stats.steps):'—',a.ms.toFixed(1),a.ok?'완료':a.code]);
      raw.push({method,label,options:o,ok:a.ok,error:a.error,positionRMS:diff,stats:a.sim?.stats,ms:a.ms,finalTime:a.sim?.t});
    }
    const a=raw[0],b=raw[1],c=raw[2],d=raw[3];
    let note='기준은 RK45(rtol=1e-12, atol=1e-14, hmax=.01)입니다. 기준과의 차이는 엄밀한 실제 오차 상한이 아닙니다. 에너지 값은 적분 스텝에서 관측한 최대값입니다. CPU 시간은 기기·브라우저에 따라 달라집니다.';
    if(a.ok&&b.ok)note+=' Leapfrog 간격 절반의 위치 차이 감소비: '+(a.positionRMS/b.positionRMS).toFixed(2)+'배.';
    if(c.ok&&d.ok)note+=' RK4 감소비: '+(c.positionRMS/d.positionRMS).toFixed(2)+'배.';
    return report('compare','적분기 비교 · T='+T,['방법','위치 RMS 차이','max |ΔE / E*|','스텝','시간 ms','상태'],rows,note,{raw,reference:{options:ref.sim.o,stats:ref.sim.stats},input:data});
  }
  function reversal(data,emit){
    const {y,m,options,T}=data,rows=[],raw=[];
    for(let i=0;i<methods.length;i++){
      const [method,h,label]=methods[i],adaptive=method==='rk45'||method==='taylor';emit({progress:i/methods.length,label:label+' 왕복 계산'});
      const o={...options,method,dt:adaptive?.002:h,maxStep:adaptive?.02:h,rtol:adaptive?h:1e-10,atol:adaptive?h*.01:1e-12};
      const a=one(y,m,o,T);
      if(!a.ok){rows.push([label,'중단','—',a.code]);continue;}
      const rev=P.copy(a.sim.y);for(let k=6;k<12;k++)rev[k]*=-1;
      const b=one(rev,m,o,T);let err=NaN;
      if(b.ok){for(let k=6;k<12;k++)b.sim.y[k]*=-1;err=P.rmsDifference(b.sim.y,y);}
      rows.push([label,b.ok?fmt(err):'중단',String(a.sim.stats.steps+(b.sim?.stats.steps||0)),b.ok?'완료':b.code]);raw.push({method,ok:b.ok,returnStateRMS:err});
    }
    return report('reversal','시간 반전 · '+T+' + '+T,['방법','복귀 상태 RMS','총 스텝','상태'],rows,'T까지 진행 → 모든 속도 반전 → 다시 T만큼 진행 → 속도를 원래 방향으로 비교합니다. 위치와 속도를 함께 비교하는 무차원 RMS입니다. 잘 되돌아와도 궤도 자체가 정확하다는 보장은 아닙니다. 마지막 잔여 스텝과 적응형 시간 분할도 결과에 영향을 줍니다.',{raw,input:data});
  }
  function sensitivity(data,emit){
    const {y,m,options,T}=data,delta=data.delta||1e-6;
    const o={...options,method:'rk45',rtol:1e-11,atol:1e-13,maxStep:.02,dt:.002};
    const hi={...o,rtol:1e-12,atol:1e-14,maxStep:.01};
    const a=new P.Simulator(y,m,o),b=new P.Simulator(P.perturb(y,m,delta),m,o),c=new P.Simulator(y,m,hi),d=new P.Simulator(P.perturb(y,m,delta),m,hi);
    const initial=P.rmsDifference(a.y,b.y,true),rows=[],series=[];
    for(let k=1;k<=100;k++){
      const t=T*k/100;a.advanceTo(t);b.advanceTo(t);c.advanceTo(t);d.advanceTo(t);
      const separation=P.rmsDifference(a.y,b.y,true),hiSep=P.rmsDifference(c.y,d.y,true);
      const baselineDiff=P.rmsDifference(a.y,c.y,true),perturbedDiff=P.rmsDifference(b.y,d.y,true),numerical=Math.max(baselineDiff,perturbedDiff);
      series.push({t,separation,hiSeparation:hiSep,numerical});
      if(k%20===0)rows.push([t.toFixed(2),fmt(separation),fmt(hiSep),fmt(numerical),fmt(separation/Math.max(numerical,1e-300))]);
      if(k%10===0)emit({progress:k/100,label:'미세 섭동 + 정밀도 교차검사 · t='+t.toFixed(2)});
    }
    const last=series[series.length-1];
    return report('sensitivity','초기조건 민감도 · δ='+fmt(delta),['시간','섭동 위치 차이','고정밀 섭동 차이','정밀도 간 최대 차이','섭동 / 수치 차이'],rows,'물체 A의 x를 δ만큼 이동한 뒤, 전체 질량중심이 변하지 않게 평행이동합니다. 기본·섭동 양쪽을 더 엄격한 허용오차로 재계산했습니다. 큰 분리는 이 시간 구간의 민감도를 뜻하며 양의 Lyapunov 지수나 혼돈의 수학적 증명은 아닙니다. 두 정밀도의 일치는 오차 상한도 아닙니다.',{input:data,initialSeparation:initial,growth:last.separation/initial,series});
  }
  function benchmark(data,emit){
    const rows=[],checks=[];
    const add=(name,value,limit,passed,details)=>{rows.push([name,typeof value==='number'?fmt(value):value,typeof limit==='number'?fmt(limit):limit,passed?'PASS':'FAIL']);checks.push({name,value,limit,passed,details});};
    let i=0;const progress=label=>emit({progress:++i/10,label});
    const e=P.preset('equilateral');
    for(const [method,tol] of [['rk45',1e-10],['rk4',1e-10],['leapfrog',1e-10],['taylor',1e-10]]){
      progress(method+' 정확해 대조');const s=P.run(e.y,e.m,{method,rtol:tol},2);const er=P.rmsDifference(s.y,P.exactEquilateral(2),true);const limit=method==='leapfrog'?1e-6:1e-9;add('정삼각형 · '+method,er,limit,er<limit,{stats:s.stats,T:2});
    }
    progress('이전 급수 예제 대조');const as=P.preset('asymmetric'),s=P.run(as.y,as.m,{method:'taylor'},.1);
    const expected=[-.992083574684,.035348944346,.993487745792,-.014714676921,-.008297305634,.994693469832];const err=Math.max(...expected.map((x,k)=>Math.abs(x-s.y[k])));add('이전 예제 · t=.1',err,1e-11,err<1e-11,{expectedPrecision:'12 decimal places'});
    progress('8자 궤도 귀환 대조');const p=P.preset('figure8'),f=P.run(p.y,p.m,{method:'rk45',rtol:1e-11,atol:1e-13},p.period);const fe=P.rmsDifference(f.y,p.y,true);add('8자 · 근사 주기 귀환',fe,1e-5,fe<1e-5,{period:p.period,roundedInitialConditions:true});
    progress('힘 대칭·운동량 검사');const u=P.rhs(as.y,as.m,{...P.DEFAULTS}),force=Math.hypot(as.m.reduce((v,m,k)=>v+m*u[6+2*k],0),as.m.reduce((v,m,k)=>v+m*u[7+2*k],0));add('작용·반작용 합',force,1e-13,force<1e-13);
    progress('충돌 안전 중단 검사');let blocked=false;try{const z=e.y.slice();z[0]=z[2];z[1]=z[3];new P.Simulator(z,e.m);}catch(x){blocked=x.code==='COLLISION';}add('초기 중첩 거부',blocked?'차단':'미차단','차단',blocked);
    progress('고정 간격 근접 검사');let close=false;try{const z=[-.001,0,.001,0,1,0,0,0,0,0,0,0];P.run(z,[1,1,1],{method:'leapfrog',dt:.02},.02);}catch(x){close=x.code==='RESOLUTION';}add('고정 간격 부족 거부',close?'차단':'미차단','차단',close);
    progress('연화 힘·에너지 일치');const o={...P.DEFAULTS,epsilon:.05};const soft=P.run(as.y,as.m,o,.1);const sd=soft.measure();add('연화 모델 에너지',Math.abs(sd.dE),1e-7,Math.abs(sd.dE)<1e-7);
    const passed=checks.filter(x=>x.passed).length;
    return report('benchmark','내장 기준시험 · '+passed+'/'+checks.length,['시험','측정값','통과 기준','결과'],rows,'독립적인 정확해, 앞선 12자리 급수 결과, 근사 주기 귀환, 입력·근접 안전장치를 검사합니다. PASS는 이 시험 범위의 통과이며 모든 초기조건·모든 시간에서의 정확성 보증은 아닙니다. 소프트닝은 기본값 0이며 마지막 시험에서만 .05를 사용합니다.',{checks,passed,total:checks.length});
  }
  function execute(kind,data,emit=()=>{}){
    if(kind!=='benchmark'){
      if(!Number.isFinite(data.T)||data.T<.01||data.T>60)throw new Error('실험 시간은 .01~60 범위여야 합니다.');
      P.validate(data.y,data.m,{...P.DEFAULTS,...data.options});
    }
    if(kind==='compare')return compare(data,emit);
    if(kind==='reversal')return reversal(data,emit);
    if(kind==='sensitivity')return sensitivity(data,emit);
    if(kind==='benchmark')return benchmark(data,emit);
    throw new Error('알 수 없는 실험입니다.');
  }
  root.ThreeBodyExperiments={execute,one};
  if(typeof module!=='undefined'&&module.exports)module.exports=root.ThreeBodyExperiments;
})(typeof globalThis!=='undefined'?globalThis:this);
