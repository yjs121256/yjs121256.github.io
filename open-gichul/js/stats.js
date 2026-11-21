/* 통계 페이지 */
(function(){
  var root = document.getElementById("stats-app");
  if (!root || !window.OGAnalytics) return;
  var labels = {
    visits:"방문 수(세션 페이지뷰, 같은 탭에서 경로당 1회)",
    inquiries:"문의 제출 수",
    ref_direct:"유입: 직접·유입경로 없음",
    ref_naver:"유입: 네이버",
    ref_google:"유입: 구글",
    ref_daum:"유입: 다음",
    ref_cafe:"유입: 카페",
    ref_blog:"유입: 블로그",
    ref_youtube:"유입: 유튜브",
    ref_instagram:"유입: 인스타그램",
    ref_github:"유입: GitHub",
    ref_other:"유입: 기타",
    dwell_0_30:"체류 0–30초",
    dwell_30_60:"체류 30–60초",
    dwell_60_180:"체류 1–3분",
    dwell_180p:"체류 3분 이상",
    dwell_10s:"체류 초 합계(10초 단위)"
  };
  var keys = OGAnalytics.keys;
  Promise.all(keys.map(function(k){ return OGAnalytics.get(k).then(function(v){return [k,v];}); }))
    .then(function(rows){
      var map = {};
      rows.forEach(function(r){ map[r[0]]=r[1]; });
      var dwellSec = (map.dwell_10s||0)*10;
      var visits = map.visits||0;
      var avg = visits ? Math.round(dwellSec/visits) : 0;
      var html = '<div class="grid cards">';
      html += '<div class="card"><h3>방문</h3><div class="score">'+(map.visits||0)+'</div><p class="faint">경로당 세션 1회</p></div>';
      html += '<div class="card"><h3>문의</h3><div class="score">'+(map.inquiries||0)+'</div><p class="faint">폼 제출 수</p></div>';
      html += '<div class="card"><h3>평균 체류(근사)</h3><div class="score">'+avg+'초</div><p class="faint">10초 단위 합계 ÷ 방문</p></div>';
      html += '</div><div class="card" style="margin-top:16px"><h3>유입 경로</h3><ul>';
      ["ref_direct","ref_naver","ref_google","ref_daum","ref_cafe","ref_blog","ref_youtube","ref_instagram","ref_github","ref_other"].forEach(function(k){
        html += '<li>'+labels[k]+': <strong>'+(map[k]||0)+'</strong></li>';
      });
      html += '</ul><h3>체류 구간</h3><ul>';
      ["dwell_0_30","dwell_30_60","dwell_60_180","dwell_180p"].forEach(function(k){
        html += '<li>'+labels[k]+': <strong>'+(map[k]||0)+'</strong></li>';
      });
      html += '</ul><p class="faint">쿠키를 쓰지 않는 익명 카운터입니다. 광고 차단·일부 브라우저에서는 집계가 덜 될 수 있습니다.</p></div>';
      root.innerHTML = html;
    });
})();
