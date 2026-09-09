"""Actual bundled HTML in Chromium. Not file://, Safari or physical Android certification."""
from pathlib import Path
import json,shutil,os
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parent.parent
rows=[]
def check(name,value):
    rows.append({'name':name,'passed':bool(value)})
    print(('PASS ' if value else 'FAIL ')+name,flush=True)
    assert value,name
with sync_playwright() as p:
    exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser=p.chromium.launch(headless=True,**({'executable_path':exe} if exe else {}),args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1500,'height':1000},accept_downloads=True)
    errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content((R/'dist/index.html').read_text())
    page.wait_for_function('!!window.ThreeBodyProofUI');page.evaluate('ThreeBodyLab.pause()')
    check('v1.3 badge',page.locator('.version').inner_text()=='v1.3')
    page.click('#open-proof')
    check('default target is T=1',page.input_value('#proof-time')=='1')
    check('default p20 and h=1/512',page.input_value('#proof-order')=='20' and page.input_value('#proof-step')=='9')
    original=page.evaluate('ThreeBodyLab.config().y')
    page.click('#proof-run')
    page.wait_for_function('ThreeBodyProofUI.result!==null && !ThreeBodyProofUI.busy',timeout=90000)
    r=page.evaluate('ThreeBodyProofUI.result.checks[0]')
    check('default certificate completes in browser',r['verified'] and r['complete'] and r['steps']==512)
    check('all-time distance certified',float(r['minDistanceLower'])>0.07536)
    check('end position enclosure width bounded',r['maxPositionWidth']<0.00056)
    check('simulation unchanged by proof',page.evaluate('ThreeBodyLab.config().y')==original)
    with page.expect_download() as download:page.click('#proof-export')
    dest=R/'research/results/browser_certificate.json';download.value.save_as(str(dest))
    c=json.loads(dest.read_text());check('download is schema 2',c['schema']=='three-body-interval-certificate-2')
    dest.unlink()
    page.screenshot(path=str(R/'research/results/browser_desktop.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(100)
    check('mobile no horizontal overflow',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
    check('mobile modal fits',page.locator('#proof-modal .modal').bounding_box()['width']<=390)
    page.screenshot(path=str(R/'research/results/browser_mobile.png'),full_page=True)
    page.keyboard.press('Escape');check('Escape closes dialog',not page.locator('#proof-modal').is_visible())
    page.close()
    page=browser.new_page(viewport={'width':390,'height':844})
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content((R/'dist/research.html').read_text())
    check('research page links to lab',page.locator('a[href="index.html"]').count()==2)
    check('mobile research page fits',page.evaluate('document.documentElement.scrollWidth===innerWidth'))
    page.set_viewport_size({'width':1400,'height':1000});page.screenshot(path=str(R/'research/results/research_desktop.png'),full_page=True)
    check('no browser runtime errors',not errors)
    result={'browser':browser.version,'navigation':'about:blank / set_content of delivered HTML bytes; file://, Safari and physical Android not tested','passed':len(rows),'tests':rows,'errors':errors}
    (R/'research/results/browser_tests.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    browser.close()
