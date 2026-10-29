// Builds everything in public/ that comes from episodes.json and site.config.json:
//   episodes.js, config.js, ep/<n>/index.html (question pages with per-question OG meta), sitemap.xml, robots.txt,
//   og/<n>.png + og/default.png (rendered with local Google Chrome), sw.js, index.html OG URLs.
// Usage: node scripts/build.mjs [--og-all]   (--og-all re-renders every OG image)
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const OG_CACHE = join(ROOT, "scripts/og-cache.json");
const OG_VERSION = 6; // bump when the OG template changes
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const config = JSON.parse(await readFile(join(ROOT, "site.config.json"), "utf8"));
const site = config.siteUrl.replace(/\/+$/, "");
const all = JSON.parse(await readFile(join(ROOT, "episodes.json"), "utf8"));
const eps = all.filter(e => e.id && Array.isArray(e.q) && e.q.length).sort((a, b) => a.n - b.n);
const skipped = all.filter(e => !eps.includes(e));

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hash = s => createHash("sha1").update(s).digest("hex").slice(0, 10);
const exists = p => access(p).then(() => true, () => false);
const questionText = e => e.q.map(p => p.join(" ")).join(" ");

// ---------- data + config for the app ----------
await writeFile(join(PUB, "episodes.js"), "window.EP=" + JSON.stringify(eps.map(({ n, id, q, hook, co }) => ({ n, id, q, hook, co }))) + ";\n");
await writeFile(join(PUB, "config.js"), "window.CONFIG=" + JSON.stringify({
  ga4: config.ga4 || "",
  showUrl: "https://open.spotify.com/show/" + config.showId,
}) + ";\n");

// ---------- index.html: OG tags need absolute URLs ----------
let index = await readFile(join(PUB, "index.html"), "utf8");
index = index
  .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${site}/og/default.png$2`)
  .replace(/\n<meta property="og:url"[^\n]*/, "")
  .replace(/(<meta property="og:image" content="[^"]*">)/, `$1\n<meta property="og:url" content="${site}/">`);
await writeFile(join(PUB, "index.html"), index);

// ---------- question pages: /ep/<n>/ is a real page (question, hook, company, Spotify player) that search engines can index ----------
await rm(join(PUB, "ep"), { recursive: true, force: true });
const firstLine = e => e.q[0].join(" ");
for (const [i, e] of eps.entries()) {
  const url = `${site}/ep/${e.n}/`, title = questionText(e), desc = `EP.${e.n} ${e.co} · ${e.hook}`;
  const prev = eps[i - 1], next = eps[i + 1];
  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)} | Business Model Codex</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Business Model Codex">
<meta property="og:locale" content="th_TH">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${site}/og/${e.n}.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1c100b">
<link rel="icon" href="../../favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="../../icons/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&display=swap">
<link rel="stylesheet" href="../../ep.css">
</head>
<body>
<div class="page">
<header class="top"><a href="../../" aria-label="Business Model Codex"><img class="logo" src="../../img/wordmark.svg" alt="business model codex" width="1109" height="76"></a></header>
<main>
<article class="card">
<div class="ep">EP.${e.n}</div>
<h1>${e.q.map(p => `<span class="p">${p.map(l => `<span class="ln">${esc(l)}</span>`).join("")}</span>`).join("")}</h1>
<div class="foot"><p>${esc(e.hook)}</p><b>${esc(e.co)}</b></div>
</article>
<iframe class="player" title="ฟัง EP.${e.n} บน Spotify" src="https://open.spotify.com/embed/episode/${e.id}?theme=0" height="152" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>
<div class="btns">
<a class="btn main" href="../../">ปัดคำถามอื่น</a>
<a class="btn ghost" href="https://open.spotify.com/episode/${e.id}" target="_blank" rel="noopener">เปิดในแอป Spotify</a>
<button class="btn ghost" id="share" type="button">แชร์คำถามนี้</button>
</div>
<nav class="pn" aria-label="คำถามอื่น">${prev ? `<a class="prev" href="../${prev.n}/"><small>← EP.${prev.n}</small><span>${esc(firstLine(prev))}</span></a>` : "<span></span>"}${next ? `<a class="next" href="../${next.n}/"><small>EP.${next.n} →</small><span>${esc(firstLine(next))}</span></a>` : ""}</nav>
</main>
<footer class="credit">Created by <a href="https://suffix.works" target="_blank" rel="noopener"><img src="../../img/suffix.svg" alt="SUFFIX" width="320" height="63"></a></footer>
</div>
<script>
document.getElementById("share").onclick = async function(){
  var url = location.href.split("#")[0], b = this;
  try {
    if (navigator.share) { await navigator.share({ title: document.title, url: url }); return; }
    await navigator.clipboard.writeText(url); b.textContent = "คัดลอกลิงก์แล้ว"; setTimeout(function(){ b.textContent = "แชร์คำถามนี้"; }, 1800);
  } catch (err) { if (err && err.name !== "AbortError") prompt("คัดลอกลิงก์นี้", url); }
};
</script>
</body>
</html>
`;
  await mkdir(join(PUB, "ep", String(e.n)), { recursive: true });
  await writeFile(join(PUB, "ep", String(e.n), "index.html"), html);
}

// ---------- sitemap.xml + robots.txt ----------
await writeFile(join(PUB, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${site}/</loc></url>
${eps.map(e => `<url><loc>${site}/ep/${e.n}/</loc></url>`).join("\n")}
</urlset>
`);
await writeFile(join(PUB, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);

// ---------- OG images ----------
const fontUrl = pathToFileURL(join(ROOT, "scripts/assets/Anuphan.ttf")).href;
const markUrl = pathToFileURL(join(PUB, "img/wordmark.svg")).href;
const ogPage = body => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:Anuphan;src:url("${fontUrl}");font-weight:100 900}
*{box-sizing:border-box}html,body{margin:0;width:1200px;height:630px;overflow:hidden}
body{background:#dd492f;color:#fff;font-family:Anuphan,sans-serif;padding:52px 72px 48px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center}
.top img{height:30px}.top span{font-size:26px;font-weight:600;letter-spacing:.06em;opacity:.9}
.q{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:safe center;gap:22px;text-align:center;padding:36px 0 30px}
.q p{margin:0;font-weight:500;line-height:1.38}.q span{display:block;white-space:nowrap}
.foot{display:flex;justify-content:space-between;align-items:baseline;gap:24px;border-top:2px solid rgba(255,255,255,.35);padding-top:20px;font-size:24px}
.foot b{font-weight:600}.foot small{font-size:22px;opacity:.85;white-space:nowrap}
.hero{flex:1;display:flex;flex-direction:column;justify-content:center;gap:40px}.hero img{width:100%}
.hero p{margin:0;font-size:40px;font-weight:500;line-height:1.5}
</style></head><body>${body}<script>
document.fonts.ready.then(()=>{const q=document.querySelector(".q");if(q){let s=52;q.style.fontSize=s+"px";
while((q.scrollHeight>q.clientHeight||q.scrollWidth>q.clientWidth)&&s>26){s--;q.style.fontSize=s+"px"}}document.title="ready"});
</script></body></html>`;

const ogFor = e => ogPage(`<div class="top"><img src="${markUrl}"><span>EP.${e.n}</span></div>
<div class="q">${e.q.map(p => `<p>${p.map(l => `<span>${esc(l)}</span>`).join("")}</p>`).join("")}</div>
<div class="foot"><b>${esc(e.co)}</b><small>ฟังคำตอบใน Business Model Codex</small></div>`);
const ogDefault = ogPage(`<div class="hero"><img src="${markUrl}">
<p>ปัดคำถามธุรกิจสำหรับเจ้าของ SME<br>แล้วกดฟังตอนที่ตอบคำถามนั้นได้ทันที</p></div>
<div class="foot"><b>by SUFFIX</b><small>ฟังทุกตอนบน Spotify</small></div>`);

const cache = (await exists(OG_CACHE)) ? JSON.parse(await readFile(OG_CACHE, "utf8")) : {};
const force = process.argv.includes("--og-all");
const jobs = [];
const want = (name, html) => {
  const key = hash(OG_VERSION + html.replace(/file:\/\/[^"]*/g, ""));
  jobs.push({ name, html, key });
};
want("default", ogDefault);
for (const e of eps) want(String(e.n), ogFor(e));

await mkdir(join(PUB, "og"), { recursive: true });
const todo = [];
for (const j of jobs) if (force || cache[j.name] !== j.key || !(await exists(join(PUB, "og", j.name + ".png")))) todo.push(j);

if (todo.length) {
  if (!(await exists(CHROME))) {
    console.warn(`! ${todo.length} OG images need rendering but Google Chrome was not found (set CHROME_PATH). Skipping.`);
  } else {
    const tmp = join(tmpdir(), "bmc-og-" + process.pid);
    await mkdir(tmp, { recursive: true });
    const render = async j => {
      const src = join(tmp, j.name + ".html");
      await writeFile(src, j.html);
      await run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
        "--no-first-run", "--no-default-browser-check", "--allow-file-access-from-files",
        `--user-data-dir=${join(tmp, "profile-" + j.name)}`, "--window-size=1200,630", "--virtual-time-budget=4000",
        `--screenshot=${join(PUB, "og", j.name + ".png")}`, pathToFileURL(src).href], { timeout: 60000 });
      cache[j.name] = j.key;
    };
    const queue = todo.slice();
    await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await render(queue.shift()); }));
    await rm(tmp, { recursive: true, force: true });
    await writeFile(OG_CACHE, JSON.stringify(cache, null, 1) + "\n");
  }
}
// drop images for episodes that are gone
for (const name of Object.keys(cache)) if (!jobs.some(j => j.name === name)) { delete cache[name]; await rm(join(PUB, "og", name + ".png"), { force: true }); }

// ---------- service worker: cache name follows the app files, so a deploy refreshes clients ----------
const shell = ["index.html", "app.js", "app.css", "episodes.js", "config.js", "img/wordmark.svg", "img/suffix.svg", "manifest.webmanifest"];
let sig = "";
for (const f of shell) sig += await readFile(join(PUB, f), "utf8").catch(() => "");
const sw = (await readFile(join(ROOT, "scripts/sw.template.js"), "utf8"))
  .replace("__VERSION__", hash(sig))
  .replace("__SHELL__", JSON.stringify(["./", ...shell.filter(f => f !== "index.html"), "icons/icon-192.png"]));
await writeFile(join(PUB, "sw.js"), sw);

console.log(`built ${eps.length} episodes, ${todo.length} OG image(s) rendered, site ${site}`);
if (skipped.length) console.log(`skipped (no question yet): ${skipped.map(e => "EP." + e.n).join(", ")}`);
