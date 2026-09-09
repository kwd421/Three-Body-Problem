"""Dependency-free static site build; never changes the proof engine."""
from pathlib import Path
from html import escape as esc
import json,shutil,os,zipfile,hashlib
R=Path(__file__).resolve().parent.parent
D=R/'dist';D.mkdir(exist_ok=True)
A=R/'archive/v1.2-source'
result=json.loads((R/'research/results/independent_T1.json').read_text())
cert=R/'research/results/asymmetric_T1.json'
assert result['verified'] and result['complete'] and result['reached']=='1'
assert hashlib.sha256(cert.read_bytes()).hexdigest()==result['certificateSHA256']
commit=os.environ.get('SITE_COMMIT',os.environ.get('GITHUB_SHA','local'))
version={'version':'1.3.0','commit':commit,'certificateSHA256':result['certificateSHA256']}
(D/'version.json').write_text(json.dumps(version,indent=2)+'\n')
source=(R/'src/validated.js').read_text()
template=(R/'site/lab-template.html').read_text()
assert template.count('__VALIDATED_SOURCE__')==1
page=template.replace('__VALIDATED_SOURCE__',source)
# Never force a reload while a user has an experiment in progress.
update='''<script>(()=>{if(location.protocol==='file:')return;const initial=__CURRENT__;
setInterval(async()=>{try{const v=await(await fetch('version.json',{cache:'no-store'})).json();
if(v.commit!==initial&&!document.getElementById('new-version')){const b=document.createElement('button');b.id='new-version';b.textContent='새 버전이 있습니다 · 눌러서 새로고침';b.style.cssText='position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:120;max-width:95vw;padding:12px;background:#133b39;color:#d9f9ef;border:1px solid #6acbb3;border-radius:8px';b.onclick=()=>location.reload();document.body.append(b);}}catch(e){}},60000);})();</script>'''.replace('__CURRENT__',json.dumps(commit))
page=page.replace('</body>',update+'</body>')
(D/'index.html').write_text(page)
(D/'.nojekyll').write_text('')
for directory in ['research/results','src']:
 target=D/('results' if directory.endswith('results') else 'verifier')
 shutil.copytree(R/directory,target,dirs_exist_ok=True)
(D/'docs').mkdir(exist_ok=True)
for src,name in [(R/'research/2026-09-09-weighted-norm.md','weighted-norm.md'),(A/'three_body_proof/PROOF_AND_VALIDATION.md','v1.2-proof.md'),(A/'three_body_lab_validation.md','v1.1-validation.md')]:shutil.copy2(src,D/'docs'/name)
(D/'archive').mkdir(exist_ok=True)
for v in ['1_1','1_2']:shutil.copy2(A/f'three_body_lab_v{v}.html',D/'archive'/f'v{v.replace("_",".")}.html')
repo='https://github.com/kwd421/Three-Body-Problem'
report=esc((R/'research/2026-09-09-weighted-norm.md').read_text())
short=esc(commit[:12]);distance=esc(result['minDistanceLower'])
research=f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Three Body / 연구 기록</title><style>
:root{{--paper:#f4f3ed;--ink:#19302d;--soft:#626e68;--line:#d1d8ce;--accent:#18614d}}*{{box-sizing:border-box}}body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}}a{{color:inherit;text-underline-offset:4px}}header,main,footer{{max-width:1140px;margin:auto;padding:24px}}header{{display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line)}}header b{{letter-spacing:3px;font-size:15px}}nav{{display:flex;gap:20px;font-size:13px}}.eyebrow{{font:12px ui-monospace,monospace;letter-spacing:2px;color:var(--accent)}}h1{{font-size:clamp(34px,5.6vw,64px);line-height:1.23;letter-spacing:-2px;margin:20px 0}}.intro{{max-width:700px;color:var(--soft)}}.hero{{padding:60px 0 46px}}.buttons{{display:flex;gap:12px;flex-wrap:wrap;margin-top:30px}}.button{{padding:12px 18px;border:1px solid var(--line);border-radius:4px;text-decoration:none}}.button.primary{{background:var(--ink);color:white;border-color:var(--ink)}}.numbers{{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:5px;overflow:hidden}}.number{{padding:28px;border-right:1px solid var(--line)}}.number:last-child{{border:0}}.number strong{{display:block;font:36px ui-monospace,monospace;margin:8px 0}}.number small{{color:var(--soft)}}section{{margin:46px 0}}h2{{font-size:24px;letter-spacing:-.6px}}.band{{padding:28px;background:#e2e9df;border-left:3px solid var(--accent)}}.band p{{margin:0}}.grid{{display:grid;grid-template-columns:1fr 1fr;gap:18px}}.card{{padding:25px;border:1px solid var(--line);border-radius:5px;min-width:0}}.card h3{{margin:0 0 12px}}.card p{{font-size:14px;color:var(--soft)}}.links{{display:flex;gap:12px;flex-wrap:wrap;font-size:13px}}pre{{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.95 ui-monospace,monospace;background:#eceee6;padding:24px;border-radius:5px}}details summary{{cursor:pointer;font-size:20px}}footer{{border-top:1px solid var(--line);color:var(--soft);font-size:12px}}code{{overflow-wrap:anywhere}}.caption{{font-size:12px;color:var(--soft)}}@media(max-width:650px){{header,main,footer{{padding:20px}}nav{{gap:12px}}.hero{{padding:35px 0}}.numbers,.grid{{grid-template-columns:1fr}}.number{{border-right:0;border-bottom:1px solid var(--line);padding:20px}}h1{{letter-spacing:-1px}}pre{{padding:15px;font-size:12px}}}}
</style></head><body><header><b>THREE BODY</b><nav><a href="index.html">실험실</a><a href="{repo}">GitHub ↗</a></nav></header><main><div class="hero"><div class="eyebrow">RESEARCH NOTE 003 · v1.3</div><h1>눈으로 본 궤도에서<br>검사할 수 있는 증명으로.</h1><p class="intro">뉴턴 중력의 평면 삼체 실험실. 시뮬레이션, 정확한 유리수 구간 계산, 독립 검사기를 같은 저장소에서 다룹니다. 이번 버전은 비대칭 예제의 근접 구간 뒤까지 인증을 연장했습니다.</p><div class="buttons"><a class="button primary" href="index.html">시뮬레이터 열기 →</a><a class="button" href="results/asymmetric_T1.json" download>증명서 JSON</a><a class="button" href="reproduce.zip">재현 코드 묶음</a></div></div>
<div class="numbers"><div class="number"><small>연속 시간 구간 전체 인증</small><strong>0 ≤ t ≤ 1</strong><small>하나의 명시된 초기값 문제</small></div><div class="number"><small>모든 물체 쌍의 거리</small><strong>&gt; 0.07536</strong><small>프레임 샘플이 아닌 전체 시간 하한</small></div><div class="number"><small>Python으로 다시 검사한 단계</small><strong>512 / 512</strong><small>192-bit 고정소수점 구간 산술</small></div></div>
<section class="band"><p><b>무엇을 증명했고, 무엇을 증명하지 않았는가.</b><br>명시된 초기조건에서 유일한 해의 존재와 [0,1]의 충돌 회피를 인증했습니다. 모든 삼체 초기조건의 일반해, 혼돈, 주기궤도의 존재, 무한시간 안정성을 증명한 것은 아닙니다. 코드·정수 런타임·수학 명세가 신뢰 기반이며 정리 증명기의 형식검증은 아닙니다.</p></section>
<section><h2>결과와 근거를 함께.</h2><div class="grid"><article class="card"><h3>01 · 현재 연구</h3><p>가중 노름으로 Picard 수축 조건을 개선했습니다. 끝점 위치 구간 최대 너비는 약 5.593×10⁻⁴로, 시간을 연장한 대신 이전 짧은 구간보다 정밀도는 낮아졌습니다.</p><div class="links"><a href="docs/weighted-norm.md">수학적 유도</a><a href="results/independent_T1.json">독립 검사 결과</a><a href="results/exact_tests.json">산술·변조 검사</a></div></article><article class="card"><h3>02 · 이전 산출물</h3><p>v1.1 수치 검산과 v1.2의 T=0.7 궤도·유한시간 섭동 증폭 인증을 보존합니다. 예전 결과와 새 결과를 혼동하지 않습니다.</p><div class="links"><a href="archive/v1.1.html">v1.1</a><a href="archive/v1.2.html">v1.2</a><a href="docs/v1.2-proof.md">이전 증명</a><a href="{repo}/tree/main/archive">전체 아카이브 ↗</a></div></article></div></section>
<section><h2>커밋 → 재검사 → 배포.</h2><p class="intro">main 브랜치가 바뀌면 정해진 인증 실험을 재현하고, Python 독립 검사와 산술 검사를 거쳐 사이트를 다시 만듭니다. 검사에 실패하면 그 결과를 새 사이트로 배포하지 않습니다. 이것은 CI 자동화이며 AI가 무인으로 새 정리를 연구하는 기능은 아닙니다.</p><div class="links"><a href="{repo}/actions">Actions 실행 이력 ↗</a><a href="{repo}/issues">다음 연구 과제 ↗</a><a href="verifier/verify_certificate.py" download>Python 검사기</a></div><p class="caption">소스 커밋 <code>{short}</code> · 증명서 SHA-256 <code>{esc(result['certificateSHA256'])}</code></p></section>
<section><details><summary>전체 연구 노트 펼치기</summary><pre>{report}</pre></details></section></main><footer>G = 1 · ε = 0 · PLANAR NEWTON · MIT<br>정확한 거리 하한: {distance} · 그림의 궤도와 증명서의 포함 구간은 별개입니다.</footer></body></html>'''
(D/'research.html').write_text(research)
with zipfile.ZipFile(D/'reproduce.zip','w',zipfile.ZIP_DEFLATED) as z:
 for directory in ['src','tools','tests','research','site','archive']:
  for f in sorted((R/directory).rglob('*')):
   if f.is_file() and '__pycache__' not in f.parts:z.write(f,f.relative_to(R))
 for f in ['README.md','AGENTS.md']:
  if (R/f).exists():z.write(R/f,f)
manifest={str(p.relative_to(D)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(D.rglob('*')) if p.is_file() and p.name!='SHA256SUMS.json'}
(D/'SHA256SUMS.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Built {len(manifest)} static assets in {D}; certificate digest verified.')
