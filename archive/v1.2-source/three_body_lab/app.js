/* Browser interface. No network, no external assets, no storage permission. */
(function(){
  'use strict';
  const P=ThreeBodyPhysics,$=id=>document.getElementById(id),all=s=>Array.from(document.querySelectorAll(s));
  const COLORS=['#63e1da','#ff907e','#f0ca75'],NAMES=['A','B','C'],SAMPLE=.02,CAPACITY=6000;
  let sim,ghostSim=null,presetInfo,initialY,initialM,draftY,draftM,selected=0,dirty=false;
  let playing=true,singleStep=false,accumulator=0,pendingTarget=null,sampleIndex=0,displayY,displayGhost=null,displayD=null;
  let records=new Array(CAPACITY),count=0,head=0,frameCount=0,prevTime=0,metricTime=0,fpsEpoch=0,fpsFrames=0,fps=60;
  let worker=null,workerUrl=null,reports=[],toastTimer=null,stopFlag=false,activeModal=null,returnFocus=null;
  const camera={x:0,y:0,scale:170,auto:true},view={w:600,h:600,dpr:1},canvas=$('universe'),ctx=canvas.getContext('2d');
  let pointer=null,hoverBody=-1;
  function numberString(x){if(!Number.isFinite(x))return '—';if(x===0)return '0';return Math.abs(x)<.001||Math.abs(x)>=1e4?x.toExponential(2):x.toFixed(4);}
  function sci(x){return Number.isFinite(x)?(x===0?'0':x.toExponential(2)):'—';}
  function short(x){return Number.isFinite(x)?String(Number(x.toPrecision(13))):'';}
  function notify(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
  function modal(id){if(activeModal)closeModal();activeModal=id;returnFocus=document.activeElement;$(id).classList.add('open');$(id).querySelector('button')?.focus();}
  function closeModal(){if(activeModal){$(activeModal).classList.remove('open');activeModal=null;returnFocus?.focus();}}
  function recordAt(i){return records[(head-count+i+CAPACITY)%CAPACITY];}
  function history(){return Array.from({length:count},(_,i)=>recordAt(i));}
  function capture(){
    displayY=P.copy(sim.y);displayGhost=ghostSim?P.copy(ghostSim.y):null;displayD=sim.measure();
    const r={t:sim.t,y:Array.from(displayY),ghost:displayGhost?Array.from(displayGhost):null,d:{...displayD},h:sim.stats.lastH,steps:sim.stats.steps,
      separation:displayGhost?P.rmsDifference(displayY,displayGhost,true):null};
    records[head]=r;head=(head+1)%CAPACITY;count=Math.min(CAPACITY,count+1);
  }
  function clearHistory(){records=new Array(CAPACITY);count=0;head=0;sampleIndex=0;accumulator=0;pendingTarget=null;}
  function currentOptions(){const method=$('method').value,rtol=Number($('tolerance').value),dt=Number($('dt').value);return {...P.DEFAULTS,method,rtol,atol:rtol/100,dt,maxStep:(method==='rk4'||method==='leapfrog')?dt:.02,epsilon:Number($('epsilon').value)};}
  function updateMethodControls(){const adaptive=$('method').value==='rk45'||$('method').value==='taylor';$('tolerance').disabled=!adaptive;$('dt').disabled=adaptive;}
  function markDirty(){dirty=true;$('apply').disabled=false;$('dirty').classList.add('on');}
  function clearDirty(){dirty=false;$('apply').disabled=true;$('dirty').classList.remove('on');}
  function syncEditor(){
    $('mass').value=short(draftM[selected]);$('posx').value=short(draftY[2*selected]);$('posy').value=short(draftY[2*selected+1]);$('velx').value=short(draftY[6+2*selected]);$('vely').value=short(draftY[7+2*selected]);
    all('[data-body]').forEach(b=>b.classList.toggle('active',Number(b.dataset.body)===selected));
  }
  function setPlaying(v){playing=!!v&&!stopFlag;singleStep=false;accumulator=0;$('play').textContent=playing?'Ⅱ 일시정지':'▷ 재생';$('step').disabled=playing||stopFlag;$('play').disabled=stopFlag;updateReadouts();}
  function reset(keepPlaying=playing,options=null){
    try{
      const o=options||sim?.o||currentOptions();
      const next=new P.Simulator(initialY,initialM,o);
      const nextGhost=$('ghost').checked?new P.Simulator(P.perturb(initialY,initialM,Number($('delta').value)),initialM,o):null;
      sim=next;ghostSim=nextGhost;stopFlag=false;clearHistory();capture();$('view-message').classList.remove('visible');
      $('ghost-legend').hidden=!ghostSim;setPlaying(keepPlaying);updateReadouts();drawCharts();
    }catch(e){notify(e.message);return false;}return true;
  }
  function updateScenario(){
    $('scenario-title').textContent=presetInfo.title;$('scenario-desc').textContent=presetInfo.description;
    $('period-info').textContent=presetInfo.period?'T ≈ '+presetInfo.period.toFixed(6):'G = 1 · 단위 없음';
    all('[data-preset]').forEach(b=>b.classList.toggle('active',b.dataset.preset===presetInfo.id));
  }
  function loadPreset(id){
    if(worker)cancelExperiment();
    try{
      const seed=Number($('seed').value);if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('시드는 0~4294967295의 정수여야 합니다.');
      presetInfo=P.preset(id,seed);initialY=P.copy(presetInfo.y);initialM=P.copy(presetInfo.m);draftY=P.copy(initialY);draftM=P.copy(initialM);
      if(id==='butterfly')$('ghost').checked=true;
      clearDirty();syncEditor();updateScenario();reset(true,currentOptions());fitCamera(true);
    }catch(e){notify(e.message);}
  }
  function applyDraft(){
    try{
      const o=currentOptions();P.validate(draftY,draftM,o);
      initialY=P.copy(draftY);initialM=P.copy(draftM);
      presetInfo={id:'custom',title:'사용자 초기조건',description:'직접 편집한 시작 상태입니다. 내장 기준시험과 별도로 적분기 비교·시간 반전·민감도 실험을 실행해 보세요.',period:null};
      updateScenario();clearDirty();reset(false,o);fitCamera(true);notify('새 초기조건을 적용했습니다. t = 0에서 재생하세요.');
    }catch(e){notify(e.message);}
  }
  function stopped(error){
    stopFlag=true;playing=false;singleStep=false;accumulator=0;displayY=P.copy(sim.y);displayD=sim.measure();displayGhost=null;
    $('view-message').textContent='계산 중단 · '+error.message;$('view-message').classList.add('visible');setPlaying(false);
    $('quality').textContent='안전 중단 · 초기조건이나 계산 설정을 바꾸고 다시 시작하세요.';$('quality').classList.add('warn');
  }
  function advanceBudget(ms=8){
    const start=performance.now();let loops=0;
    while((playing||singleStep)&&!stopFlag&&(accumulator>=SAMPLE||pendingTarget!==null||singleStep)){
      if(pendingTarget===null)pendingTarget=(sampleIndex+1)*SAMPLE;
      try{
        if(sim.t<pendingTarget-1e-14)sim.stepTo(pendingTarget);
        else if(ghostSim&&ghostSim.t<pendingTarget-1e-14)ghostSim.stepTo(pendingTarget);
        else{
          sim.t=pendingTarget;if(ghostSim)ghostSim.t=pendingTarget;capture();sampleIndex++;pendingTarget=null;accumulator=Math.max(0,accumulator-SAMPLE);
          if(singleStep){singleStep=false;break;}
        }
      }catch(e){stopped(e);break;}
      if(++loops>30000||performance.now()-start>ms)break;
    }
  }
  function updateReadouts(){
    if(!sim||!displayD)return;
    const d=displayD,t=count?recordAt(count-1).t:sim.t;
    $('time').textContent=(stopFlag?sim.t:t).toFixed(3);
    $('energy').textContent=sci(Math.abs(d.dE));$('max-energy').textContent=sci(sim.stats.maxEnergyError);
    $('angular').textContent=sci(Math.abs(d.dL));$('momentum').textContent=sci(d.dP);$('com-error').textContent=sci(d.comError);
    $('distance').textContent=numberString(d.minR);$('last-h').textContent=sim.stats.lastH?sci(sim.stats.lastH):'—';
    $('separation').textContent=displayGhost?sci(P.rmsDifference(displayY,displayGhost,true)):($('ghost').checked&&stopFlag?'비교 중단':'꺼짐');
    $('run-status').textContent=(stopFlag?'STOPPED':playing?'RUNNING':'PAUSED')+' · '+sim.o.method.toUpperCase()+(sim.o.epsilon>0?' · ε='+sim.o.epsilon:'');
    $('step-status').textContent=sim.stats.steps.toLocaleString()+' STEPS / '+sim.stats.rejected+' REJECT';$('fps-status').textContent=Math.round(fps)+' FPS';
    if(!stopFlag){
      const warn=sim.stats.maxEnergyError>1e-6;$('quality').classList.toggle('warn',warn);
      $('quality').textContent=warn?'에너지 변화가 큽니다. 정밀도를 높이고 적분기 비교를 확인하세요.':sim.o.epsilon>0?'연화된 중력 모델입니다. 원래 뉴턴 중력과 다른 방정식입니다.':'에너지 보존만으로 궤도 정확성을 판단하지 않습니다.';
    }
  }
  function resize(){
    const r=$('viewport').getBoundingClientRect();view.w=r.width;view.h=r.height;view.dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(view.w*view.dpr);canvas.height=Math.round(view.h*view.dpr);ctx.setTransform(view.dpr,0,0,view.dpr,0,0);drawCharts();
  }
  function screen(x,y){return [(x-camera.x)*camera.scale+view.w/2,view.h*.56-(y-camera.y)*camera.scale];}
  function world(x,y){return [(x-view.w/2)/camera.scale+camera.x,(view.h*.56-y)/camera.scale+camera.y];}
  function fitCamera(immediate=false){
    if(!displayY)return;
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    const add=y=>{if(!y)return;for(let k=0;k<6;k+=2){xmin=Math.min(xmin,y[k]);xmax=Math.max(xmax,y[k]);ymin=Math.min(ymin,y[k+1]);ymax=Math.max(ymax,y[k+1]);}};
    add(displayY);add(displayGhost);
    const length=Number($('trail').value),t=sim?.t||0;
    for(let i=Math.max(0,count-Math.ceil(length/SAMPLE));i<count;i+=4){const r=recordAt(i);if(r.t>=t-length){add(r.y);add(r.ghost);}}
    const cx=(xmin+xmax)/2,cy=(ymin+ymax)/2;
    const scale=Math.min(Math.max(80,view.w-92)/Math.max(2.9,(xmax-xmin)*1.22),Math.max(100,view.h-225)/Math.max(2,(ymax-ymin)*1.28));
    const f=immediate?1:.045;camera.x+=(cx-camera.x)*f;camera.y+=(cy-camera.y)*f;camera.scale+=(Math.max(.00001,Math.min(1e5,scale))-camera.scale)*f;
    if(immediate){camera.auto=true;$('fit').classList.add('active');}
  }
  function niceStep(raw){const base=10**Math.floor(Math.log10(raw)),x=raw/base;return (x<2?2:x<5?5:10)*base;}
  function drawGrid(){
    if(!$('grid').checked)return;
    const spacing=niceStep(65/camera.scale),lo=world(0,view.h),hi=world(view.w,0);
    ctx.lineWidth=1;ctx.strokeStyle='#172635';ctx.beginPath();
    let n=0;for(let x=Math.floor(lo[0]/spacing)*spacing;x<=hi[0]&&n++<100;x+=spacing){const sx=screen(x,0)[0];ctx.moveTo(sx,0);ctx.lineTo(sx,view.h);}
    n=0;for(let y=Math.floor(lo[1]/spacing)*spacing;y<=hi[1]&&n++<100;y+=spacing){const sy=screen(0,y)[1];ctx.moveTo(0,sy);ctx.lineTo(view.w,sy);}ctx.stroke();
    const origin=screen(0,0);ctx.strokeStyle='#233a4b';ctx.setLineDash([3,5]);ctx.beginPath();ctx.moveTo(origin[0],0);ctx.lineTo(origin[0],view.h);ctx.moveTo(0,origin[1]);ctx.lineTo(view.w,origin[1]);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle='#47657b';ctx.font='9px '+getComputedStyle(document.documentElement).getPropertyValue('--mono');
    const bar=spacing*camera.scale;ctx.fillText(short(spacing)+' units',22,view.h-52);ctx.strokeStyle='#56748a';ctx.beginPath();ctx.moveTo(22,view.h-63);ctx.lineTo(22+bar,view.h-63);ctx.moveTo(22,view.h-66);ctx.lineTo(22,view.h-60);ctx.moveTo(22+bar,view.h-66);ctx.lineTo(22+bar,view.h-60);ctx.stroke();
  }
  function pathBody(body,isGhost=false){
    const t=sim.t,length=Number($('trail').value),start=Math.max(0,count-Math.ceil(length/SAMPLE));
    const available=count-start;if(available<2)return;
    ctx.strokeStyle=COLORS[body];ctx.lineWidth=isGhost?1:1.8;ctx.setLineDash(isGhost?[4,6]:[]);
    const groups=8;
    for(let g=0;g<groups;g++){
      const a=start+Math.floor(available*g/groups),b=Math.min(count-1,start+Math.ceil(available*(g+1)/groups));
      ctx.globalAlpha=(isGhost?.48:.85)*(.12+.88*(g+1)/groups);ctx.beginPath();let prev=null;
      for(let i=a;i<=b;i++){
        const r=recordAt(i),y=isGhost?r.ghost:r.y;if(!y||r.t<t-length){prev=null;continue;}
        const p=screen(y[body*2],y[body*2+1]);
        if(!prev)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);prev=p;
      }ctx.stroke();
    }
    ctx.globalAlpha=1;ctx.setLineDash([]);
  }
  function arrow(a,b,color){
    const dx=b[0]-a[0],dy=b[1]-a[1],ang=Math.atan2(dy,dx);if(Math.hypot(dx,dy)<2)return;
    ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.beginPath();ctx.moveTo(...b);ctx.lineTo(b[0]-6*Math.cos(ang-.4),b[1]-6*Math.sin(ang-.4));ctx.lineTo(b[0]-6*Math.cos(ang+.4),b[1]-6*Math.sin(ang+.4));ctx.closePath();ctx.fill();
  }
  function draw(){
    if(!displayY)return;
    if(camera.auto&&!pointer)fitCamera();
    ctx.setTransform(view.dpr,0,0,view.dpr,0,0);ctx.clearRect(0,0,view.w,view.h);ctx.fillStyle='#090f18';ctx.fillRect(0,0,view.w,view.h);
    const glow=ctx.createRadialGradient(view.w*.5,view.h*.58,0,view.w*.5,view.h*.58,Math.max(view.w,view.h)*.6);glow.addColorStop(0,'#14223877');glow.addColorStop(1,'#0a101800');ctx.fillStyle=glow;ctx.fillRect(0,0,view.w,view.h);drawGrid();
    for(let b=0;b<3;b++){pathBody(b);if(displayGhost)pathBody(b,true);}
    if($('triangle').checked){ctx.strokeStyle='#8096ad44';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<3;i++){const p=screen(displayY[2*i],displayY[2*i+1]);if(i===0)ctx.moveTo(...p);else ctx.lineTo(...p);}ctx.closePath();ctx.stroke();}
    if(displayGhost){
      ctx.lineWidth=1.4;ctx.globalAlpha=.65;
      for(let i=0;i<3;i++){const p=screen(displayGhost[2*i],displayGhost[2*i+1]);ctx.strokeStyle=COLORS[i];ctx.beginPath();ctx.arc(p[0],p[1],7,0,Math.PI*2);ctx.stroke();}
      ctx.globalAlpha=1;
    }
    if($('barycenter').checked){
      const c=P.center(displayY,initialM),p=screen(c.x,c.y);ctx.strokeStyle='#8cabc27a';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p[0]-5,p[1]);ctx.lineTo(p[0]+5,p[1]);ctx.moveTo(p[0],p[1]-5);ctx.lineTo(p[0],p[1]+5);ctx.stroke();
    }
    for(let i=0;i<3;i++){
      const p=screen(displayY[2*i],displayY[2*i+1]),radius=Math.min(13,Math.max(4,5.7*Math.cbrt(initialM[i])));
      if(p[0]<-100||p[0]>view.w+100||p[1]<-100||p[1]>view.h+100)continue;
      if($('vectors').checked||pointer?.mode==='velocity'){const end=screen(displayY[2*i]+displayY[6+2*i]*.35,displayY[2*i+1]+displayY[7+2*i]*.35);arrow(p,end,COLORS[i]+'90');}
      const g=ctx.createRadialGradient(p[0],p[1],radius*.2,p[0],p[1],radius*4);g.addColorStop(0,COLORS[i]+'50');g.addColorStop(1,COLORS[i]+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(p[0],p[1],radius*4,0,Math.PI*2);ctx.fill();
      ctx.fillStyle=COLORS[i];ctx.beginPath();ctx.arc(p[0],p[1],radius,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffffbb';ctx.beginPath();ctx.arc(p[0]-radius*.22,p[1]-radius*.26,radius*.25,0,Math.PI*2);ctx.fill();
      if((hoverBody===i&&!playing)||pointer?.body===i){ctx.strokeStyle=COLORS[i]+'aa';ctx.beginPath();ctx.arc(p[0],p[1],radius+5,0,Math.PI*2);ctx.stroke();}
      ctx.fillStyle=COLORS[i];ctx.font='10px ui-monospace, monospace';ctx.fillText(NAMES[i],p[0]+radius+7,p[1]-radius-5);
    }
  }
  function lineChart(target,data,field,color,customRange=null){
    const c=typeof target==='string'?$(target):target,r=c.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    if(r.width<5||r.height<5)return;c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);
    const w=r.width,h=r.height,left=30,right=7,top=9,bottom=10;
    let vals=data.map(row=>Math.log10(Math.max(1e-16,Math.abs(field(row))))).filter(Number.isFinite);
    let low=-16,high=-5;
    if(customRange){[low,high]=customRange;}else if(vals.length){low=Math.min(-12,Math.floor(Math.min(...vals)));high=Math.max(low+3,Math.ceil(Math.max(...vals))+1);low=Math.max(-16,low);}
    g.font='9px ui-monospace, monospace';g.fillStyle='#59758c';g.lineWidth=1;
    for(let k=0;k<4;k++){const yy=top+(h-top-bottom)*k/3;g.strokeStyle='#253847';g.beginPath();g.moveTo(left,yy);g.lineTo(w-right,yy);g.stroke();g.fillText(String(Math.round(high-(high-low)*k/3)),0,yy+3);}
    if(data.length<2)return;
    const t0=data[0].t,t1=data[data.length-1].t;g.strokeStyle=color;g.lineWidth=1.5;g.beginPath();let begun=false;
    for(let i=0;i<data.length;i++){
      const val=field(data[i]);if(!Number.isFinite(val)){begun=false;continue;}
      const log=Math.log10(Math.max(1e-16,Math.abs(val))),x=left+(data[i].t-t0)/Math.max(1e-12,t1-t0)*(w-left-right),yy=top+(high-log)/(high-low)*(h-top-bottom);
      if(!begun){g.moveTo(x,Math.min(h-bottom,Math.max(top,yy)));begun=true;}else g.lineTo(x,Math.min(h-bottom,Math.max(top,yy)));
    }g.stroke();
  }
  function drawCharts(){
    if(!count)return;
    let data=history();const stride=Math.max(1,Math.floor(data.length/280));data=data.filter((r,i)=>i%stride===0||i===count-1);
    lineChart('energy-chart',data,r=>r.d.dE,COLORS[0]);$('chart-from').textContent='t '+data[0].t.toFixed(1);$('chart-to').textContent=data[data.length-1].t.toFixed(1);
  }
  function download(name,text,mime='application/json'){
    const url=URL.createObjectURL(new Blob([text],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
  }
  function config(){return {schema:'three-body-lab.initial.v1',version:P.VERSION,savedAt:new Date().toISOString(),note:'Initial conditions only. Not a playback checkpoint.',preset:{id:presetInfo.id,title:presetInfo.title,period:presetInfo.period},y:Array.from(initialY),m:Array.from(initialM),options:{...sim.o},seed:Number($('seed').value),comparison:{enabled:$('ghost').checked,delta:Number($('delta').value)}};}
  function save(){download('three-body-initial-'+presetInfo.id+'.json',JSON.stringify(config(),null,2));if(dirty)notify('아직 적용하지 않은 편집은 제외하고, 적용된 초기조건을 저장했습니다.');}
  function csv(){
    const rows=[['t','xA','yA','xB','yB','xC','yC','vxA','vyA','vxB','vyB','vxC','vyC','energy','normalized_energy_change','angular_momentum','momentum_change','com_error','min_distance','last_step','position_separation','method','epsilon','G','mA','mB','mC'].join(',')];
    for(const r of history())rows.push([r.t,...r.y,r.d.E,r.d.dE,r.d.L,r.d.dP,r.d.comError,r.d.minR,r.h,r.separation??'',sim.o.method,sim.o.epsilon,sim.o.G,...initialM].join(','));
    download('three-body-observations.csv','\uFEFF'+rows.join('\n'),'text/csv;charset=utf-8');notify('최근 '+count+'개의 관측점을 저장했습니다. 적분 내부의 모든 스텝을 저장한 파일은 아닙니다.');
  }
  function setSelectValue(id,value){const el=$(id),str=String(value);let found=Array.from(el.options).find(o=>Number(o.value)===Number(value));if(!found){const op=document.createElement('option');op.value=str;op.textContent=str;el.appendChild(op);found=op;}el.value=found.value;}
  function loadConfig(obj){
    if(obj?.schema!=='three-body-lab.initial.v1')throw new Error('이 실험실에서 저장한 초기조건 JSON이 아닙니다.');
    const keys=Object.keys(P.DEFAULTS),o={...P.DEFAULTS};for(const k of keys)if(obj.options&&Object.hasOwn(obj.options,k))o[k]=obj.options[k];
    if(o.atol!==o.rtol/100||o.maxStep!==((o.method==='rk4'||o.method==='leapfrog')?o.dt:.02))throw new Error('이 UI가 표시할 수 없는 허용오차·최대 간격 조합입니다.');
    if(o.G!==1||o.stopRadius!==P.DEFAULTS.stopRadius||o.minStep!==P.DEFAULTS.minStep||o.encounterFactor!==P.DEFAULTS.encounterFactor||o.guardFixed!==true)throw new Error('이 UI는 G=1 및 기본 안전 한계의 설정만 불러옵니다.');
    P.validate(obj.y,obj.m,o);
    if(!Number.isInteger(obj.seed)||obj.seed<0||obj.seed>4294967295)throw new Error('시드 값이 올바르지 않습니다.');
    const cmp=obj.comparison||{enabled:false,delta:1e-6};if(typeof cmp.enabled!=='boolean'||!Number.isFinite(cmp.delta)||cmp.delta<1e-12||cmp.delta>.1)throw new Error('섭동 설정이 올바르지 않습니다.');
    const candidate=new P.Simulator(obj.y,obj.m,o);
    if(cmp.enabled)new P.Simulator(P.perturb(obj.y,obj.m,cmp.delta),obj.m,o);
    if(worker)cancelExperiment();
    initialY=P.copy(obj.y);initialM=P.copy(obj.m);draftY=P.copy(initialY);draftM=P.copy(initialM);sim=candidate;
    // Imported titles are text only; never executable HTML. An imported file
    // is treated as custom, so it cannot falsely claim an exact preset period.
    presetInfo={id:'imported',title:'불러온 초기조건',description:'JSON에 저장된 시작 상태와 적분 설정입니다. 저장 시점의 재생 시간이나 궤적은 포함하지 않습니다.',period:null};
    $('method').value=o.method;setSelectValue('tolerance',o.rtol);setSelectValue('dt',o.dt);setSelectValue('epsilon',o.epsilon);$('seed').value=obj.seed;$('ghost').checked=cmp.enabled;setSelectValue('delta',cmp.delta);
    updateMethodControls();clearDirty();syncEditor();updateScenario();reset(false,o);fitCamera(true);notify('초기조건을 불러왔습니다. t = 0부터 재현합니다.');
  }
  function setExperimentUI(busy){all('[data-experiment]').forEach(b=>b.disabled=busy);$('progress-area').classList.toggle('visible',busy);$('progress-fill').style.width='0%';}
  function cleanupWorker(){if(worker)worker.terminate();worker=null;if(workerUrl)URL.revokeObjectURL(workerUrl);workerUrl=null;setExperimentUI(false);}
  function cancelExperiment(){cleanupWorker();notify('실험 계산을 중단했습니다. 원본 초기조건과 궤도는 그대로입니다.');}
  function experiment(kind){
    if(worker)return;if(dirty){notify('변경사항을 먼저 적용하세요. 실험은 적용된 초기조건부터 시작합니다.');return;}
    const T=Number($('experiment-time').value);if(kind!=='benchmark'&&(!Number.isFinite(T)||T<.01||T>60)){notify('실험 시간 T는 .01~60 범위여야 합니다.');return;}
    setPlaying(false);setExperimentUI(true);$('progress-label').textContent='별도 계산 상태를 준비합니다';
    const input={y:Array.from(initialY),m:Array.from(initialM),options:{...sim.o},T,delta:Number($('delta').value)};
    try{
      const source=$('physics-source').textContent+'\n'+$('experiment-source').textContent+`\nonmessage=function(event){try{const result=ThreeBodyExperiments.execute(event.data.kind,event.data.input,function(update){postMessage({type:'progress',update:update});});postMessage({type:'result',result:result});}catch(error){postMessage({type:'error',message:error.message});}};`;
      workerUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));worker=new Worker(workerUrl);const current=worker;
      worker.onmessage=e=>{
        if(worker!==current)return;
        if(e.data.type==='progress'){$('progress-label').textContent=e.data.update.label;$('progress-fill').style.width=(Math.min(1,e.data.update.progress)*100)+'%';}
        else if(e.data.type==='result'){const result=e.data.result;cleanupWorker();reports.unshift(result);reports=reports.slice(0,12);$('report-count').textContent='('+reports.length+')';renderReports();modal('reports-modal');notify('실험을 완료했습니다. 결과와 중단 여부를 함께 기록했습니다.');}
        else {const msg=e.data.message;cleanupWorker();notify('실험 중단: '+msg);}
      };
      worker.onerror=e=>{if(worker!==current)return;cleanupWorker();notify('실험 작업자를 실행하지 못했습니다: '+(e.message||'이 브라우저의 로컬 Worker 제한'));};
      worker.postMessage({kind,input});
    }catch(e){cleanupWorker();notify('별도 계산 실행 실패: '+e.message);}
  }
  function renderReports(){
    const el=$('report-body');el.replaceChildren();
    if(!reports.length){const p=document.createElement('div');p.className='empty';p.textContent='아직 실행한 실험이 없습니다.\n오른쪽의 기준시험·적분기 비교·시간 반전·민감도 검증을 실행하세요.';el.appendChild(p);return;}
    reports.forEach(r=>{
      const section=document.createElement('section');section.className='report';const h=document.createElement('h3');h.textContent=r.title;section.appendChild(h);
      const stamp=document.createElement('div');stamp.className='stamp';stamp.textContent=new Date(r.createdAt).toLocaleString('ko-KR')+(r.input?' · INITIAL CONDITIONS / ε = '+r.input.options.epsilon:' · BUILT-IN FIXTURES');section.appendChild(stamp);
      const scroll=document.createElement('div');scroll.className='table-scroll';const table=document.createElement('table'),thead=document.createElement('thead'),tr=document.createElement('tr');
      r.columns.forEach(x=>{const th=document.createElement('th');th.textContent=x;tr.appendChild(th);});thead.appendChild(tr);table.appendChild(thead);const tbody=document.createElement('tbody');
      r.rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(x=>{const td=document.createElement('td');td.textContent=x;if(x==='PASS')td.className='pass';if(x==='FAIL'||x==='중단')td.className='fail';tr.appendChild(td);});tbody.appendChild(tr);});table.appendChild(tbody);scroll.appendChild(table);section.appendChild(scroll);
      const note=document.createElement('p');note.className='note';note.textContent=r.note;section.appendChild(note);el.appendChild(section);
      if(r.series){const p=document.createElement('p');p.className='note';p.textContent='초기 위치 차이 대비 마지막 분리: '+numberString(r.growth)+'배. 아래 그래프는 섭동 위치 차이의 log₁₀ 값입니다.';section.appendChild(p);const c=document.createElement('canvas');c.className='report-chart';section.appendChild(c);setTimeout(()=>lineChart(c,r.series,row=>row.separation,COLORS[2]),50);}
    });
  }
  function hitBody(x,y){let nearest=-1,d=20;for(let i=0;i<3;i++){const p=screen(displayY[2*i],displayY[2*i+1]),dist=Math.hypot(x-p[0],y-p[1]);if(dist<d){nearest=i;d=dist;}}return nearest;}
  function localPoint(e){const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];}
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;const [x,y]=localPoint(e),b=hitBody(x,y);camera.auto=false;$('fit').classList.remove('active');
    if(!playing&&b!==-1&&dirty){notify('먼저 편집 중인 변경사항을 적용하세요.');return;}
    if(!playing&&b!==-1&&!worker){pointer={mode:e.shiftKey?'velocity':'body',body:b,startX:x,startY:y,original:P.copy(displayY),moved:false};selected=b;syncEditor();}
    else pointer={mode:'pan',startX:x,startY:y,cx:camera.x,cy:camera.y,moved:false};canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    const [x,y]=localPoint(e),w=world(x,y);$('coords').textContent='x '+w[0].toFixed(3)+'  /  y '+w[1].toFixed(3);
    if(!pointer){hoverBody=hitBody(x,y);canvas.style.cursor=!playing&&hoverBody>=0?'grab':'crosshair';return;}
    pointer.moved=pointer.moved||Math.hypot(x-pointer.startX,y-pointer.startY)>2;
    if(pointer.mode==='pan'){camera.x=pointer.cx-(x-pointer.startX)/camera.scale;camera.y=pointer.cy+(y-pointer.startY)/camera.scale;}
    else if(pointer.mode==='body'){displayY[2*pointer.body]=w[0];displayY[2*pointer.body+1]=w[1];}
    else{const b=pointer.body;displayY[6+2*b]=pointer.original[6+2*b]+(x-pointer.startX)/camera.scale/.35;displayY[7+2*b]=pointer.original[7+2*b]-(y-pointer.startY)/camera.scale/.35;}
  });
  function endPointer(e,cancel=false){
    if(!pointer)return;const p=pointer;pointer=null;
    if(p.mode!=='pan'&&p.moved&&!cancel){
      try{P.validate(displayY,initialM,sim.o);initialY=P.copy(displayY);draftY=P.copy(initialY);draftM=P.copy(initialM);presetInfo={id:'custom',title:'드래그한 초기조건',description:'일시정지 시점의 전체 상태를 새로운 시작점으로 삼았습니다. 물체 크기는 실제 충돌 반지름이 아닙니다.',period:null};clearDirty();syncEditor();updateScenario();reset(false);notify('현재 상태를 새 초기조건으로 적용했습니다. t = 0으로 재설정했습니다.');}
      catch(err){displayY=p.original;notify('편집을 적용하지 않았습니다: '+err.message);}
    }else if(p.mode!=='pan')displayY=p.original;
    if(e&&canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerup',e=>endPointer(e));canvas.addEventListener('pointercancel',e=>endPointer(e,true));
  canvas.addEventListener('wheel',e=>{e.preventDefault();const [x,y]=localPoint(e),before=world(x,y);camera.auto=false;$('fit').classList.remove('active');camera.scale=Math.max(.00001,Math.min(1e5,camera.scale*Math.exp(-e.deltaY*.001)));const after=world(x,y);camera.x+=before[0]-after[0];camera.y+=before[1]-after[1];},{passive:false});
  $('zoom-in').onclick=()=>{camera.auto=false;camera.scale=Math.min(1e5,camera.scale*1.25);$('fit').classList.remove('active');};$('zoom-out').onclick=()=>{camera.auto=false;camera.scale=Math.max(.00001,camera.scale/1.25);$('fit').classList.remove('active');};$('fit').onclick=()=>fitCamera(true);
  $('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('viewport').requestFullscreen)await $('viewport').requestFullscreen();else notify('이 브라우저에서는 창 전체화면 기능을 사용하세요.');}catch(e){notify('전체화면 요청을 처리하지 못했습니다.');}};
  all('[data-preset]').forEach(b=>b.onclick=()=>loadPreset(b.dataset.preset));$('random').onclick=()=>loadPreset('random');
  all('[data-body]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.body);syncEditor();});
  ['mass','posx','posy','velx','vely'].forEach(id=>$(id).addEventListener('input',()=>{const raw=$(id).value,value=raw.trim()===''?NaN:Number(raw);if(id==='mass')draftM[selected]=value;else{const map={posx:2*selected,posy:2*selected+1,velx:6+2*selected,vely:7+2*selected};draftY[map[id]]=value;}markDirty();}));
  ['method','tolerance','dt','epsilon'].forEach(id=>$(id).onchange=()=>{updateMethodControls();markDirty();});$('apply').onclick=applyDraft;
  $('recenter').onclick=()=>{try{P.validate(draftY,draftM,currentOptions());draftY=P.recenter(draftY,draftM);syncEditor();markDirty();notify('초기 위치와 속도의 질량중심을 0으로 정렬했습니다. 적용 버튼으로 확정하세요.');}catch(e){notify(e.message);}};
  $('play').onclick=()=>setPlaying(!playing);$('reset').onclick=()=>{reset(false);fitCamera(true);};$('step').onclick=()=>{setPlaying(false);if(!stopFlag)singleStep=true;};
  $('ghost').onchange=()=>{reset(playing);fitCamera(true);};$('delta').onchange=()=>{if($('ghost').checked)reset(playing);};
  $('help').onclick=()=>{setPlaying(false);modal('help-modal');};$('show-reports').onclick=()=>{renderReports();modal('reports-modal');};all('[data-close]').forEach(b=>b.onclick=closeModal);
  all('.modal-shade').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeModal();}));
  $('save').onclick=save;$('save2').onclick=save;$('load').onclick=()=>$('file-input').click();$('csv').onclick=csv;
  $('file-input').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;if(f.size>1024*1024){notify('초기조건 파일은 1 MB 이하만 허용합니다.');return;}try{loadConfig(JSON.parse(await f.text()));}catch(err){notify('불러오기 실패: '+err.message);}};
  all('[data-experiment]').forEach(b=>b.onclick=()=>experiment(b.dataset.experiment));$('cancel-experiment').onclick=cancelExperiment;
  $('export-reports').onclick=()=>download('three-body-experiment-log.json',JSON.stringify({version:P.VERSION,reports},null,2));
  document.addEventListener('keydown',e=>{
    if(activeModal){
      if(e.key==='Escape'){closeModal();e.preventDefault();}
      if(e.key==='Tab'){const items=Array.from($(activeModal).querySelectorAll('button,a[href],input,select')).filter(x=>!x.disabled);if(items.length){const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}}return;
    }
    if(e.target.closest('input,select,textarea,button')||e.ctrlKey||e.metaKey||e.altKey)return;
    if(e.code==='Space'){e.preventDefault();setPlaying(!playing);}else if(e.key.toLowerCase()==='r'){reset(false);fitCamera(true);}else if(e.key.toLowerCase()==='f')fitCamera(true);else if(e.key==='.'){$('step').click();}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){setPlaying(false);prevTime=0;}});
  function tick(now){
    if(!prevTime)prevTime=now;const dt=Math.min(.05,Math.max(0,(now-prevTime)/1000));prevTime=now;
    if(playing&&!activeModal){accumulator=Math.min(2,accumulator+dt*Number($('speed').value));advanceBudget(7);}else if(singleStep)advanceBudget(7);
    draw();frameCount++;fpsFrames++;if(now-fpsEpoch>750){fps=fpsFrames*1000/(now-fpsEpoch);fpsFrames=0;fpsEpoch=now;}
    if(now-metricTime>180){updateReadouts();drawCharts();metricTime=now;}requestAnimationFrame(tick);
  }
  new ResizeObserver(resize).observe($('viewport'));window.addEventListener('resize',resize);
  loadPreset('figure8');resize();fitCamera(true);updateMethodControls();requestAnimationFrame(tick);
  // Small inspectable API for reproducible research and headless browser tests.
  window.ThreeBodyLab={version:P.VERSION,physics:P,config,loadConfig,loadPreset,pause:()=>setPlaying(false),play:()=>setPlaying(true),
    state:()=>({t:sim.t,y:Array.from(sim.y),m:Array.from(sim.m),stats:{...sim.stats},options:{...sim.o},playing,dirty,stopped:stopFlag,records:count,workerActive:!!worker,reports:JSON.parse(JSON.stringify(reports))}),
    advance:T=>{setPlaying(false);if(!Number.isFinite(T)||T<sim.t||T>sim.t+100)throw new Error('현재 시점부터 최대 100 시간단위만 진행하세요.');while(sim.t<T-1e-13){const target=Math.min(T,(sampleIndex+1)*SAMPLE);sim.advanceTo(target);if(ghostSim)ghostSim.advanceTo(target);capture();sampleIndex++;}pendingTarget=null;accumulator=0;updateReadouts();drawCharts();draw();return Array.from(sim.y);},runExperiment:experiment};
})();
