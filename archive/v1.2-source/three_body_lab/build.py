#!/usr/bin/env python3
"""Rebuild the self-contained offline HTML from readable source files."""
from pathlib import Path
base=Path(__file__).resolve().parent
html=(base/'template.html').read_text()
for key,name in [('STYLE','style.css'),('PHYSICS','physics.js'),('EXPERIMENTS','experiments.js'),('APP','app.js')]:
    html=html.replace('/*__'+key+'__*/',(base/name).read_text())
output=base.parent/'three_body_lab_v1_1.html'
output.write_text(html)
print(f'{output} ({len(html.encode()):,} bytes)')
