#!/usr/bin/env python3
"""Browser interaction regression suite on the exact standalone HTML.
This container blocks navigation (including file://) via Chromium policy, so
we feed identical HTML bytes to an about:blank document with set_content.
This exercises an opaque origin and Blob Workers, with zero network requests.
This is NOT a macOS Safari or a real local-file navigation test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, math, time
BASE=Path(__file__).resolve().parent
HTML=BASE.parent/'three_body_lab_v1_1.html'
results=[]
def check(name,condition,details=None):
    results.append({'name':name,'passed':bool(condition),'details':details})
    print(('PASS ' if condition else 'FAIL ')+name,details or '')
    if not condition:raise AssertionError(name)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1500,'height':1000},accept_downloads=True)
    page=ctx.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append(r.url))
    page.set_content(HTML.read_text());page.wait_for_function('!!window.ThreeBodyLab')
    page.evaluate('ThreeBodyLab.pause()')
    check('page initialization / canvas',page.locator('#universe').evaluate('c => c.width > 100 && c.height > 100'))
    t=page.evaluate('ThreeBodyLab.state().t');page.wait_for_timeout(130)
    check('pause preserves time',page.evaluate('ThreeBodyLab.state().t')==t)
    page.click('#step');page.wait_for_timeout(140)
    check('single observation step',abs(page.evaluate('ThreeBodyLab.state().t')-t-.02)<1e-10)
    page.click('#play');page.wait_for_timeout(260);page.click('#play')
    check('play advances',page.evaluate('ThreeBodyLab.state().t')>t+.1)
    page.click('#reset');check('reset to initial state',page.evaluate('ThreeBodyLab.state().t')==0)
    # Presets and all starting data are finite.
    for preset in ['equilateral','asymmetric','butterfly','hierarchy','closepass','figure8']:
        page.click('[data-preset="'+preset+'"]');page.evaluate('ThreeBodyLab.pause()')
        s=page.evaluate('ThreeBodyLab.state()');check('preset '+preset,len(s['y'])==12 and all(math.isfinite(x) for x in s['y']))
    page.fill('#seed','19');page.click('#random');page.evaluate('ThreeBodyLab.pause()');a=page.evaluate('ThreeBodyLab.config()')
    page.click('#random');page.evaluate('ThreeBodyLab.pause()');bb=page.evaluate('ThreeBodyLab.config()')
    check('seed reproducibility',a['y']==bb['y'] and a['m']==bb['m'])
    # Accurate selected-body editing, no partial application.
    page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()')
    page.click('[data-body="1"]');before=page.evaluate('ThreeBodyLab.config().y')
    page.fill('#posx','-1.25');check('edit staged, not yet applied',page.evaluate('ThreeBodyLab.config().y')==before and page.evaluate('ThreeBodyLab.state().dirty'))
    page.click('#apply');s=page.evaluate('ThreeBodyLab.state()');check('body B edit applied',s['y'][2]==-1.25 and s['t']==0 and not s['dirty'])
    page.fill('#mass','0');page.click('#apply');check('invalid mass rejected atomically',page.evaluate('ThreeBodyLab.config().m[1]')==1 and '질량' in page.locator('#toast').inner_text())
    page.fill('#mass','1');page.click('#apply')
    page.select_option('#method','taylor');page.click('#apply');page.evaluate('ThreeBodyLab.advance(.1)')
    check('Taylor UI integration',page.evaluate('ThreeBodyLab.state().options.method')=='taylor' and abs(page.evaluate('ThreeBodyLab.state().t')-.1)<1e-14)
    page.select_option('#method','leapfrog');page.select_option('#dt','.01');page.click('#apply');check('fixed dt respected',page.evaluate('ThreeBodyLab.state().options.maxStep')==.01)
    # Restore original conditions before accuracy-sensitive UI tests.
    page.select_option('#method','rk45');page.select_option('#tolerance','1e-10');page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()')
    page.check('#ghost');page.evaluate('ThreeBodyLab.advance(.2)');check('ghost comparison produces finite separation',page.locator('#separation').inner_text() not in ['꺼짐','—','비교 중단'])
    check('ghost time reset',page.evaluate('ThreeBodyLab.state().t')==.2)
    page.select_option('#delta','.0001');check('delta change restarts comparison',page.evaluate('ThreeBodyLab.state().t')==0)
    # Round-trip config using a real JSON file input.
    original=page.evaluate('ThreeBodyLab.config()')
    payload=json.dumps(original).encode()
    page.locator('#file-input').set_input_files({'name':'roundtrip.json','mimeType':'application/json','buffer':payload})
    page.wait_for_function('ThreeBodyLab.config().preset.id==="imported"')
    restored=page.evaluate('ThreeBodyLab.config()');check('JSON roundtrip y/m/options',all(original[k]==restored[k] for k in ['y','m','options','comparison']))
    before=page.evaluate('ThreeBodyLab.config()')
    page.locator('#file-input').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{nope'})
    page.wait_for_timeout(100);after=page.evaluate('ThreeBodyLab.config()');check('malformed JSON preserves experiment',before['y']==after['y'] and before['options']==after['options'])
    bad=dict(restored);bad['m']=[-1,1,1]
    page.locator('#file-input').set_input_files({'name':'badmass.json','mimeType':'application/json','buffer':json.dumps(bad).encode()});page.wait_for_timeout(100)
    check('invalid imported masses preserve state',page.evaluate('ThreeBodyLab.config().m')==before['m'])
    # Downloads are actual Blob downloads, not only mocked callbacks.
    with page.expect_download() as info:page.click('#save')
    d=info.value;d.save_as(str(BASE/'downloaded-initial.json'))
    check('initial JSON download valid',json.loads((BASE/'downloaded-initial.json').read_text())['y']==before['y'])
    page.evaluate('ThreeBodyLab.advance(.1)')
    with page.expect_download() as info:page.click('#csv')
    d=info.value;d.save_as(str(BASE/'downloaded-observations.csv'))
    lines=(BASE/'downloaded-observations.csv').read_text(encoding='utf-8-sig').splitlines();check('CSV export has data and metadata',len(lines)>2 and 'normalized_energy_change' in lines[0] and 'mA' in lines[0])
    # All worker experiment types; simulation state unchanged.
    page.uncheck('#ghost');page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()')
    for kind in ['benchmark','compare','reversal','sensitivity']:
        page.fill('#experiment-time','2' if kind=='sensitivity' else '6')
        state0=page.evaluate('ThreeBodyLab.state().y')
        page.click('[data-experiment="'+kind+'"]');page.wait_for_selector('#reports-modal.open',timeout=20000)
        rep=page.evaluate('ThreeBodyLab.state().reports[0]')
        check('worker '+kind+' completed',rep['kind']==kind)
        check('worker '+kind+' preserves original state',state0==page.evaluate('ThreeBodyLab.state().y'))
        if kind=='benchmark':check('browser benchmark 10/10',rep['passed']==rep['total']==10)
        if kind=='compare':check('fixed endpoint regression in browser',all(row[-1]=='완료' for row in rep['rows']))
        page.click('[data-close="reports-modal"]')
    page.evaluate("ThreeBodyLab.runExperiment('sensitivity');document.getElementById('cancel-experiment').click()")
    check('worker termination and UI recovery',not page.evaluate('ThreeBodyLab.state().workerActive') and page.locator('[data-experiment="compare"]').is_enabled())
    # Actual pointer editing, using the documented initial camera-fit formula.
    page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()');page.uncheck('#ghost');page.click('#reset')
    box=page.locator('#viewport').bounding_box()
    scale=min(max(80,box['width']-92)/2.9,max(100,box['height']-225)/2)
    x=box['x']+box['width']/2+.97000436*scale
    y=box['y']+box['height']*.56+.24308753*scale
    old=page.evaluate('ThreeBodyLab.config().y')
    page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+30,y,steps=4);page.mouse.up()
    cur=page.evaluate('ThreeBodyLab.config().y')
    check('paused body drag updates initial position',abs(cur[0]-old[0]-30/scale)<1e-5 and page.evaluate('ThreeBodyLab.state().t')==0,{'expectedDelta':30/scale,'actualDelta':cur[0]-old[0],'t':page.evaluate('ThreeBodyLab.state().t'),'toast':page.locator('#toast').inner_text()})
    page.keyboard.down('Shift');page.mouse.move(x+30,y);page.mouse.down();page.mouse.move(x+40,y,steps=4);page.mouse.up();page.keyboard.up('Shift')
    new=page.evaluate('ThreeBodyLab.config().y')
    check('shift drag updates initial velocity',abs(new[6]-cur[6]-10/scale/.35)<1e-5)
    page.fill('#posx','1.3')
    stable=page.evaluate('ThreeBodyLab.config().y')
    page.mouse.move(x+30,y);page.mouse.down();page.mouse.move(x+35,y,steps=3);page.mouse.up()
    check('unapplied edits protected from drag',page.evaluate('ThreeBodyLab.config().y')==stable and page.evaluate('ThreeBodyLab.state().dirty'))
    page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()')
    page.click('#help');check('help opens and pauses',page.locator('#help-modal').evaluate("e=>e.classList.contains('open')") and not page.evaluate('ThreeBodyLab.state().playing'))
    page.keyboard.press('Escape');check('Escape closes dialog',not page.locator('#help-modal').evaluate("e=>e.classList.contains('open')"))
    # Safety-stop UI: initial close encounter, fixed step cannot resolve.
    page.click('[data-preset="asymmetric"]');page.evaluate('ThreeBodyLab.pause()');page.select_option('#method','rk4');page.select_option('#dt','.02');page.click('#apply');page.select_option('#speed','20');page.click('#play')
    page.wait_for_function('ThreeBodyLab.state().stopped',timeout=10000)
    check('near encounter stops visibly',page.locator('#view-message').is_visible() and page.locator('#play').is_disabled())
    page.select_option('#method','rk45');page.click('#apply');check('switching to adaptive recovers',not page.evaluate('ThreeBodyLab.state().stopped') and page.locator('#play').is_enabled())
    # Screenshot and offline rendering.
    page.click('[data-preset="figure8"]');page.evaluate('ThreeBodyLab.pause()');page.evaluate('ThreeBodyLab.advance(6.1)');page.wait_for_timeout(200)
    page.screenshot(path=str(BASE.parent/'three_body_lab_preview.png'))
    for width,height in [(1280,800),(900,900),(390,844)]:
        page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(100)
        dims=page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')
        check(f'responsive no horizontal overflow {width}',dims['scroll']==dims['w'],dims)
    check('no page runtime errors',not errors,errors)
    check('no network requests',not [u for u in requests if u.startswith(('http:','https:'))],requests[:5])
    (BASE/'browser_results.json').write_text(json.dumps({'browser':'Chromium '+b.version,'navigation':'about:blank set_content; policy blocks file navigation','webkit_or_safari_tested':False,'tests':results,'passed':sum(x['passed'] for x in results),'total':len(results),'errors':errors,'requests':requests},ensure_ascii=False,indent=2))
    b.close()
