/* CBT 엔진 */
(function(){
  var CIRC = ["①","②","③","④","⑤"];
  var root = document.getElementById("cbt-app");
  if (!root) return;
  var params = new URLSearchParams(location.search);
  var mode = params.get("mode") || "year"; // year | random
  var yearKey = params.get("exam") || "2025-36";
  var count = parseInt(params.get("n") || "40", 10);
  var timed = params.get("timer") !== "0";
  var data = [];
  var set = [];
  var idx = 0;
  var answers = {};
  var started = Date.now();
  var remain = 50*60;
  var timerId = null;
  var submitted = false;

  function esc(s){ return (s||"").replace(/[&<>"]/g, function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];}); }
  function choiceLabel(i){ return CIRC[i] || (i+1); }
  function qKey(q){ return q.id; }
  function isAllCorrect(q){ return !!q.allCorrect; }
  function officialAnswers(q){ return q.answer; }

  function load(){
    return fetch("data/questions.json").then(function(r){return r.json();}).then(function(j){
      data = j.questions;
      if (mode === "random") {
        var pool = data.slice();
        for (var i=pool.length-1;i>0;i--){ var k=Math.floor(Math.random()*(i+1)); var t=pool[i];pool[i]=pool[k];pool[k]=t; }
        set = pool.slice(0, Math.min(count, pool.length));
      } else {
        set = data.filter(function(q){ return q.examKey===yearKey; }).sort(function(a,b){return a.number-b.number;});
        remain = 50*60;
      }
      if (!set.length) { root.innerHTML = "<p>문항을 불러오지 못했습니다.</p>"; return; }
      render();
      if (timed) startTimer();
    }).catch(function(){
      root.innerHTML = "<p>문항 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>";
    });
  }

  function startTimer(){
    var el = document.getElementById("timer");
    timerId = setInterval(function(){
      remain = Math.max(0, remain-1);
      if (el){
        var m = String(Math.floor(remain/60)).padStart(2,"0");
        var s = String(remain%60).padStart(2,"0");
        el.textContent = m+":"+s;
      }
      if (remain===0){ clearInterval(timerId); submit(); }
    }, 1000);
  }

  function render(){
    if (submitted){ renderResult(); return; }
    var q = set[idx];
    var html = "";
    html += '<div class="quiz-bar">';
    html += '<div><strong>'+esc(q.roundLabel)+'</strong> · '+esc(q.subject)+' '+q.number+'번 <span class="muted">('+ (idx+1) +'/'+set.length+')</span></div>';
    html += '<div style="display:flex;gap:8px;align-items:center">';
    if (timed) html += '<span id="timer">--:--</span>';
    html += '</div></div>';
    html += '<div class="progress" aria-hidden="true"><span style="width:'+((idx+1)/set.length*100)+'%"></span></div>';
    html += '<div class="qnav" id="qnav"></div>';
    html += '<p class="stem">'+q.number+'. '+esc(q.stem)+'</p>';
    if (q.passageHtml) html += '<div class="material">'+q.passageHtml+'</div>';
    else if (q.passage) html += '<div class="passage">'+esc(q.passage)+'</div>';
    html += '<div class="choices">';
    (q.choices||[]).forEach(function(c,i){
      var sel = answers[qKey(q)] === (i+1);
      html += '<button type="button" class="choice'+(sel?' selected':'')+'" data-a="'+(i+1)+'"><span class="n">'+choiceLabel(i)+'</span><span>'+esc(c)+'</span></button>';
    });
    html += '</div>';
    html += '<div class="pager">';
    html += '<button class="btn outline" id="prev" '+(idx===0?"disabled":"")+'>이전</button>';
    if (idx < set.length-1) html += '<button class="btn" id="next">다음</button>';
    else html += '<button class="btn navy" id="submit">제출하고 채점</button>';
    html += '</div>';
    html += '<p class="faint">출처: 한국산업인력공단, 공공누리 제1유형. 이 자료는 공단 공식 문제·공식 답안으로 오인되면 안 됩니다.</p>';
    root.innerHTML = html;
    var nav = document.getElementById("qnav");
    set.forEach(function(item,i){
      var b = document.createElement("button");
      b.type="button";
      b.textContent = item.number;
      if (i===idx) b.classList.add("on");
      if (answers[qKey(item)]) b.classList.add("done");
      b.addEventListener("click", function(){ idx=i; render(); });
      nav.appendChild(b);
    });
    root.querySelectorAll(".choice").forEach(function(btn){
      btn.addEventListener("click", function(){
        answers[qKey(q)] = parseInt(btn.getAttribute("data-a"),10);
        render();
      });
    });
    var p = document.getElementById("prev"); if(p) p.onclick=function(){idx=Math.max(0,idx-1);render();};
    var n = document.getElementById("next"); if(n) n.onclick=function(){idx=Math.min(set.length-1,idx+1);render();};
    var s = document.getElementById("submit"); if(s) s.onclick=submit;
    if (timed && document.getElementById("timer")){
      var m = String(Math.floor(remain/60)).padStart(2,"0");
      var s2 = String(remain%60).padStart(2,"0");
      document.getElementById("timer").textContent = m+":"+s2;
    }
  }

  function isCorrect(q){
    if (isAllCorrect(q)) return true; // 전항정답: 미선택 포함 전원 득점
    var a = answers[qKey(q)];
    return officialAnswers(q).indexOf(a) !== -1;
  }

  function submit(){
    if (submitted) return;
    if (!confirm("지금 채점할까요? 제출하면 답을 고칠 수 없습니다.")) return;
    submitted = true;
    if (timerId) clearInterval(timerId);
    renderResult();
  }

  function renderResult(){
    var correct = 0;
    set.forEach(function(q){ if (isCorrect(q)) correct++; });
    var score = Math.round(correct / set.length * 1000)/10;
    var passSub = score >= 40;
    var html = '<div class="card">';
    html += '<h2>채점 결과</h2>';
    html += '<div class="score">'+score+'점</div>';
    html += '<p>'+correct+' / '+set.length+'문항 정답 · 과목 과락 기준(40점)은 이 과목만 보면 <strong>'+(passSub?"통과":"미달")+'</strong>입니다. 실제 합격은 1차 두 과목 평균 60점과 과목당 40점 이상입니다.</p>';
    html += '<div class="btns"><a class="btn" href="cbt.html?mode='+encodeURIComponent(mode)+'&exam='+encodeURIComponent(yearKey)+'&n='+count+'">다시 풀기</a><a class="btn outline" href="index.html">처음으로</a></div>';
    html += '</div>';
    set.forEach(function(q){
      var ok = isCorrect(q);
      var picked = answers[qKey(q)];
      html += '<article class="card" style="margin-top:12px">';
      html += '<div class="q-meta"><span class="pill">'+esc(q.roundLabel)+' '+q.number+'번</span><span class="pill" style="color:'+(ok? 'var(--good)':'var(--bad)')+'">'+(ok?'정답':'오답')+'</span>';
      if (q.allCorrect) html += '<span class="pill">전항정답</span>';
      html += '</div>';
      html += '<p class="stem">'+q.number+'. '+esc(q.stem)+'</p>';
      if (q.passageHtml) html += '<div class="material">'+q.passageHtml+'</div>';
      else if (q.passage) html += '<div class="passage">'+esc(q.passage)+'</div>';
      html += '<div class="choices">';
      (q.choices||[]).forEach(function(c,i){
        var n=i+1;
        var cls="choice";
        if (q.allCorrect || officialAnswers(q).indexOf(n)!==-1) cls += " correct";
        else if (picked===n) cls += " wrong";
        html += '<div class="'+cls+'"><span class="n">'+choiceLabel(i)+'</span><span>'+esc(c)+'</span></div>';
      });
      html += '</div>';
      html += '<p><strong>최종정답:</strong> '+(q.allCorrect ? "전항정답(①~⑤ 모두 정답)" : officialAnswers(q).map(function(n){return CIRC[n-1];}).join(", "));
      if (picked) html += ' · 내가 고른 답: '+CIRC[picked-1];
      else html += ' · 미응답'+(q.allCorrect?"(전항정답이라 득점)":"");
      html += '</p>';
      html += '<p class="muted">해설: 준비 중. <a href="'+esc(q.href)+'">정답 페이지 보기</a></p>';
      html += '</article>';
    });
    html += '<p class="source">본 저작물(기출문제, 최종정답)은 ‘한국산업인력공단’에서 (2013년 자료부터) 공공누리 제1유형으로 개방한 자료를 재가공한 것입니다. 한국산업인력공단의 공식 문제 또는 공식 답안으로 오인되면 안 됩니다.</p>';
    root.innerHTML = html;
  }

  load();
})();
