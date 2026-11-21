
/* Waitlist form. If window.FORMSUBMIT_EMAIL is set, posts via formsubmit.co (free, first-mail confirm).
   Otherwise shows a copyable summary and stores locally. No payment. */
(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function saveLocal(payload) {
    var k = "yj_waitlist_" + (payload.site || "site");
    var rows = [];
    try { rows = JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) {}
    rows.push(payload);
    try { localStorage.setItem(k, JSON.stringify(rows)); } catch (e) {}
  }
  function bind(form) {
    if (!form) return;
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      if (fd.get("website")) { return; } // honeypot
      var payload = {};
      fd.forEach(function (v, k) { payload[k] = String(v).trim(); });
      payload.site = document.documentElement.getAttribute("data-site") || "";
      payload.submitted_at = new Date().toISOString();
      payload.page = location.href;
      var status = form.querySelector(".form-status");
      var email = window.FORMSUBMIT_EMAIL;
      saveLocal(payload);
      if (email) {
        status.textContent = "보내는 중…";
        fetch("https://formsubmit.co/ajax/" + encodeURIComponent(email), {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (r) { return r.json(); }).then(function () {
          status.className = "form-status ok";
          status.textContent = "신청이 접수됐어. 확인 메일이 올 수도 있어.";
          form.reset();
        }).catch(function () {
          status.className = "form-status err";
          status.textContent = "전송에 실패했어. 아래 내용을 복사해서 보관해 줘.";
          showCopy(form, payload);
        });
      } else {
        status.className = "form-status ok";
        status.textContent = "이 브라우저에 신청을 저장했어. 아직 수신 메일 연결 전이라, 아래 내용을 복사해 두면 안전해.";
        showCopy(form, payload);
        form.reset();
      }
    });
  }
  function showCopy(form, payload) {
    var pre = form.querySelector(".form-copy");
    if (!pre) {
      pre = document.createElement("pre");
      pre.className = "form-copy";
      pre.style.cssText = "white-space:pre-wrap;background:var(--card);border:1px solid var(--line);padding:1rem;border-radius:8px;font-size:.85rem;";
      form.appendChild(pre);
    }
    pre.textContent = Object.keys(payload).map(function (k) { return k + ": " + payload[k]; }).join("\n");
  }
  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("form.waitlist").forEach(bind);
  });
})();
