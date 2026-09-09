/* Standalone proof interface; worker performs all expensive exact arithmetic. */
(function(){
'use strict';
const $=id=>document.getElementById(id),V=ThreeBodyValidated;
let worker=null,url=null,last=null;
const base={state:['-1','0','1','0','0','1','0','0.3','0','-0.2','-0.1','0'],masses:['1','2','3'],G:'1',epsilon:'0'};
const workerCode=document.getElementById('validated-source').textContent+`\n
function measurePair(a,b){
 const I=ThreeBodyValidated._test;
 if(!a.complete||!b.complete)return null;
 const ta=I.parse(a.input.T),tb=I.parse(b.input.T);
 if(ta[0]*tb[1]!==tb[0]*ta[1])throw Error('섭동 쌍의 끝 시각이 다릅니다.');
 if(a.input.masses.some((x,k)=>{const p=I.parse(x),q=I.parse(b.input.masses[k]);return p[0]*q[1]!==q[0]*p[1];}))throw Error('섭동 쌍의 질량이 다릅니다.');
 const norm=xs=>I.sqrt(xs.reduce((s,x)=>I.add(s,I.sq(x)),I.Z));
 const ae=a.steps.length?I.unpack(a.steps.at(-1).end):a.input.state.map(I.dec);
 const be=b.steps.length?I.unpack(b.steps.at(-1).end):b.input.state.map(I.dec);
 const initial=norm(a.input.state.slice(0,6).map((x,k)=>I.sub(I.dec(b.input.state[k]),I.dec(x))));
 const final=norm(ae.slice(0,6).map((x,k)=>I.sub(be[k],x)));
 return {initial:ThreeBodyValidated.display([initial])[0],final:ThreeBodyValidated.display([final])[0],ratio:initial[0]>0n?ThreeBodyValidated.display([I.div(final,initial)])[0]:null};
}
onmessage=function(e){try{
 const d=e.data,V=ThreeBodyValidated,emit=phase=>p=>postMessage({type:'progress',phase,p});let record;
 if(d.kind==='run'){
   const a=V.integrate(d.input,emit('원본 구간 계산'));
   if(d.pair){const input=Object.assign({},d.input,{state:['-0.9999995','0','0.9999999','0','-0.0000001','1','0','0.3','0','-0.2','-0.1','0']});record={schema:'three-body-interval-pair-1',base:a,perturbed:V.integrate(input,emit('섭동 구간 계산'))};}
   else record=a;
 }else record=d.record;
 postMessage({type:'progress',phase:'증명 조건 재검사',p:{}});
 let checks,separation=null;
 if(record.schema==='three-body-interval-pair-1'){checks=[V.check(record.base,emit('원본 재검사')),V.check(record.perturbed,emit('섭동 재검사'))];separation=measurePair(record.base,record.perturbed);}
 else checks=[V.check(record,emit('구간 재검사'))];
 postMessage({type:'done',record,checks,separation});
 }catch(err){postMessage({type:'error',message:err.message});}}
`;
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function stop(){if(worker)worker.terminate();if(url)URL.revokeObjectURL(url);worker=null;url=null;$('proof-run').disabled=false;$('proof-cancel').disabled=true;$('proof-import').disabled=false;$('proof-export').disabled=!last;}
function status(text){$('proof-progress').textContent=text;}
function fmt(x){const n=Number(x);return Number.isFinite(n)?n.toExponential(5):String(x);}
function render(result){const box=$('proof-result');box.replaceChildren();const ok=result.checks.every(c=>c.complete),card=el('div','proof-card');
card.append(el('div','proof-badge '+(ok?'verified':'partial'),ok?'CERTIFIED · 요청 구간의 인증 조건 통과':'PARTIAL · 도달한 구간까지만 인증'));
card.append(el('h3','',ok?'존재 · 유일성 · 충돌 회피 · 끝점 포함':'요청한 끝 시각까지는 인증하지 못했습니다.'));
const records=result.record.schema==='three-body-interval-pair-1'?[result.record.base,result.record.perturbed]:[result.record];
result.checks.forEach((c,j)=>{const r=records[j],title=result.checks.length===2?(j?'섭동 궤도':'원본 궤도'):'인증 결과';card.append(el('h4','',title));
const grid=el('div','proof-metrics');for(const [label,value] of [['인증 끝 시각',c.reached.join(' / ')],['인증 단계',String(c.steps)],['전 구간 거리 하한',c.minDistanceLower?'≥ '+c.minDistanceLower:'인증 없음'],['수축 상수 상한','≤ '+c.contractionUpper],['끝점 위치 구간 최대 너비 (약)',fmt(c.maxPositionWidth)]]){const q=el('div','');q.append(el('span','',label),el('strong','',value));grid.append(q);}card.append(grid);
if(!c.complete)card.append(el('p','warning-text','인증 중단: '+(r.reason||'요청 시간 미도달')+'. 이는 물리적 충돌 판정이 아닙니다.'));
const d=el('details','proof-details');d.append(el('summary','','입력과 위치의 인증 구간 보기'));d.append(el('p','hint','질량 ['+r.input.masses.join(', ')+'], 초기 상태 ['+r.input.state.join(', ')+']. 위치 6개 다음에 속도 6개입니다. 아래 십진 끝점도 바깥 방향으로 반올림했습니다.'));
const sc=el('div','table-scroll'),table=el('table','proof-table'),tr=el('tr');['좌표','하한','상한'].forEach(t=>tr.append(el('th','',t)));table.append(tr);c.endpoint.slice(0,6).forEach((ab,k)=>{const row=el('tr');[String.fromCharCode(65+Math.floor(k/2))+'.'+(k%2?'y':'x'),...ab].forEach(v=>row.append(el('td','',v)));table.append(row);});sc.append(table);d.append(sc);card.append(d);
});
if(result.separation){const s=result.separation,p=el('div','proof-pair');p.append(el('h3','','추가 명제 · 유한시간 위치 분리'));p.append(el('p','','초기 분리의 노름 ∈ ['+s.initial.join(', ')+']'));p.append(el('p','','끝 시각 분리의 노름 ∈ ['+s.final.join(', ')+']'));if(s.ratio)p.append(el('p','','증폭비 ∈ ['+s.ratio.join(', ')+']'));p.append(el('p','hint','노름은 세 물체의 6개 위치 성분에 대한 유클리드 노름입니다. 이 부등식은 인증된 유한시간 명제이며 혼돈이나 장시간 지수를 뜻하지 않습니다.'));card.append(p);}
card.append(el('p','hint','CERTIFIED는 아래 수학적 조건과 이 검사기의 정수 산술에 근거한 판정입니다. 형식검증된 정리 증명기 결과는 아닙니다. 증명서 요약란은 신뢰하지 않고 모든 단계를 다시 계산했습니다.'));box.append(card);}
function start(payload){stop();last=null;$('proof-result').replaceChildren();$('proof-export').disabled=true;$('proof-run').disabled=true;$('proof-cancel').disabled=false;$('proof-import').disabled=true;status('정수 구간 계산을 시작합니다.');
try{url=URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'}));worker=new Worker(url);worker.onmessage=e=>{const d=e.data;if(d.type==='progress'){const p=d.p;status(d.phase+(p.t!==undefined?' · t '+p.t.toFixed(5)+' / '+p.T+' · '+p.steps+' 단계':p.step?' · '+p.step+' / '+p.total+' 단계':''));}else if(d.type==='done'){last=d;stop();render(d);status('재검사 완료. 증명서를 저장해 다른 검사기로 확인할 수 있습니다.');}else{stop();status('인증하지 못했습니다 · '+d.message);}};worker.onerror=e=>{stop();status('계산기 오류 · '+e.message);};worker.postMessage(payload);}catch(e){stop();status('계산 시작 실패 · '+e.message);}}
function run(){try{let input={...base};const source=$('proof-source').value;if(source==='current'){const st=ThreeBodyLab.state();if(st.dirty)throw Error('먼저 시뮬레이터의 변경사항을 적용하세요.');const c=ThreeBodyLab.config();if(c.options.epsilon!==0)throw Error('중력 연화 ε를 0으로 바꾸고 적용하세요.');input={state:c.y.map(String),masses:c.m.map(String),G:String(c.options.G),epsilon:'0'};}
ThreeBodyLab.pause();input={...input,T:$('proof-time').value,order:Number($('proof-order').value),stepPower:Number($('proof-step').value)};start({kind:'run',input,pair:source==='pair'});}catch(e){last=null;$('proof-result').replaceChildren();$('proof-export').disabled=true;status(e.message);}}
$('open-proof').onclick=()=>{ThreeBodyLab.openProof();};$('proof-run').onclick=run;$('proof-cancel').onclick=()=>{stop();last=null;$('proof-export').disabled=true;status('사용자가 취소했습니다. 이번 실행의 증명서는 생성하지 않았습니다.');};
$('proof-export').onclick=()=>{if(!last)return;const u=URL.createObjectURL(new Blob([JSON.stringify(last.record,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='three-body-certificate.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),10000);};
$('proof-import').onclick=()=>$('proof-file').click();$('proof-file').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>16*1024*1024)throw Error('증명서 최대 크기는 16 MB입니다.');const record=JSON.parse(await f.text());start({kind:'verify',record});}catch(e){status('불러오기 실패 · '+e.message);}};
window.ThreeBodyProofUI={run,get result(){return last;},get busy(){return !!worker;}};
})();
