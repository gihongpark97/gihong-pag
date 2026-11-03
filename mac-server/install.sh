#!/bin/bash
# 맥 서버 설치: 패키지를 깔고, 5분마다 구글 캘린더를 맞추는 launchd 작업을 등록해요.
# 사용법: ./install.sh            (등록)
#         ./install.sh --uninstall (해제)
set -euo pipefail
LABEL="com.gihong-pag.gcal-sync"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
DIR="$(cd "$(dirname "$0")" && pwd)"
DATA="${GIHONG_SERVER_DIR:-$HOME/.gihong-server}"
INTERVAL="${SYNC_INTERVAL:-300}"   # 초. 기본 5분.

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "자동 실행을 껐어요. (비밀 파일은 $DATA 에 그대로 있어요)"
  exit 0
fi

NODE="$(command -v node || true)"
[[ -z "$NODE" ]] && { echo "❌ Node.js가 없어요. 먼저 'brew install node' 를 해 주세요."; exit 1; }
echo "Node: $NODE ($("$NODE" -v))"

cd "$DIR" && npm install --omit=dev --no-audit --no-fund

mkdir -p "$DATA/logs" && chmod 700 "$DATA"
missing=0
for f in google-oauth-client.json google-token.json firebase-service-account.json; do
  [[ -f "$DATA/$f" ]] || { echo "⚠️  아직 없어요: $DATA/$f"; missing=1; }
done
[[ $missing == 1 ]] && { echo "README의 2~4단계를 마친 뒤 다시 실행해 주세요."; exit 1; }

echo "한 번 시험으로 맞춰 볼게요…"
"$NODE" "$DIR/gcal-sync.js" || { echo "❌ 시험 실행이 실패했어요. 위 메시지를 확인해 주세요."; exit 1; }

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
    <string>$DIR/gcal-sync.js</string>
  </array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key>
  <dict><key>GIHONG_SERVER_DIR</key><string>$DATA</string></dict>
  <key>StartInterval</key><integer>$INTERVAL</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DATA/logs/gcal-sync.log</string>
  <key>StandardErrorPath</key><string>$DATA/logs/gcal-sync.log</string>
</dict>
</plist>
PL

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo
echo "✅ 등록했어요. $((INTERVAL/60))분마다 구글 캘린더를 맞춰요."
echo "   기록 보기: tail -f $DATA/logs/gcal-sync.log"
echo "   지금 바로: launchctl kickstart gui/$(id -u)/$LABEL"
