/* 열린기출 — 익명 집계(방문/유입/체류/문의). 개인정보·쿠키 없음 */
(function(){
  var NS = "open-gichul-cbt";
  var BASE = "https://abacus.jasoncameron.dev";
  function hit(key){
    try { fetch(BASE + "/hit/" + NS + "/" + key, {mode:"cors", keepalive:true}); } catch(e){}
  }
  function get(key){
    return fetch(BASE + "/get/" + NS + "/" + key, {mode:"cors"}).then(function(r){return r.json();}).then(function(j){return j.value||0;}).catch(function(){return 0;});
  }
  function refKey(){
    var r = document.referrer || "";
    var q = location.search || "";
    var u = q + " " + r;
    if (/[?&]utm_source=/.test(q)) {
      var m = q.match(/utm_source=([^&]+)/);
      if (m) {
        var s = decodeURIComponent(m[1]).toLowerCase();
        if (s.indexOf("naver")>-1) return "ref_naver";
        if (s.indexOf("google")>-1) return "ref_google";
        if (s.indexOf("cafe")>-1) return "ref_cafe";
        if (s.indexOf("blog")>-1) return "ref_blog";
        return "ref_other";
      }
    }
    if (!r) return "ref_direct";
    r = r.toLowerCase();
    if (r.indexOf("naver.com")>-1 && r.indexOf("cafe")>-1) return "ref_cafe";
    if (r.indexOf("blog.naver.com")>-1 || r.indexOf("post.naver.com")>-1) return "ref_blog";
    if (r.indexOf("naver.com")>-1 || r.indexOf("search.naver")>-1) return "ref_naver";
    if (r.indexOf("google.")>-1) return "ref_google";
    if (r.indexOf("daum.net")>-1 || r.indexOf("search.daum")>-1) return "ref_daum";
    if (r.indexOf("tistory.com")>-1) return "ref_blog";
    if (r.indexOf("youtube.com")>-1 || r.indexOf("youtu.be")>-1) return "ref_youtube";
    if (r.indexOf("instagram.com")>-1) return "ref_instagram";
    if (r.indexOf("github.com")>-1 || r.indexOf("github.io")>-1) return "ref_github";
    return "ref_other";
  }
  var started = Date.now();
  var sentVisit = false;
  try {
    var sk = "ogc_v_" + location.pathname;
    if (!sessionStorage.getItem(sk)) {
      sessionStorage.setItem(sk, "1");
      hit("visits");
      hit(refKey());
      sentVisit = true;
    }
  } catch(e){
    hit("visits"); hit(refKey()); sentVisit = true;
  }
  function sendDwell(){
    var sec = Math.max(0, Math.round((Date.now()-started)/1000));
    if (sec < 1) return;
    // 체류 초를 여러 번 나눠 기록(한 카운터는 1씩만 증가하므로 루프는 피하고 구간만 기록)
    if (sec < 30) hit("dwell_0_30");
    else if (sec < 60) hit("dwell_30_60");
    else if (sec < 180) hit("dwell_60_180");
    else hit("dwell_180p");
    // 총 초는 최대 600초까지 1초 단위가 아니라 합산용으로 10초 단위 근사
    var tens = Math.min(60, Math.round(sec/10));
    for (var i=0;i<tens;i++) hit("dwell_10s");
  }
  var dwellSent = false;
  function onceDwell(){
    if (dwellSent) return;
    dwellSent = true;
    sendDwell();
  }
  document.addEventListener("visibilitychange", function(){ if (document.visibilityState==="hidden") onceDwell(); });
  window.addEventListener("pagehide", onceDwell);
  window.OGAnalytics = {
    hit: hit,
    get: get,
    inquiry: function(){ hit("inquiries"); },
    keys: ["visits","inquiries","ref_direct","ref_naver","ref_google","ref_daum","ref_cafe","ref_blog","ref_youtube","ref_instagram","ref_github","ref_other","dwell_0_30","dwell_30_60","dwell_60_180","dwell_180p","dwell_10s"]
  };
})();
