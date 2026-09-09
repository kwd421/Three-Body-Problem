# Three Body Problem · 삼체 실험실

평면 뉴턴 삼체 시뮬레이션, 유한시간 구간 인증, 독립 검사기를 함께 관리합니다.

## 사이트 / 자동 갱신

GitHub Pages 공개 주소는 활성화 후 **https://kwd421.github.io/Three-Body-Problem/** 입니다. 연구 페이지는 같은 주소의 `research.html`입니다. [Actions](https://github.com/kwd421/Three-Body-Problem/actions)에서 실제 배포 상태를 확인하세요. Pages가 아직 비활성이라면 **Settings → Pages → Source: GitHub Actions**를 선택하고 배포 작업을 다시 실행합니다. 성공 배포 확인 전에는 위 주소가 가동 중이라고 해석하지 마세요.

main push → 정해진 인증 실험 재현 → 정확 산술 검사 → Python 독립 재검사 → 사이트 빌드 → Pages 배포. 검사 실패 시 배포하지 않습니다. AI가 백그라운드에서 새 정리를 연구하는 예약 작업은 아닙니다. 열린 실험실은 새 커밋을 60초마다 확인하고 강제 새로고침 대신 버튼을 표시합니다.

## 현재 결과 / v1.3

정확한 초기조건 m=(1,2,3), r=((-1,0),(1,0),(0,1)), v=((0,0.3),(0,-0.2),(-0.1,0)), G=1, epsilon=0.

가중 노름의 Picard 수축 조건과 정수/2^192 구간 산술로 **0≤t≤1의 유일한 해와 충돌 회피**를 인증했습니다. 모든 시각·물체 쌍의 거리 **>0.07536**, t=1의 각 위치 구간 너비 **<0.00056**입니다. 512단계를 Python이 독립 재계산합니다.

이 초기값 문제와 유한시간의 결과입니다. 일반해·혼돈·무한시간 안정성의 증명 또는 Lean/Isabelle 형식검증은 아닙니다. 코드·명세·정수 런타임이 신뢰 기반입니다. 이전 T=.7보다 인증 시간은 길지만 끝점 구간은 넓어졌습니다.

## 구조

- src/: 현재 구간 엔진과 독립 Python 검사기.
- site/lab-template.html: 편집 가능한 시뮬레이터·증명 UI.
- research/: 유도·실험 기록·인증 JSON·검사 결과.
- archive/v1.2-source/: 이전 v1.1/v1.2 HTML·소스·보고서와 재생성 인증서.
- tools/: 재현·빌드 스크립트. bootstrap/upgrade는 최초 이관용이며 기존 파일을 덮어쓰지 않습니다.
- tests/: 정확 유리수 대조, 변조 거부, 형식 호환성, 선택 브라우저 검사.

## 재현

Node.js 22, Python 3.11 이상. 핵심 인증·빌드는 외부 패키지가 필요 없습니다.

```bash
node tools/run_research.js
python tools/verify_research.py
python tests/test_exact.py
node tests/test_compatibility.js
python tools/build_site.py
python -m http.server 8000 --directory dist
```

`dist/index.html`은 단일 파일로도 실행합니다. research.html의 다운로드·이전 버전 링크는 dist 전체를 함께 사용하세요. `dist/reproduce.zip`은 재현 코드와 기록 묶음입니다.

선택 브라우저 검사:
```bash
python -m pip install playwright
python -m playwright install chromium
python tests/test_site.py
```

목표나 초기조건 변경 시 검사 명제·보고서·사이트 표시를 함께 갱신하세요. 상세 증명은 research/2026-09-09-weighted-norm.md, 다음 과제는 Issues에 둡니다.

MIT. 원본 LICENSE는 archive에 보존합니다.
