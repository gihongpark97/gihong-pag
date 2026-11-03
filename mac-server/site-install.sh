#!/bin/bash
# 홈페이지(gihong-pag.com)를 이 맥에서 띄우기.
#  1) Caddy 웹서버가 저장소 폴더를 127.0.0.1:8080 으로 보여 줘요. (밖에서는 직접 못 들어와요)
#  2) Cloudflare Tunnel 이 gihong-pag.com 과 www 를 이 맥의 8080 으로 연결해요. 공유기 설정은 필요 없어요.
#  3) 5분마다 GitHub main 을 받아서, 코드가 바뀌면 사이트에 바로 반영돼요.
# 사용법: ./site-install.sh            (설치/갱신. 몇 번 실행해도 괜찮아요)
#         ./site-install.sh --uninstall (사이트 끄기. 터널은 그대로 둬요)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DATA="${GIHONG_SERVER_DIR:-$HOME/.gihong-server}"
LA="$HOME/Library/LaunchAgents"
UID_=$(id -u)
WEB="com.gihong-pag.site"
UPD="com.gihong-pag.site-update"
TUNNEL="gihong-pag"
HOSTS=(gihong-pag.com www.gihong-pag.com)

load(){ launchctl bootout "gui/$UID_/$1" 2>/dev/null || true; launchctl bootstrap "gui/$UID_" "$LA/$1.plist"; }

if [[ "${1:-}" == "--uninstall" ]]; then
  for l in $WEB $UPD; do launchctl bootout "gui/$UID_/$l" 2>/dev/null || true; rm -f "$LA/$l.plist"; done
  echo "맥 웹서버와 자동 갱신을 껐어요. (Cloudflare 터널은 'cloudflared service uninstall' 로 끌 수 있어요)"
  exit 0
fi

BREW="$(command -v brew || true)"
[[ -z "$BREW" ]] && { echo "❌ Homebrew가 없어요. https://brew.sh 의 설치 명령을 먼저 실행해 주세요."; exit 1; }
for p in caddy cloudflared; do command -v $p >/dev/null || "$BREW" install $p; done
CADDY="$(command -v caddy)"; CF="$(command -v cloudflared)"
mkdir -p "$DATA/logs" "$LA"

# --- 저장소를 main 으로 맞추기 (이 맥의 사본은 보여 주기 전용) ---
git -C "$REPO" fetch -q origin main
git -C "$REPO" checkout -q main 2>/dev/null || git -C "$REPO" checkout -q -b main origin/main
git -C "$REPO" pull -q --ff-only origin main

# --- 1) Caddy ---
cat > "$DATA/Caddyfile" <<CF_
{
	admin off
	auto_https off
}
:8080 {
	bind 127.0.0.1
	root * $REPO
	# 사이트가 아닌 폴더(코드, 설정)는 밖에 보이지 않게 막아요.
	@hidden path /.git /.git/* /.github/* /mac-server /mac-server/* /scripts/* /node_modules/* /firestore.rules /CNAME
	respond @hidden 404
	header Cache-Control "no-cache"
	encode gzip
	file_server
	log {
		output file $DATA/logs/site-access.log {
			roll_size 10MiB
			roll_keep 3
		}
	}
}
CF_
"$CADDY" validate --config "$DATA/Caddyfile" --adapter caddyfile >/dev/null

cat > "$LA/$WEB.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$WEB</string>
  <key>ProgramArguments</key><array>
    <string>$CADDY</string><string>run</string><string>--config</string><string>$DATA/Caddyfile</string><string>--adapter</string><string>caddyfile</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$DATA/logs/site.log</string>
  <key>StandardErrorPath</key><string>$DATA/logs/site.log</string>
</dict></plist>
PL
load $WEB

# --- 3) 5분마다 GitHub main 받기 ---
cat > "$LA/$UPD.plist" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$UPD</string>
  <key>ProgramArguments</key><array>
    <string>/bin/sh</string><string>-c</string>
    <string>cd "$REPO" &amp;&amp; git checkout -q main &amp;&amp; git pull -q --ff-only origin main &amp;&amp; date "+%F %T 갱신 확인"</string>
  </array>
  <key>StartInterval</key><integer>300</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$DATA/logs/site-update.log</string>
  <key>StandardErrorPath</key><string>$DATA/logs/site-update.log</string>
</dict></plist>
PL
load $UPD

sleep 1
if curl -fsS -o /dev/null http://127.0.0.1:8080/; then echo "✅ 맥 웹서버가 떴어요: http://127.0.0.1:8080"; else echo "❌ 웹서버가 응답하지 않아요. $DATA/logs/site.log 를 확인해 주세요."; exit 1; fi

# --- 2) Cloudflare Tunnel ---
if [[ ! -f "$HOME/.cloudflared/cert.pem" ]]; then
  echo
  echo "다음은 Cloudflare 로그인이에요. 브라우저가 열리면 gihong-pag.com 을 고르고 '승인(Authorize)'을 눌러 주세요."
  "$CF" tunnel login
fi
if ! "$CF" tunnel info "$TUNNEL" >/dev/null 2>&1; then "$CF" tunnel create "$TUNNEL"; fi
TID="$("$CF" tunnel list -n "$TUNNEL" -o json | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)[0]["id"])')"
cat > "$HOME/.cloudflared/config.yml" <<YML
tunnel: $TID
credentials-file: $HOME/.cloudflared/$TID.json
ingress:
$(for h in "${HOSTS[@]}"; do printf '  - hostname: %s\n    service: http://127.0.0.1:8080\n' "$h"; done)
  - service: http_status:404
YML
for h in "${HOSTS[@]}"; do "$CF" tunnel route dns --overwrite-dns "$TUNNEL" "$h"; done
"$CF" service uninstall >/dev/null 2>&1 || true
"$CF" service install
echo
echo "✅ 터널을 켰어요. 몇 분 뒤 https://gihong-pag.com 이 이 맥에서 열려요."
echo "   기록: $DATA/logs/ (site.log, site-access.log, site-update.log), ~/Library/Logs/com.cloudflare.cloudflared.*.log"
