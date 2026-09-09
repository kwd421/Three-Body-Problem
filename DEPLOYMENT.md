# 배포 상태와 최초 활성화

## 최초 배포 기록 — 2026-09-09

[실행 #3](https://github.com/kwd421/Three-Body-Problem/actions/runs/34300151803)에서 verify-build는 성공했습니다. T=1 증명서 생성, Python 독립 검사, 정확 산술·변조 검사, 사이트 빌드, verified-static-site 및 github-pages 아티팩트 업로드가 모두 통과했습니다.

배포는 Configure Pages 단계에서 `Get Pages site failed ... Not Found`로 중단됐습니다. 페이지 게시가 성공한 상태로 표시하지 않습니다. 현재 사용한 GitHub App 연결은 저장소 관리 권한을 제공하지 않으므로 Pages 최초 활성화는 소유자 설정이 필요합니다.

## 한 번만 필요한 소유자 설정

1. [Settings → Pages](https://github.com/kwd421/Three-Body-Problem/settings/pages)에서 Build and deployment의 Source를 **GitHub Actions**로 선택합니다.
2. [배포 워크플로](https://github.com/kwd421/Three-Body-Problem/actions/workflows/site.yml)에서 **Run workflow → Branch: main → Run workflow**로 현재 main을 실행합니다.
3. deploy가 성공한 뒤 https://kwd421.github.io/Three-Body-Problem/ 를 확인합니다.

그 뒤 main push마다 같은 검증 후 자동 갱신됩니다. 이 문서는 첫 시도의 기록이며 현재 상태는 Actions의 최신 실행을 기준으로 봅니다. 이전 이관 실행 전체를 Re-run하면 당시 커밋에서 재시작하므로, 위처럼 현재 main을 대상으로 새 실행을 만드는 편이 안전합니다.

## 권한 및 비용 경계

검증 작업은 체크된 증거를 저장하기 위한 contents:write, 배포 작업은 pages:write와 id-token:write만 사용합니다. 비밀 키를 코드에 넣지 않았고 외부 AI API·유료 서버·무인 연구 예약을 구성하지 않았습니다. Actions는 문서에 고정된 유한시간 실험만 재생합니다.

사이트가 꺼져 있어도 성공한 verify-build의 verified-static-site 아티팩트를 내려받아 index.html을 열거나, 저장소에서 tools/build_site.py를 실행해 dist를 만들 수 있습니다.
