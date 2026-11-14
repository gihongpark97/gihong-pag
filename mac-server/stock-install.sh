#!/bin/bash
# 주식 시세 서비스 설치: 보유 종목 시세를 5초마다 받아 사이트에 넣는 프로그램을 늘 켜 두도록 launchd 에 등록해요.
# 사용법: ./stock-install.sh             (등록)
#         ./stock-install.sh --uninstall (해제)
#         STOCK_INTERVAL=10 ./stock-install.sh  (장중 간격을 10초로)
set -euo pipefail
LABEL="com.gihong-pag.stock-live"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="${GIHONG_SERVER_DIR:-$HOME/.gihong-server}"
INTERVAL="${STOCK_INTERVAL:-5}"
KRMKT="${KIS_KR_MARKET:-J}"   # J=한국거래소, UN=통합(넥스트레이드 포함)

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "주식 시세 서비스를 껐어요. (앱키는 $DATA/kis.json 에 그대로 있어요)"
  exit 0
fi

NODE="$(command -v node || true)"
[[ -z "$NODE" ]] && { echo "❌ Node.js가 없어요. 먼저 'brew install node' 를 해 주세요."; exit 1; }
cd "$DIR" && npm install --omit=dev --no-audit --no-fund

mkdir -p "$DATA/logs" && chmod 700 "$DATA"
missing=0
for f in kis.json firebase-service-account.json; do
  [[ -f "$DATA/$f" ]] || { echo "⚠️  아직 없어요: $DATA/$f"; missing=1; }
done
[[ $missing == 1 ]] && { echo "README의 '주식 시세 서비스' 단계를 마친 뒤 다시 실행해 주세요."; exit 1; }
chmod 600 "$DATA"/*.json

echo "한국투자증권 연결을 시험해 볼게요…"
"$NODE" "$DIR/stock-live.js" --check || { echo "❌ 시험이 실패했어요. 위 메시지를 확인해 주세요."; exit 1; }

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE</string>
    <string>$DIR/stock-live.js</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>GIHONG_SERVER_DIR</key><string>$DATA</string>
    <key>STOCK_INTERVAL</key><string>$INTERVAL</string>
    <key>KIS_KR_MARKET</key><string>$KRMKT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$DATA/logs/stock-live.log</string>
  <key>StandardErrorPath</key><string>$DATA/logs/stock-live.log</string>
</dict>
</plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo
echo "✅ 등록했어요. 장중에는 ${INTERVAL}초마다 시세를 받아요."
echo "   기록 보기: tail -f $DATA/logs/stock-live.log"
