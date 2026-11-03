# 맥 홈 서버

> **사이트 → 구글 캘린더 추가**: 사이트 달력에서 색깔(캘린더)을 고르고 추가하면, `gcal-push.js`(늘 켜져 있음)가 몇 초 안에 구글 캘린더에 일정을 만들어요. 이 기능을 처음 켤 때는 일정 쓰기 권한이 필요해서 `npm run auth` 를 한 번 다시 하고 `./install.sh` 를 다시 실행해요. Firebase 규칙도 새로 게시해야 해요(`pbcopy < ~/gihong-pag/firestore.rules`).

맥을 늘 켜 두고, 홈페이지에 필요한 작업을 대신 돌리는 곳이에요.
지금은 **구글 캘린더 → 체크리스트 달력** 동기화 하나가 있어요. 5분마다 구글 캘린더를 읽어서 Firestore(`shared/home/gcal/*`)에 넣고, 사이트는 그걸 보여 줘요.
이제 사이트에서 '구글 연결'을 다시 누르지 않아도 일정이 계속 맞춰져요.

비밀 파일 3개는 저장소가 아니라 맥의 `~/.gihong-server/` 에만 둬요. (저장소가 공개라서요)

| 파일 | 무엇 | 어디서 |
|---|---|---|
| `google-oauth-client.json` | 구글 OAuth 클라이언트(데스크톱 앱) | 2단계 |
| `google-token.json` | 구글 갱신 토큰 | 3단계 (`npm run auth` 가 만들어요) |
| `firebase-service-account.json` | Firebase 서비스 계정 키 | 4단계 |

---

## 1. 맥이 잠들지 않게 하기

- **시스템 설정 › 에너지**(맥북은 **배터리 › 옵션**)
  - "디스플레이가 꺼져 있을 때 자동으로 잠자기 방지" 켜기
  - "정전 후 자동으로 시작" 켜기
- 또는 터미널에서:
  ```bash
  sudo pmset -a sleep 0 disksleep 0     # 잠자기 끄기 (화면은 꺼져도 괜찮아요)
  sudo pmset -a autorestart 1            # 정전 뒤 다시 켜지기
  ```
- 맥북이면 전원을 꽂아 두세요. 뚜껑을 닫으면 잠들 수 있으니 열어 두는 게 안전해요.
- 이 작업은 로그인한 사용자 계정에서 돌아요. 재부팅 뒤에도 돌게 하려면 **시스템 설정 › 사용자 및 그룹 › 자동 로그인**을 켜 두세요. (FileVault가 켜져 있으면 자동 로그인을 못 써서, 재부팅 뒤 한 번은 직접 로그인해야 해요.)

## 2. 구글 OAuth 클라이언트 만들기 (데스크톱 앱)

사이트에서 쓰는 '웹 애플리케이션' 클라이언트와는 따로, 맥용을 하나 더 만들어요.

1. [사용자 인증 정보](https://console.cloud.google.com/apis/credentials) › **사용자 인증 정보 만들기 › OAuth 클라이언트 ID**
2. 애플리케이션 유형: **데스크톱 앱**, 이름: `맥 서버`
3. 만들어지면 **JSON 다운로드** → 파일 이름을 바꿔서 옮겨요:
   ```bash
   mkdir -p ~/.gihong-server && chmod 700 ~/.gihong-server
   mv ~/Downloads/client_secret_*.json ~/.gihong-server/google-oauth-client.json
   ```
4. **중요:** [OAuth 동의 화면](https://console.cloud.google.com/apis/credentials/consent)에서 게시 상태를 **"테스트" → "프로덕션"(앱 게시)**으로 바꿔 주세요.
   테스트 상태에서는 갱신 토큰이 **7일마다 끊겨요**. 혼자 쓰는 앱이라 구글 심사는 받지 않아도 되고, 로그인할 때 "확인되지 않은 앱" 경고만 한 번 나와요.

## 3. 구글 로그인 한 번 하기

```bash
brew install node                  # Node.js가 없다면
git clone https://github.com/gihongpark97/gihong-pag.git ~/gihong-pag
cd ~/gihong-pag/mac-server
npm install
npm run auth                       # 브라우저가 열리면 기홍 구글 계정으로 로그인
```
"확인되지 않은 앱" 화면이 나오면 **고급 › (앱 이름)(으)로 이동**을 누르세요.
터미널에 `✅ 갱신 토큰을 저장했어요` 가 나오면 끝이에요.

## 4. Firebase 서비스 계정 키 받기

1. [Firebase 콘솔 › 프로젝트 설정 › 서비스 계정](https://console.firebase.google.com/project/gihong-pag/settings/serviceaccounts/adminsdk)
2. **새 비공개 키 생성** → 받은 파일을 옮겨요:
   ```bash
   mv ~/Downloads/gihong-pag-firebase-adminsdk-*.json ~/.gihong-server/firebase-service-account.json
   chmod 600 ~/.gihong-server/*.json
   ```
이 키는 Firestore 규칙을 건너뛰고 모든 데이터에 쓸 수 있어서, 절대 저장소나 메신저에 올리지 마세요.

## 5. 확인하고 자동 실행 켜기

```bash
npm run check      # Firestore에 쓰지 않고, 어떤 캘린더에서 몇 개 가져오는지만 보여 줘요
./install.sh       # 한 번 맞춰 보고, 5분마다 자동으로 돌게 등록해요
```

사이트 **공통업무 › 달력** 위에 "구글 캘린더 · 방금 맞춤"이 보이면 성공이에요.

---

## 평소에 쓰는 명령

| 하고 싶은 것 | 명령 |
|---|---|
| 기록 보기 | `tail -f ~/.gihong-server/logs/gcal-sync.log` |
| 지금 바로 맞추기 | `launchctl kickstart gui/$(id -u)/com.gihong-pag.gcal-sync` |
| 코드 업데이트 반영 | `cd ~/gihong-pag && git pull && cd mac-server && ./install.sh` |
| 자동 실행 끄기 | `./install.sh --uninstall` |
| 간격 바꾸기(예: 10분) | `SYNC_INTERVAL=600 ./install.sh` |

## 이럴 땐

- **`invalid_grant`** → 구글 연결이 끊긴 거예요. 동의 화면이 "프로덕션"인지 확인하고 `npm run auth` 를 다시 해요.
- **`구글 캘린더 API가 꺼져 있거나`** → [Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)가 '사용'인지 확인해요.
- **`파일이 없어요`** → `~/.gihong-server/` 안의 파일 이름을 위 표와 똑같이 맞춰요.
- 가져올 캘린더나 기홍/지연 나누기는 지금처럼 사이트 달력의 **설정**에서 바꾸면 돼요. 맥 서버도 그 설정을 그대로 따라요. (설정 화면에서 캘린더 목록을 보려면 사이트에서 '구글 연결'을 한 번 해야 해요.)

## 밖에서 맥에 접속하고 싶다면 (선택)

- **시스템 설정 › 일반 › 공유 › 원격 로그인** 켜기
- [Tailscale](https://tailscale.com/download)을 맥과 휴대폰에 깔고 같은 계정으로 로그인하면, 공유기 설정 없이 `ssh 맥이름` 으로 들어갈 수 있어요.

---

# 홈페이지를 맥에서 띄우기

GitHub Pages 대신 이 맥이 gihong-pag.com 을 직접 보여 줘요. 맥의 Caddy 웹서버가 저장소 폴더를 보여 주고, Cloudflare Tunnel 이 도메인을 맥에 연결해요. 공유기 포트 설정은 필요 없어요. GitHub main 에 새 코드가 올라오면 5분 안에 맥이 받아서 바로 반영해요.

**맥이 꺼지거나 인터넷이 끊기면 사이트도 같이 안 열려요.** 재부팅 뒤에는 맥에 한 번 로그인해야 다시 떠요.

1. [Cloudflare](https://dash.cloudflare.com/sign-up)에 무료 가입 → **사이트 추가** → `gihong-pag.com` → **Free** 요금제
2. Cloudflare가 알려 주는 **네임서버 2개**를 가비아 › 도메인 관리 › **네임서버 설정**에 넣기 (기존 가비아 네임서버 대신)
3. Cloudflare 화면에 "활성(Active)"이 뜰 때까지 기다리기 (보통 몇 분 ~ 몇 시간)
4. 맥 터미널:
   ```bash
   cd ~/gihong-pag/mac-server && ./site-install.sh
   ```
   Cloudflare 로그인 창이 뜨면 `gihong-pag.com` 을 고르고 승인해요.
5. https://gihong-pag.com 이 열리면, GitHub 저장소 **Settings › Pages** 에서 Pages 를 꺼요.

| 하고 싶은 것 | 명령 |
|---|---|
| 웹서버 기록 | `tail -f ~/.gihong-server/logs/site.log` |
| 사이트 끄기 | `./site-install.sh --uninstall` |
| 터널 끄기 | `cloudflared service uninstall` |
