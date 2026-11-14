"""전체 종목 목록 만들기 (GitHub Actions에서 매일 실행).

한국투자증권이 공개하는 종목 마스터 파일(로그인 필요 없음)을 받아서
사이트 '보유 종목'의 종목 검색에 쓸 stocks-master.json 을 만들어요.
  국내: 코스피·코스닥 (주식, ETF, ETN, 리츠 등)
  미국: 나스닥·뉴욕·아멕스 (주식, ETF)
결과 모양: {"updatedAt": ms, "kr": [[코드, 이름, "P"|"Q"]], "us": [[티커, 한글이름, 영문이름, "NAS"|"NYS"|"AMS"]]}
"""
import io, json, re, sys, time, urllib.request, zipfile

BASE = "https://new.real.download.dws.co.kr/common/master/"
UA = {"User-Agent": "Mozilla/5.0 (gihong-pag stock master)"}


def fetch(name):
    for tries in range(3):
        try:
            req = urllib.request.Request(BASE + name, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            z = zipfile.ZipFile(io.BytesIO(data))
            return z.read(z.namelist()[0])
        except Exception as e:
            print(f"{name} 받기 실패({tries + 1}): {e}", file=sys.stderr)
            time.sleep(5)
    raise SystemExit(f"{name} 를 받지 못했어요")


def kr(name, tail, mkt):
    """코스피(.mst)는 한 줄 끝 228자, 코스닥은 222자가 고정 길이 정보예요.
    앞부분 = 단축코드(9) + 표준코드(12) + 한글 이름."""
    out = []
    for raw in fetch(name).split(b"\n"):
        line = raw.rstrip(b"\r")
        if len(line) <= tail + 21:
            continue
        head, rest = line[:-tail], line[-tail:]
        code = head[0:9].decode("cp949", "replace").strip()
        title = head[21:].decode("cp949", "replace").strip()
        group = rest[0:2].decode("ascii", "replace")
        if not re.fullmatch(r"[0-9A-Z]{6}", code) or not title:
            continue
        if group in ("EW", "SW", "SR", "BC", "IF"):   # ELW·신주인수권 등은 빼요
            continue
        out.append([code, title, mkt])
    return out


def us(name, excd):
    """해외 마스터(.cod)는 탭으로 나뉜 표예요.
    4 티커, 6 한글 이름, 7 영문 이름, 8 종류(1 지수, 2 주식, 3 ETF, 4 워런트)."""
    out = []
    for raw in fetch(name).split(b"\n"):
        cols = raw.decode("cp949", "replace").rstrip("\r").split("\t")
        if len(cols) < 9:
            continue
        symb, ko, en, kind = cols[4].strip(), cols[6].strip(), cols[7].strip(), cols[8].strip()
        if kind not in ("2", "3") or not re.fullmatch(r"[A-Z0-9.\-]{1,10}", symb):
            continue
        out.append([symb, ko, en, excd])
    return out


def main():
    data = {"updatedAt": int(time.time() * 1000)}
    data["kr"] = kr("kospi_code.mst.zip", 228, "P") + kr("kosdaq_code.mst.zip", 222, "Q")
    data["us"] = us("nasmst.cod.zip", "NAS") + us("nysmst.cod.zip", "NYS") + us("amsmst.cod.zip", "AMS")
    print("국내", len(data["kr"]), "개, 예:", data["kr"][:3])
    print("미국", len(data["us"]), "개, 예:", data["us"][:3])
    names = {c: n for c, n, _ in data["kr"]}
    print("확인: 005930 =", names.get("005930"), "/ 000660 =", names.get("000660"))
    if len(data["kr"]) < 1000 or len(data["us"]) < 1000 or "삼성" not in (names.get("005930") or ""):
        raise SystemExit("종목 수가 너무 적거나 형식이 바뀐 것 같아요. 올리지 않을게요.")
    with open("stocks-master.json", "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
