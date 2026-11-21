
/* First-party, cookieless visit + dwell + referrer logger.
   Stores events in localStorage. If window.SITE_ANALYTICS_ENDPOINT is set,
   also POSTs a beacon. Optional GoatCounter: set window.GOATCOUNTER_CODE. */
(function () {
  var KEY = "yj_sites_analytics_v1";
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { return []; }
  }
  function save(rows) {
    try {
      if (rows.length > 400) rows = rows.slice(-400);
      localStorage.setItem(KEY, JSON.stringify(rows));
    } catch (e) {}
  }
  var start = Date.now();
  var path = location.pathname;
  var ref = document.referrer || "";
  function sameOrigin(u) {
    try { return new URL(u).origin === location.origin; } catch (e) { return false; }
  }
  var extRef = ref && !sameOrigin(ref) ? ref : (ref ? "(internal)" : "(direct)");
  function record(type, extra) {
    var row = Object.assign({
      t: new Date().toISOString(),
      type: type,
      path: path,
      ref: extRef,
      title: document.title,
      site: document.documentElement.getAttribute("data-site") || ""
    }, extra || {});
    var rows = load();
    rows.push(row);
    save(rows);
    var endpoint = window.SITE_ANALYTICS_ENDPOINT;
    if (endpoint && navigator.sendBeacon) {
      try { navigator.sendBeacon(endpoint, new Blob([JSON.stringify(row)], { type: "application/json" })); } catch (e) {}
    }
  }
  record("pageview");
  function dwell() {
    var ms = Date.now() - start;
    record("dwell", { ms: ms, sec: Math.round(ms / 1000) });
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") dwell();
  });
  window.addEventListener("pagehide", dwell);
  window.__yjAnalytics = { dump: load, record: record };
  if (window.GOATCOUNTER_CODE) {
    window.goatcounter = { no_onload: false };
    var s = document.createElement("script");
    s.async = true;
    s.dataset.goatcounter = "https://" + window.GOATCOUNTER_CODE + ".goatcounter.com/count";
    s.src = "https://gc.zgo.at/count.js";
    document.head.appendChild(s);
  }
})();
