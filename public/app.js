/* Business Model Codex Swipe
   EP and CONFIG come from episodes.js / config.js, both written by scripts/build.mjs */
const EP = (window.EP || []).filter(e => e.id && e.q && e.q.length);
const CONFIG = window.CONFIG || {};
const SHOW = CONFIG.showUrl || "https://open.spotify.com/show/72769c7eiWc88azlyoMtLQ";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const spotifyUrl = e => "https://open.spotify.com/episode/" + e.id;
const shareUrl = e => new URL("ep/" + e.n + "/", document.baseURI).href;
const byN = n => EP.find(e => e.n === n);
const deck = $("deck");
let pile = [], saved = [];

/* ---------- Analytics (GA4). No measurement ID in config.js = events are dropped ---------- */
window.dataLayer = window.dataLayer || [];
function gtag(){ dataLayer.push(arguments); }
if (CONFIG.ga4) {
  const s = document.createElement("script");
  s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(CONFIG.ga4);
  document.head.appendChild(s);
  gtag("js", new Date()); gtag("config", CONFIG.ga4);
}
function track(name, e, extra){
  const p = Object.assign(e ? { episode_number: e.n, company: e.co } : {}, extra);
  if (CONFIG.ga4) gtag("event", name, p);
  else if (CONFIG.debug) console.debug("[track]", name, p);
}

/* ---------- Saved list (localStorage only) ---------- */
try { saved = JSON.parse(localStorage.getItem("bmc-saved") || "[]").filter(n => byN(n)); } catch (_) { saved = []; }
const persist = () => { try { localStorage.setItem("bmc-saved", JSON.stringify(saved)); } catch (_) {} };

/* ---------- Deck ---------- */
function hashEp(){ const m = /^#ep-(\d+)$/.exec(location.hash); return m ? byN(+m[1]) : null; }
function shuffle(first){
  const a = EP.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  if (first) { const i = a.indexOf(first); if (i > 0) a.unshift(a.splice(i, 1)[0]); }
  return a;
}
function makeCard(e){
  const el = document.createElement("article"); el.className = "card"; el._ep = e;
  el.innerHTML = `<div class="stamp yes">เก็บไว้ฟัง</div><div class="stamp no">ข้าม</div>
   <div class="ep"><span>EP.${e.n}</span><span class="now"></span></div>
   <div class="q">${e.q.map(p => `<p>${p.map(l => `<span class="ln"><span>${esc(l)}</span></span>`).join("")}</p>`).join("")}</div>
   <div class="foot"><small>${esc(e.hook)}</small><b>${esc(e.co)}</b></div>`;
  return el;
}
const live = () => [...deck.querySelectorAll(".card:not(.gone)")];
const topCard = () => live().pop();

/* One font size for the whole deck: the largest at which every question (each line of episodes.json on one row)
   fits the card. Shared so cards never jump between sizes. Recomputed only when the card size changes.
   Only if the screen is too narrow even at the minimum size do lines get to wrap. */
const FONT_MIN = 14;
let fontKey = "", fontSize = 0;
function largestFit(c){
  const q = c.querySelector(".q");
  const over = () => q.scrollWidth > q.clientWidth + 1 || q.scrollHeight > q.clientHeight + 1;
  let s = Math.round(Math.min(25, Math.max(19, c.clientWidth * 0.066)));
  q.style.fontSize = s + "px";
  while (over() && s > FONT_MIN) { s -= 1; q.style.fontSize = s + "px"; }
  return s;
}
function deckFont(){
  const key = deck.clientWidth + "x" + deck.clientHeight + ":" + document.querySelector(".app").className;
  if (key === fontKey) return fontSize;
  let s = 99;
  for (const e of EP) { const c = makeCard(e); c.style.visibility = "hidden"; deck.prepend(c); s = Math.min(s, largestFit(c)); c.remove(); }
  fontKey = key; fontSize = s;
  return s;
}
function fit(c){
  if (!c.clientWidth) return;
  const q = c.querySelector(".q");
  q.classList.remove("wrap");
  q.style.fontSize = deckFont() + "px";
  if (q.scrollWidth > q.clientWidth + 1) q.classList.add("wrap");
}
const fitAll = () => { fontKey = ""; live().forEach(fit); };

function layout(){
  const cs = live();
  cs.forEach((c, i) => {
    const k = cs.length - 1 - i; c.style.zIndex = 10 - k;
    if (!c._drag) {
      c.style.transition = "transform .28s cubic-bezier(.2,.8,.2,1), filter .28s";
      c.style.transform = `translateY(${k * 12}px) scale(${1 - k * .045})`;
      c.style.filter = k ? `brightness(${1 - k * .15})` : "none";
    }
  });
  const t = topCard();
  if (t) { bind(t); try { history.replaceState(null, "", "#ep-" + t._ep.n); } catch (_) {} }
  if (t && !t._shown) { t._shown = true; animateQuestion(t); }
  markPlaying();
}

/* ---------- Question text animation, played once when a card reaches the top ----------
   Still being chosen: ?anim=a|b|c|d turns one on and shows a switcher to compare them. Off by default. */
const ANIMS = {
  a: { label: "ลอยขึ้น", run: q => lines(q).forEach((l, i) => l.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], { duration: 420, delay: i * 70, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" })) },
  b: { label: "ม่านเปิด", mask: true, run: q => lines(q).forEach((l, i) => l.firstChild.animate([{ transform: "translateY(140%)" }, { transform: "none" }], { duration: 520, delay: i * 80, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" })) },
  c: { label: "ชัดจากเบลอ", run: q => lines(q).forEach((l, i) => l.animate([{ opacity: 0, filter: "blur(8px)" }, { opacity: 1, filter: "blur(0)" }], { duration: 520, delay: i * 60, easing: "ease-out", fill: "backwards" })) },
  d: { label: "ทีละย่อหน้า", run: q => [...q.querySelectorAll("p")].forEach((p, i) => p.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 450, delay: i * 650, easing: "ease-out", fill: "backwards" })) },
};
const lines = q => [...q.querySelectorAll(".ln")];
let anim = (/[?&]anim=([a-d])/.exec(location.search) || [])[1] || "";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
function animateQuestion(c){
  const a = ANIMS[anim];
  if (!a || reduceMotion.matches || !c.animate) return;
  const q = c.querySelector(".q");
  q.getAnimations({ subtree: true }).forEach(x => x.cancel());
  q.classList.toggle("mask", !!a.mask);
  a.run(q);
}
function animSwitcher(){
  const bar = document.createElement("div"); bar.className = "animbar";
  bar.innerHTML = Object.entries(ANIMS).map(([k, a]) => `<button data-anim="${k}">${k.toUpperCase()} ${a.label}</button>`).join("");
  const sync = () => bar.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.anim === anim));
  bar.addEventListener("click", e => {
    const b = e.target.closest("[data-anim]"); if (!b) return;
    anim = b.dataset.anim; sync();
    try { history.replaceState(null, "", "?anim=" + anim + location.hash); } catch (_) {}
    if (topCard()) animateQuestion(topCard());
  });
  sync(); document.querySelector(".top").after(bar);
}
if (anim) animSwitcher();
function fill(first){
  while (live().length < 3) {
    if (!pile.length) pile = shuffle(first);
    first = null;
    const c = makeCard(pile.shift()); deck.prepend(c); fit(c);
  }
  layout();
}
function restart(first){ deck.innerHTML = ""; pile = []; fill(first); }

function bind(c){
  if (c._bound) return; c._bound = true;
  let sx = 0, sy = 0, dx = 0, dy = 0, t0 = 0, id = null;
  c.addEventListener("pointerdown", e => {
    id = e.pointerId; c.setPointerCapture(id); sx = e.clientX; sy = e.clientY; dx = dy = 0; t0 = Date.now();
    c._drag = true; c.classList.add("dragging"); c.style.transition = "none";
  });
  c.addEventListener("pointermove", e => {
    if (e.pointerId !== id) return; dx = e.clientX - sx; dy = e.clientY - sy;
    c.style.transform = `translate(${dx}px,${dy * .4}px) rotate(${dx / 18}deg)`;
    c.querySelector(".yes").style.opacity = Math.max(0, Math.min(1, dx / 90));
    c.querySelector(".no").style.opacity = Math.max(0, Math.min(1, -dx / 90));
  });
  const end = e => {
    if (e.pointerId !== id) return; id = null; c._drag = false; c.classList.remove("dragging");
    const v = Math.abs(dx) / Math.max(1, Date.now() - t0);
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) { layout(); openEp(c._ep); return; }
    if (Math.abs(dx) > 110 || v > .6) fling(c, dx > 0 ? 1 : -1, dy, "drag");
    else { c.querySelectorAll(".stamp").forEach(s => s.style.opacity = 0); layout(); }
  };
  c.addEventListener("pointerup", end); c.addEventListener("pointercancel", end);
}

function fling(c, dir, dy = 0, method = "button"){
  if (!c || c.classList.contains("gone")) return; c.classList.add("gone");
  c.querySelector(dir > 0 ? ".yes" : ".no").style.opacity = 1;
  c.style.transition = "transform .38s ease-out, opacity .38s";
  c.style.transform = `translate(${dir * innerWidth * 1.2}px,${dy * .4 + 40}px) rotate(${dir * 28}deg)`; c.style.opacity = 0;
  setTimeout(() => c.remove(), 400);
  track(dir > 0 ? "swipe_right" : "swipe_left", c._ep, { method });
  if (dir > 0) save(c._ep);
  fill();
}

/* ---------- UI helpers ---------- */
function toast(t){ const el = $("toast"); el.textContent = t; el.classList.add("on"); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("on"), 1800); }
function save(e){ if (!saved.includes(e.n)) { saved.unshift(e.n); persist(); } toast("เก็บ EP." + e.n + " ไว้ฟังแล้ว"); renderCount(); }
function renderCount(){ $("savedN").textContent = saved.length; }

function openSheet(html, kind){
  $("sheetBody").innerHTML = '<div class="grab"></div>' + html;
  $("sheet").dataset.kind = kind; $("sheet").classList.add("on"); $("scrim").classList.add("on"); $("sheet").scrollTop = 0;
}
function closeSheet(){ $("sheet").classList.remove("on"); $("scrim").classList.remove("on"); $("sheet").dataset.kind = ""; }
function openEp(e){
  const isSaved = saved.includes(e.n);
  track("open_detail", e);
  openSheet(`<div class="lbl">EP.${e.n}</div>
   <p class="sq">${e.q.map(p => `<span>${p.map(esc).join(" ")}</span>`).join("")}</p>
   <div class="ep-box"><p>${esc(e.hook)}</p><b>${esc(e.co)}</b></div>
   <div class="btns"><button class="btn sp" data-play="${e.n}">▶ ฟังเลย</button>
   <button class="btn ghost" data-save="${e.n}" ${isSaved ? "disabled" : ""}>${isSaved ? "เก็บไว้แล้ว" : "เก็บไว้ฟัง"}</button>
   <button class="btn ghost" data-share="${e.n}">แชร์คำถามนี้</button></div>
   <p class="note"><a class="btn ghost" href="${spotifyUrl(e)}" target="_blank" rel="noopener">เปิดในแอป Spotify</a></p>`, "ep");
}
function openSaved(){
  const items = saved.map(byN).filter(Boolean);
  openSheet(`<div class="lbl">เก็บไว้ฟัง · ${items.length} ตอน</div>` + (items.length
    ? `<ul class="list">${items.map(e => `<li class="${player.ep === e ? "cur" : ""}"><span class="n">EP.${e.n}</span>
      <span class="t"><span>${esc(e.q[0].join(" "))}</span><small>${esc(e.co)}</small><button class="rm" data-rm="${e.n}">เอาออก</button></span>
      <button class="go" data-play="${e.n}">ฟัง ▶</button></li>`).join("")}</ul>
      <p class="note">ฟังจบหนึ่งตอน ตอนถัดไปในรายการนี้จะเล่นต่อให้เอง</p>`
    : `<p class="empty">ยังไม่มีตอนที่เก็บไว้ ปัดการ์ดไปทางขวาเพื่อเก็บคำถามที่อยากฟังคำตอบ</p>`) +
    `<div class="btns"><a class="btn ghost" href="${SHOW}" target="_blank" rel="noopener">ฟังทุกตอนบน Spotify</a></div>`, "saved");
}
async function share(e){
  const url = shareUrl(e), text = e.q.map(p => p.join(" ")).join(" ");
  try {
    if (navigator.share) { await navigator.share({ title: "Business Model Codex EP." + e.n, text, url }); track("share", e, { method: "native" }); return; }
    await navigator.clipboard.writeText(url); toast("คัดลอกลิงก์แล้ว"); track("share", e, { method: "copy" });
  } catch (err) { if (err && err.name !== "AbortError") prompt("คัดลอกลิงก์นี้", url); }
}

$("sheetBody").addEventListener("click", ev => {
  const s = ev.target.closest("[data-save]"), r = ev.target.closest("[data-rm]"), p = ev.target.closest("[data-play]"), sh = ev.target.closest("[data-share]");
  if (s) { save(byN(+s.dataset.save)); s.textContent = "เก็บไว้แล้ว"; s.disabled = true; }
  if (r) { saved = saved.filter(n => n !== +r.dataset.rm); persist(); renderCount(); openSaved(); }
  if (p) { const kind = $("sheet").dataset.kind; play(byN(+p.dataset.play), kind === "saved" ? "saved" : "detail"); closeSheet(); }
  if (sh) share(byN(+sh.dataset.share));
});

/* ---------- Player: one Spotify embed, switched with loadUri ---------- */
const player = { ctrl: null, ep: null, wantPlay: false, isPaused: true, pos: 0, dur: 0, endedFor: null, startedFor: null, hintT: 0, queued: null };

window.onSpotifyIframeApiReady = api => {
  const first = topCard() ? topCard()._ep : EP[0];
  api.createController($("embed"), { uri: "spotify:episode:" + first.id, width: "100%", height: 80 }, ctrl => {
    player.ctrl = ctrl;
    ctrl.addListener("playback_update", onPlayback);
    if (player.queued) { const q = player.queued; player.queued = null; play(q.e, q.source); }
  });
};
(function loadSpotifyApi(){
  const s = document.createElement("script"); s.async = true; s.src = "https://open.spotify.com/embed/iframe-api/v1";
  document.head.appendChild(s);
})();

function play(e, source){
  if (!e) return;
  showPlayer(e);
  track("play", e, { source });
  if (!player.ctrl) { player.queued = { e, source }; showHintLater(); return; }
  if (player.ep === e && player.loaded === e) {
    if (player.isPaused) player.ctrl.resume();
  } else {
    player.ep = e; player.loaded = e; player.wantPlay = true; player.endedFor = null; player.startedFor = null; player.pos = 0; player.dur = 0;
    player.ctrl.loadUri("spotify:episode:" + e.id);
    // Some embeds ignore play() until the new episode has loaded, so play() goes out now and again on the first update (onPlayback)
    player.ctrl.play();
  }
  showHintLater();
}
function showPlayer(e){
  player.ep = e;
  $("player").classList.add("on"); document.querySelector(".app").classList.add("playing");
  $("pNow").innerHTML = `กำลังฟัง <b>EP.${e.n}</b> ${esc(e.co)}`;
  $("pOpen").href = spotifyUrl(e);
  requestAnimationFrame(fitAll);
  markPlaying();
}
/* Mobile Safari only lets audio start from a tap inside the embed. If nothing is playing a few seconds after ▶, say so */
const TAP_HINT = "แตะปุ่ม ▶ ในตัวเล่นด้านล่างเพื่อเริ่มฟัง";
const PREVIEW_MAX = 120000; // ms. Full episodes are far longer than Spotify's logged-out preview
function hint(html){ $("pHint").innerHTML = html; $("player").classList.add("hint"); }
function showHintLater(){
  clearTimeout(player.hintT); $("player").classList.remove("hint");
  player.hintT = setTimeout(() => { if (player.isPaused || !player.pos) hint(TAP_HINT); }, 3500);
}
function onPlayback(ev){
  const d = ev.data || {};
  player.isPaused = !!d.isPaused; player.dur = d.duration || 0;
  const prev = player.pos; player.pos = d.position || 0;
  if (player.wantPlay && d.isPaused && !d.isBuffering && player.ctrl) { player.wantPlay = false; player.ctrl.play(); }
  if (!d.isPaused && player.pos > 0) {
    player.wantPlay = false; clearTimeout(player.hintT); $("player").classList.remove("hint");
    if (player.ep && player.startedFor !== player.ep) player.startedFor = player.ep;
  }
  // Finished: position reached the end, or playback stopped right at the end (the embed rewinds when an episode ends)
  const e = player.ep;
  const atEnd = player.dur > 0 && (player.pos >= player.dur - 1000 || (d.isPaused && prev >= player.dur - 3000 && player.pos < prev));
  if (e && atEnd && player.startedFor === e && player.endedFor !== e) {
    player.endedFor = e;
    // Without a Spotify login the embed only plays a short preview. That is not a finished episode, so point to the full one instead of moving on
    if (player.dur <= PREVIEW_MAX) { track("preview_end", e); hint(`ตัวอย่างจบแล้ว ฟังเต็มตอนได้ใน <a href="${spotifyUrl(e)}" target="_blank" rel="noopener">แอป Spotify</a> หรือเข้าสู่ระบบ Spotify ในเบราว์เซอร์นี้`); return; }
    track("complete", e);
    const next = nextSaved(e);
    if (next) { toast("เล่นต่อ EP." + next.n + " จากรายการที่เก็บไว้"); play(next, "auto"); }
  }
}
function nextSaved(e){
  const list = saved.map(byN).filter(Boolean);
  const i = list.indexOf(e);
  if (i >= 0) return list[i + 1] || null;
  return list.find(x => x !== e) || null;
}
function markPlaying(){
  live().forEach(c => { c.querySelector(".now").textContent = player.ep === c._ep && $("player").classList.contains("on") ? "กำลังฟัง ♪" : ""; });
}
$("pClose").onclick = () => {
  if (player.ctrl) player.ctrl.pause();
  player.wantPlay = false; clearTimeout(player.hintT);
  $("player").classList.remove("on", "hint"); document.querySelector(".app").classList.remove("playing");
  markPlaying(); requestAnimationFrame(fitAll);
};

/* ---------- Wiring ---------- */
$("savedBtn").onclick = openSaved; $("scrim").onclick = closeSheet;
$("bSkip").onclick = () => fling(topCard(), -1);
$("bSave").onclick = () => fling(topCard(), 1);
$("bPlay").onclick = () => { const t = topCard(); if (t) play(t._ep, "card"); };
addEventListener("keydown", e => {
  if ($("sheet").classList.contains("on")) { if (e.key === "Escape") closeSheet(); return; }
  if (e.key === "ArrowRight") fling(topCard(), 1, 0, "key");
  if (e.key === "ArrowLeft") fling(topCard(), -1, 0, "key");
  if (e.key === "ArrowUp" && topCard()) openEp(topCard()._ep);
});
let sy0 = null;
$("sheet").addEventListener("touchstart", e => { if ($("sheet").scrollTop <= 0) sy0 = e.touches[0].clientY; }, { passive: true });
$("sheet").addEventListener("touchend", e => { if (sy0 !== null && e.changedTouches[0].clientY - sy0 > 70) closeSheet(); sy0 = null; });
addEventListener("hashchange", () => { const e = hashEp(); if (e && (!topCard() || topCard()._ep !== e)) { closeSheet(); restart(e); } });
let rT = 0; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(fitAll, 120); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

renderCount(); fill(hashEp());
