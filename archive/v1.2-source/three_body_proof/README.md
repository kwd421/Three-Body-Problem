# Three Body Lab v1.2

상위 폴더의 `three_body_lab_v1_2.html`을 브라우저로 열고 오른쪽 **증명 모드 → 유한시간 궤도 인증**을 누르세요. 설치·서버·외부 자산 없이 실행하는 단일 HTML입니다. 실제 file:// 및 Safari/Android 실기 검사는 하지 않았습니다.

기본 설정(비대칭, T=0.7, 차수14, 간격1/256)으로 구간 인증을 실행할 수 있습니다. `질량중심을 유지한 섭동 쌍`을 선택하면 두 실제 해의 유한시간 분리 증폭 구간을 계산합니다. `현재 시뮬레이터의 초기조건`은 적용된 t=0 입력만 사용하며, 연화 중력이면 거부합니다.

**컴퓨터 보조 증명**: 정수 구간 산술 + Picard 존재/유일성 + Taylor 나머지. 새로운 일반해나 혼돈의 증명은 아닙니다. 수학·구현·정수 런타임을 신뢰하며 형식검증된 정리 증명기는 아닙니다.

## 파일

- `PROOF_AND_VALIDATION.md`: 정확한 명제, 수학적 증명, 실행 결과, 신뢰 범위.
- `validated.js`: BigInt 192비트 격자 구간 생성기와 재검사기.
- `verify_certificate.py`: JS를 실행하지 않는 Python 표준 라이브러리 검사기.
- `verify_pair.py`: 두 인증서를 재검사한 뒤 위치 분리 부등식 검사.
- `asymmetric_Tp7.json`, `pair_certificate.json`: 재검사 가능한 증명서.
- `asymmetric_T1.json`: T=1 목표에 도달하지 못한 **부분 인증서**. 충돌 판정이 아님.
- `run_certificates.js`: 증명서 재생성. 외부 Node 패키지 불필요.
- `test_exact.py`: 정확 유리수 대조 2,410건과 변조 거부 시험.
- `test_legacy_browser.py`, `test_proof_browser.py`: Playwright/Chromium 회귀검사.
- `proof_panel.html`, `proof_ui.js`, `build.py`: UI와 단일 HTML 빌드.
- `legacy/`: 빌드의 원본 v1.1 HTML 및 기준 물리 엔진.
- `*_results.json`, `*_output.txt`: 실제 검사 결과.

## 재검사

```bash
python verify_certificate.py asymmetric_Tp7.json
python verify_pair.py pair_certificate.json
python test_exact.py
```

## 재생성

```bash
node run_certificates.js
python build.py
```

Python 검사기의 수학적 재귀식은 JS 생성기와 공유됩니다. 독립 언어로 재계산했지만 공통 명세 오류를 배제하는 형식검증은 아닙니다. 보통 시뮬레이터의 부동소수점 궤도는 구간 인증 계산과 별개입니다.

MIT License. 기존 v1.1의 물리 엔진과 기존 UI 기능은 유지했고, 별도의 증명 패널·증명 엔진을 추가했습니다.
