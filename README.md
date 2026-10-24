# 실시간 코인 차트

바이낸스 · 비트겟 · OKX의 현물과 USDT 무기한 선물을 트레이딩뷰처럼 보는 웹 페이지입니다.
서버 없이 브라우저가 각 거래소의 공개 시세 API에 직접 연결합니다. API 키나 로그인은 쓰지 않습니다.

- 열기: `binance-chart.html` (웹에서는 이 저장소의 GitHub Pages 주소)
- 지표·작도·관심 종목 설정은 기기마다 브라우저에 저장됩니다. 상단 "설정 옮기기"로 다른 기기에 링크·QR·파일로 옮길 수 있습니다.
- 자동 연동: 기기마다 GitHub 토큰(권한은 gist 하나)을 넣으면 내 계정의 비공개 gist 하나에 설정을 저장하고 기기끼리 맞춥니다. 토큰은 그 기기 브라우저에만 저장되고 GitHub 말고는 어디로도 보내지 않습니다.
- 휴대폰에서는 브라우저 메뉴의 "홈 화면에 추가"로 앱처럼 쓸 수 있습니다.

차트 그리기는 TradingView의 [Lightweight Charts](https://github.com/tradingview/lightweight-charts)(Apache-2.0)를 씁니다.
