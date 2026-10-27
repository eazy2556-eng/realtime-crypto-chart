#!/bin/bash
# 사용법: bash src/build.sh src binance-chart.html <문법 검사용 js 경로>
# binance-chart.html은 이 조각들을 이어 붙여 만든다. 차트 파일을 직접 고치지 말고 src를 고친 뒤 다시 만든다.
P="$1"
{ cat "$P/p1_head.html" "$P/p2_body.html"; printf '<script>\n(() => {\n'"'"'use strict'"'"';\n'; cat "$P"/j1_core.js "$P"/j2_types.js "$P"/j3_state.js "$P"/j4_render.js "$P"/j5a_venues.js "$P"/j5b_data.js "$P"/j6_draw.js "$P"/j7d_tv.js "$P"/j7e_replay.js "$P"/j7f_scale.js "$P"/j7g_alerts.js "$P"/j7h_multi.js "$P"/j7i_calc.js "$P"/j7j_signal.js "$P"/j7_ui.js "$P"/j7b_sync.js "$P"/j7c_cloud.js $( [ -f "$P/j8_debug.js" ] && echo "$P/j8_debug.js" ); printf '\n})();\n</script>\n</body>\n</html>\n'; } > "$2"
{ printf "(() => {\n'use strict';\n"; cat "$P"/j1_core.js "$P"/j2_types.js "$P"/j3_state.js "$P"/j4_render.js "$P"/j5a_venues.js "$P"/j5b_data.js "$P"/j6_draw.js "$P"/j7d_tv.js "$P"/j7e_replay.js "$P"/j7f_scale.js "$P"/j7g_alerts.js "$P"/j7h_multi.js "$P"/j7i_calc.js "$P"/j7j_signal.js "$P"/j7_ui.js "$P"/j7b_sync.js "$P"/j7c_cloud.js $( [ -f "$P/j8_debug.js" ] && echo "$P/j8_debug.js" ); printf '\n})();\n'; } > "$3"
