# 실시간 코인 차트

- `binance-chart.html`은 **만들어진 파일**이다. `src/`의 조각(p1_head.html, p2_body.html, j*.js)을 `src/build.sh`가 이어 붙여 만든다.
- 기능을 고치거나 더할 때는 **`src/`를 고친 뒤 다시 만든다**. 차트 파일을 직접 고치면 다음 빌드 때 사라진다 (2026-10-27, 직접 넣은 신호 비서가 이렇게 사라졌다가 되살렸다).
- 다시 만들기: `bash src/build.sh src binance-chart.html /tmp/bc_check.js && node --check /tmp/bc_check.js`
- 새 조각 파일을 만들면 `src/build.sh`의 두 줄(차트 파일·검사 파일)에 같은 순서로 넣는다.
- 빌드 전에 `git log`로 다른 세션이 올린 커밋이 있는지 보고, 있으면 그 변경이 `src/`에 들어 있는지 확인한다.
- 커밋 메시지는 한국어로, 끝에 `Co-Authored-By` 줄을 단다. 배포는 GitHub Pages(main 브랜치).
