/* Cookie notice + GA4. Google Analytics only loads after the visitor taps "ตกลง" (choice kept in localStorage "bmc-consent").
   Shared by the app and the /ep/<n>/ pages; the measurement ID comes from config.js. */
(function () {
  var ID = (window.CONFIG || {}).ga4, KEY = "bmc-consent", loaded = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { dataLayer.push(arguments); };
  var get = function () { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  var set = function (v) { try { localStorage.setItem(KEY, v); } catch (_) {} };

  function load() {
    if (loaded || !ID) return;
    loaded = true;
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ID);
    document.head.appendChild(s);
    gtag("js", new Date()); gtag("config", ID);
  }
  // Remove GA cookies left from an earlier visit, on this host and the parent domain
  function clear() {
    document.cookie.split(";").forEach(function (c) {
      var n = c.split("=")[0].trim();
      if (n.indexOf("_ga") !== 0) return;
      var h = location.hostname.replace(/^www\./, "");
      ["", "; domain=" + location.hostname, "; domain=." + h].forEach(function (d) {
        document.cookie = n + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
      });
    });
  }
  // Events sent before a choice (or after "ไม่อนุญาต") are dropped, never queued
  window.bmcTrack = function (name, params) { if (loaded) gtag("event", name, params); };

  if (!ID) return;
  var choice = get();
  if (choice === "yes") { load(); return; }
  if (choice === "no") { clear(); return; }

  var css = ".ck{position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:60;max-width:420px;margin:0 auto;" +
    "background:#2a1912;color:#fff7f1;border:1px solid rgba(255,247,241,.24);border-radius:16px;padding:12px 12px 12px 16px;" +
    "display:flex;align-items:center;gap:12px;font:400 12.5px/1.5 Anuphan,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.35)}" +
    ".ck p{margin:0;flex:1;color:rgba(255,247,241,.82)}.ck .b{display:flex;gap:6px;flex-shrink:0}" +
    ".ck button{font:600 12.5px Anuphan,system-ui,sans-serif;border-radius:999px;padding:8px 12px;cursor:pointer;border:1px solid rgba(255,247,241,.24);background:none;color:#fff7f1}" +
    ".ck button.ok{background:#fff7f1;color:#dd492f;border-color:#fff7f1}" +
    ".ck button:focus-visible{outline:2px solid #fff7f1;outline-offset:2px}";
  function show() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    var d = document.createElement("div");
    d.className = "ck"; d.setAttribute("role", "region"); d.setAttribute("aria-label", "คุกกี้");
    d.innerHTML = '<p>เว็บนี้ใช้คุกกี้ของ Google Analytics เพื่อนับสถิติการใช้งาน</p>' +
      '<span class="b"><button type="button" data-v="no">ไม่อนุญาต</button><button type="button" class="ok" data-v="yes">ตกลง</button></span>';
    d.addEventListener("click", function (ev) {
      var v = ev.target.getAttribute && ev.target.getAttribute("data-v");
      if (!v) return;
      set(v); d.remove();
      if (v === "yes") load(); else clear();
    });
    document.body.appendChild(d);
  }
  if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
})();
