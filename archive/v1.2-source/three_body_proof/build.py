from pathlib import Path
ROOT=Path(__file__).resolve().parent
old=ROOT/'legacy'/'three_body_lab_v1_1.html'
if not old.exists(): old=ROOT.parent/'three_body_lab_v1_1.html'
s=old.read_text()
s=s.replace('<title>삼체 실험실 · Three Body Lab</title>','<title>삼체 실험실 v1.2 · 인증 계산</title>')
s=s.replace('<span class="version">v1.1</span>','<span class="version">v1.2</span>')
css='''
.proof-controls{display:grid;grid-template-columns:minmax(260px,2fr) repeat(3,minmax(90px,1fr));gap:12px;margin:20px 0 0}.proof-controls select{height:34px}.proof-actions{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0}.proof-intro h3{font-size:21px;margin:8px 0!important;letter-spacing:-.5px}.proof-progress{padding:13px 15px;border:1px solid var(--stroke);background:#0c1620;border-radius:8px;font-size:12px;color:var(--muted);line-height:1.8}.proof-card{margin-top:20px;border:1px solid #345952;border-radius:10px;padding:22px;background:#0e201f}.proof-card h3{margin-top:12px}.proof-card h4{font-size:12px;font-weight:500;margin:22px 0 12px}.proof-badge{font:10px var(--mono);letter-spacing:.5px;line-height:1.8}.proof-badge.verified{color:var(--cyan)}.proof-badge.partial{color:var(--gold)}.proof-metrics{display:grid;grid-template-columns:1fr 1fr;gap:10px}.proof-metrics>div{padding:13px;background:#102724;border:1px solid #28463f;border-radius:7px;min-width:0}.proof-metrics span{display:block;color:var(--muted);font-size:10px;margin-bottom:6px}.proof-metrics strong{font:11px var(--mono);color:#d3e7e1;word-break:break-all;line-height:1.7}.proof-table{width:100%;border-collapse:collapse;white-space:nowrap;font:11px var(--mono)}.proof-table td,.proof-table th{padding:10px;border-bottom:1px solid var(--stroke);text-align:left}.proof-table th{color:var(--muted);font-weight:400}.proof-details{margin-top:18px;line-height:1.8}.proof-details summary{font-size:12px;color:#b6c8d3}.proof-pair{border-top:1px solid #345952;margin-top:20px;padding-top:6px}.proof-pair p{overflow-wrap:anywhere;font:12px/1.9 var(--mono)}#open-proof{width:100%;padding:11px;text-align:left}#proof-modal .modal{width:min(1080px,100%)}
@media(max-width:700px){.proof-controls{grid-template-columns:1fr 1fr}.proof-controls .field:first-child{grid-column:1/-1}.proof-metrics{grid-template-columns:1fr}.proof-intro h3{font-size:18px}.proof-card{padding:14px}.proof-actions button{font-size:11px}.proof-progress{font-size:11px}}
'''
s=s.replace('</style></head>',css+'</style></head>')
section='''<section class="section"><h2><span>증명 모드</span><span class="eyebrow">VALIDATED / NEW</span></h2><button id="open-proof" class="primary">유한시간 궤도 인증 ↗</button><p class="hint">정수 구간 산술 · 존재와 유일성 · 충돌 회피 · 오차 포함 구간. 증명서 저장 및 재검사를 지원합니다.</p></section>'''
s=s.replace('<section class="section"><h2><span>실시간 진단',section+'<section class="section"><h2><span>실시간 진단',1)
s=s.replace('<script id="physics-source">',ROOT.joinpath('proof_panel.html').read_text()+'\n<script id="physics-source">',1)
s=s.replace('window.ThreeBodyLab={version:P.VERSION,physics:P,config,','window.ThreeBodyLab={version:P.VERSION,openProof:()=>{setPlaying(false);modal(\'proof-modal\');},physics:P,config,',1)
addition='<script id="validated-source">'+ROOT.joinpath('validated.js').read_text()+'</script>\n<script>'+ROOT.joinpath('proof_ui.js').read_text()+'</script>\n'
s=s.replace('</body></html>',addition+'</body></html>')
out=ROOT.parent/'three_body_lab_v1_2.html'
out.write_text(s)
print(out)
