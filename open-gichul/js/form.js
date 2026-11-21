/* 문의 폼: 문의 건수는 즉시 집계. 내용은 운영자 메일 연동 전이면 안내만 함 */
(function(){
  var form = document.getElementById("feedback-form");
  if (!form) return;
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var fd = new FormData(form);
    var payload = {
      kind: fd.get("kind")||"",
      name: fd.get("name")||"",
      email: fd.get("email")||"",
      message: (fd.get("message")||"").trim()
    };
    if (!payload.message){ alert("내용을 입력해 주세요."); return; }
    if (window.OGAnalytics) OGAnalytics.inquiry();
    var box = document.getElementById("fb-result");
    var endpoint = (window.SITE && window.SITE.formEndpoint) ? window.SITE.formEndpoint : "";
    function done(ok, extra){
      box.hidden = false;
      box.innerHTML = ok
        ? "<strong>문의가 기록되었습니다.</strong> 수요 테스트용으로 건수부터 집계했고,"+(extra||" 내용은 메일 연동이 끝나면 운영자가 확인합니다.")
        : "<strong>건수는 기록했습니다.</strong> 메일 전송은 아직 연결 전이라, 내용을 복사해 두시거나 다음에 다시 보내 주세요.";
      form.reset();
    }
    if (endpoint){
      fetch(endpoint, {
        method:"POST",
        headers:{"Content-Type":"application/json","Accept":"application/json"},
        body: JSON.stringify(payload)
      }).then(function(r){ done(r.ok); }).catch(function(){ done(false); });
    } else {
      done(true, " 메일 주소는 운영자가 연결하면 내용도 전달됩니다.");
    }
  });
})();
