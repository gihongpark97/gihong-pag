"""관심 키워드 뉴스 모으기 (GitHub Actions에서 30분마다 실행).

1. Firestore 공개 문서 public/stocks 에서 키워드 목록을 읽어요. (사이트가 키워드를 바꿀 때마다 써 둬요)
2. 키워드마다 구글 뉴스 RSS를 한국어판·영어판으로 받아요. 영어 검색어가 없으면 자동 번역해서 써요.
3. 영어 기사 제목은 한국어 번역도 붙여요.
4. 결과를 news.json 으로 저장해요. 워크플로가 news-data 브랜치에 올리고, 사이트가 그걸 읽어요.
"""
import json, os, re, sys, time, urllib.parse, urllib.request
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET

PROJECT = "gihong-pag"
API_KEY = "AIzaSyDz3rxziseAT8lZ-W1d5_FB2YF1yC5iXMk"  # 사이트에 공개된 웹 키와 같아요(비밀 아님)
DOC = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/public/stocks?key={API_KEY}"
UA = {"User-Agent": "Mozilla/5.0 (gihong-pag news collector)"}
DAYS = 3
PER_LANG = 20


def get(url, timeout=20):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def fs_value(v):
    if "stringValue" in v: return v["stringValue"]
    if "arrayValue" in v: return [fs_value(x) for x in v["arrayValue"].get("values", [])]
    if "mapValue" in v: return {k: fs_value(x) for k, x in v["mapValue"].get("fields", {}).items()}
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue" in v: return v["doubleValue"]
    if "booleanValue" in v: return v["booleanValue"]
    return None


def keywords():
    try:
        doc = json.loads(get(DOC))
        kws = fs_value({"mapValue": {"fields": doc.get("fields", {})}}).get("keywords") or []
        out = [k for k in kws if isinstance(k, dict) and k.get("text")]
        if out: return out
    except Exception as e:
        print("키워드 문서를 못 읽었어요:", e, file=sys.stderr)
    extra = os.environ.get("FALLBACK_KEYWORDS", "")
    return [{"text": t.strip()} for t in extra.split(",") if t.strip()]


_tcache = {}
def translate(text, sl, tl):
    key = (text, sl, tl)
    if key in _tcache: return _tcache[key]
    try:
        u = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&" + urllib.parse.urlencode({"sl": sl, "tl": tl, "q": text})
        data = json.loads(get(u, 10))
        out = "".join(seg[0] for seg in data[0] if seg and seg[0]).strip()
    except Exception:
        out = ""
    _tcache[key] = out
    time.sleep(0.15)
    return out


def has_hangul(s): return bool(re.search(r"[가-힣]", s))


def rss(query, lang):
    params = {"q": f"{query} when:{DAYS}d"}
    params.update({"hl": "ko", "gl": "KR", "ceid": "KR:ko"} if lang == "ko" else {"hl": "en-US", "gl": "US", "ceid": "US:en"})
    xml = get("https://news.google.com/rss/search?" + urllib.parse.urlencode(params))
    items = []
    for it in ET.fromstring(xml).iter("item"):
        title = (it.findtext("title") or "").strip()
        src = (it.findtext("source") or "").strip()
        if src and title.endswith(" - " + src): title = title[: -(len(src) + 3)]
        try: ts = int(parsedate_to_datetime(it.findtext("pubDate")).timestamp() * 1000)
        except Exception: ts = 0
        link = (it.findtext("link") or "").strip()
        if title and link.startswith("http"):
            items.append({"title": title, "link": link, "source": src, "date": ts, "lang": lang})
    items.sort(key=lambda x: -x["date"])
    return items[:PER_LANG]


def main():
    kws = keywords()
    print("키워드:", [k["text"] for k in kws])
    result = {"updatedAt": int(time.time() * 1000), "keywords": {}}
    for k in kws:
        text = k["text"]
        en = (k.get("en") or "").strip() or (translate(text, "ko", "en") if has_hangul(text) else text)
        entry = {"en": en, "items": [], "error": ""}
        try: entry["items"] += rss(text, "ko")
        except Exception as e: entry["error"] += f"ko:{e} "
        try:
            for it in rss(en, "en"):
                it["ko"] = translate(it["title"], "en", "ko")
                entry["items"].append(it)
        except Exception as e: entry["error"] += f"en:{e}"
        result["keywords"][text] = entry
        print(f"{text} / {en}: {len(entry['items'])}건", entry["error"])
        time.sleep(0.5)
    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))


if __name__ == "__main__":
    main()
