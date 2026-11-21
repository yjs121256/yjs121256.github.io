#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""나라장터 입찰공고정보서비스(공공데이터포털)로 조경·소방 공고를 받아 JSON으로 저장.

무료 인증키 필요:
  1) https://www.data.go.kr 회원가입
  2) https://www.data.go.kr/data/15129394/openapi.do 에서 활용신청 (자동승인)
  3) 마이페이지 → 활용신청 현황 → 개발계정 상세의 Decoding(원본) 키를 복사
  4) python3 fetch_bids.py --service-key '키' --out ../data/sample.json

2026-11-10 안내: 조회 기간은 한 번에 7일. 개발 계정 하루 1,000회.
키는 커밋하지 말 것. 환경변수 DATA_GO_KR_SERVICE_KEY 도 지원.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

# 2026-11 문서 기준. 운영이 바뀌면 --base 로 덮어쓰기.
DEFAULT_BASES = [
    "https://apis.data.go.kr/1230000/ad/BidPublicInfoService02",
    "https://apis.data.go.kr/1230000/ad/BidPublicInfoService",
]
OPS = {
    "용역": "getBidPblancListInfoServc",
    "공사": "getBidPblancListInfoCnstwk",
    "물품": "getBidPblancListInfoThng",
}

JOGYONG = ("조경", "예초", "제초", "풀베기", "녹지", "수목", "가로수", "잔디", "정원", "화단", "수목원", "식물원")
SOBANG = ("소방", "스프링클러", "화재감지기", "소화전", "소방시설", "소방설비", "화재수신")


def classify(title: str) -> str | None:
    t = title or ""
    hit_j = any(k in t for k in JOGYONG)
    hit_s = any(k in t for k in SOBANG)
    if hit_s and not hit_j:
        return "소방"
    if hit_j and not hit_s:
        return "조경"
    if hit_j and hit_s:
        return "조경·소방"
    return None


def parse_items(raw: bytes) -> tuple[list[dict], str]:
    text = raw.decode("utf-8", errors="replace").lstrip()
    if text.startswith("{") or text.startswith("["):
        data = json.loads(text)
        # 공통 응답 또는 OpenAPI 표준
        body = data
        if isinstance(data, dict) and "response" in data:
            body = data["response"].get("body") or {}
            header = data["response"].get("header") or {}
            code = str(header.get("resultCode") or header.get("returnReasonCode") or "")
            msg = header.get("resultMsg") or header.get("returnAuthMsg") or ""
            if code and code not in ("00", "0", "03"):  # 03 often = no data
                return [], f"API error {code}: {msg}"
        items = []
        if isinstance(body, dict):
            inner = body.get("items") or body.get("item") or []
            if isinstance(inner, dict):
                inner = inner.get("item") or inner
            if isinstance(inner, dict):
                items = [inner]
            elif isinstance(inner, list):
                items = inner
        return items, ""
    # XML
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as e:
        return [], f"parse error: {e}; head={text[:200]!r}"
    # result code
    code = ""
    msg = ""
    for tag in ("resultCode", "returnReasonCode"):
        el = root.find(".//" + tag)
        if el is not None and el.text:
            code = el.text
            break
    for tag in ("resultMsg", "returnAuthMsg", "errMsg"):
        el = root.find(".//" + tag)
        if el is not None and el.text:
            msg = el.text
            break
    if code and code not in ("00", "0", "03"):
        return [], f"API error {code}: {msg}"
    items = []
    for el in root.findall(".//item"):
        rec = {c.tag: (c.text or "") for c in list(el)}
        items.append(rec)
    return items, ""


def call(base: str, op: str, key: str, start: str, end: str, page: int, rows: int) -> tuple[list[dict], str]:
    params = {
        "serviceKey": key,
        "pageNo": str(page),
        "numOfRows": str(rows),
        "type": "json",
        "inqryDiv": "1",
        "inqryBgnDt": start,
        "inqryEndDt": end,
    }
    # serviceKey must not be double-encoded; pass as query
    url = f"{base.rstrip('/')}/{op}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"Accept": "application/json, application/xml, */*"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
    except Exception as e:
        return [], f"http error: {e}"
    return parse_items(raw)


def notice_url(ntce_no: str, ntce_ord: str) -> str:
    # 나라장터 공고 조회용 공개 링크. 번호가 있으면 검색 쿼리로 연결.
    if not ntce_no:
        return "https://www.g2b.go.kr/"
    q = urllib.parse.quote(ntce_no)
    return f"https://www.g2b.go.kr/index.jsp?kwd={q}"


def normalize(rec: dict, niche: str) -> dict:
    # 필드명은 서비스 버전에 따라 다를 수 있어 후보를 순회
    def pick(*names):
        for n in names:
            if rec.get(n):
                return rec[n]
        return ""

    title = pick("bidNtceNm", "bidntcenm", "ntceNm")
    org = pick("ntceInsttNm", "ntceinsttnm", "dminsttNm", "dminsttnm")
    close = pick("bidClseDt", "bidclsedt", "opengDt", "opengdt")
    no = pick("bidNtceNo", "bidntceno")
    ord_ = pick("bidNtceOrd", "bidntceord")
    return {
        "niche": niche,
        "title": title,
        "org": org,
        "close": close,
        "bid_no": no,
        "bid_ord": ord_,
        "url": notice_url(no, ord_),
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch 조경/소방 bids from official KONEPS OpenAPI")
    ap.add_argument("--service-key", default=os.environ.get("DATA_GO_KR_SERVICE_KEY", ""))
    ap.add_argument("--out", default=str(Path_out_default()))
    ap.add_argument("--days", type=int, default=7, help="조회 일수, 최대 7 (2026-11-10 안내)")
    ap.add_argument("--rows", type=int, default=100)
    ap.add_argument("--max-pages", type=int, default=5)
    ap.add_argument("--base", default="", help="API 베이스 URL 강제")
    args = ap.parse_args()
    if not args.service_key:
        print("인증키가 없어. --service-key 또는 DATA_GO_KR_SERVICE_KEY 를 넣어 줘.", file=sys.stderr)
        print("발급: https://www.data.go.kr/data/15129394/openapi.do", file=sys.stderr)
        return 2
    days = min(max(args.days, 1), 7)
    now = datetime.now(KST)
    start = (now - timedelta(days=days)).strftime("%Y%m%d0000")
    end = now.strftime("%Y%m%d2359")
    bases = [args.base] if args.base else list(DEFAULT_BASES)
    collected: list[dict] = []
    errors: list[str] = []
    used_base = ""
    for base in bases:
        batch: list[dict] = []
        err_here = []
        ok_call = False
        for kind, op in OPS.items():
            items, err = call(base, op, args.service_key, start, end, 1, args.rows)
            if err:
                err_here.append(f"{base} {op}: {err}")
                continue
            ok_call = True
            for rec in items:
                title = rec.get("bidNtceNm") or rec.get("bidntcenm") or rec.get("ntceNm") or ""
                niche = classify(title)
                if not niche:
                    continue
                batch.append(normalize(rec, niche))
            # extra pages
            for page in range(2, args.max_pages + 1):
                more, err = call(base, op, args.service_key, start, end, page, args.rows)
                if err or not more:
                    break
                for rec in more:
                    title = rec.get("bidNtceNm") or rec.get("bidntcenm") or rec.get("ntceNm") or ""
                    niche = classify(title)
                    if niche:
                        batch.append(normalize(rec, niche))
        if ok_call:
            collected = batch
            used_base = base
            errors.extend(err_here)
            break
        errors.extend(err_here)
    # de-dupe
    seen = set()
    uniq = []
    for it in collected:
        k = (it.get("bid_no"), it.get("bid_ord"), it.get("title"))
        if k in seen:
            continue
        seen.add(k)
        uniq.append(it)
    uniq.sort(key=lambda x: (x.get("close") or "", x.get("title") or ""), reverse=True)
    payload = {
        "meta": {
            "generated_at": now.isoformat(),
            "range": f"{start}–{end}",
            "source": "조달청 나라장터 입찰공고정보서비스 (data.go.kr 15129394)",
            "base": used_base,
            "note": "원문은 나라장터. 제목 키워드로 조경·소방만 남겼고 공식 업종코드 분류는 아님.",
            "errors": errors,
        },
        "items": uniq,
    }
    out = Path_abs(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {out} ({len(uniq)} items) base={used_base}")
    if errors:
        print("warnings:", file=sys.stderr)
        for e in errors:
            print(" -", e, file=sys.stderr)
    return 0


def Path_out_default():
    from pathlib import Path
    return Path(__file__).resolve().parent.parent / "data" / "sample.json"


def Path_abs(p: str):
    from pathlib import Path
    return Path(p).resolve()


if __name__ == "__main__":
    # late import unused fix
    from pathlib import Path  # noqa: F401
    sys.exit(main())
