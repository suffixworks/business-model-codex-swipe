// Records reel.html (phone mockup driving the real app) to raw.webm via Chrome screencast.
import puppeteer from "puppeteer-core";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const URL = "http://localhost:8092/reel.html";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required", "--hide-scrollbars", "--mute-audio"],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
// Fixed shuffle so the deck order is the same on every take (app frame only)
await page.evaluateOnNewDocument(() => {
  if (!location.pathname.includes("/app/")) return;
  let a = 20261028; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  try { localStorage.clear(); localStorage.setItem("bmc-tutorial-done", "1"); } catch {}
});
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => document.fonts.ready);
const app = page.frames().find(f => f.url().includes("/app/"));
await app.evaluate(() => document.fonts.ready);
// The "tap ▶ in the player" hint is for real phones; headless Spotify can take a few seconds to start, so keep it out of the video
await app.addStyleTag({ content: ".phint{display:none!important}" });
await sleep(1500);

let fx = 540, fy = 1400;
const map = (x, y) => page.evaluate((x, y) => reel.map(x, y), x, y);
const rect = sel => app.evaluate(s => { const r = [...document.querySelectorAll(s)].filter(e => e.offsetParent || getComputedStyle(e).position === "fixed").pop().getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
async function moveTo(px, py, ms, down = false){
  const sx = fx, sy = fy, n = Math.max(2, Math.round(ms / 16));
  for (let i = 1; i <= n; i++) {
    const t = ease(i / n), x = sx + (px - sx) * t, y = sy + (py - sy) * t;
    await page.evaluate((x, y, d) => reel.finger(x, y, true, d), x, y, down);
    await page.mouse.move(x, y);
    await sleep(8);
  }
  fx = px; fy = py;
}
async function hide(){ await page.evaluate((x, y) => reel.finger(x, y, false), fx, fy); }
async function tap(x, y){ // app coords
  const [px, py] = await map(x, y);
  await moveTo(px, py, 450);
  await page.evaluate((x, y) => reel.finger(x, y, true, true), px, py);
  await page.mouse.down(); await sleep(110); await page.mouse.up();
  await page.evaluate((x, y) => reel.finger(x, y, true, false), px, py);
  await sleep(250);
}
async function swipe(dir){ // drag the top card left (-1) or right (1)
  const c = await rect(".card:not(.gone):last-of-type");
  const [px, py] = await map(c.x, c.y + 40);
  await moveTo(px, py, 400);
  await page.evaluate((x, y) => reel.finger(x, y, true, true), px, py);
  await page.mouse.down(); await sleep(80);
  await moveTo(px + dir * 420, py - 60, 520, true);
  await page.mouse.up();
  await page.evaluate((x, y) => reel.finger(x, y, true, false), fx, fy);
  await sleep(200);
}
const cap = (k, t) => page.evaluate((k, t) => reel.caption(k, t), k, t);

rmSync("frames", { recursive: true, force: true }); mkdirSync("frames");
const cdp = await page.createCDPSession();
const frames = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
  const name = `frames/${String(frames.length).padStart(5, "0")}.jpg`;
  writeFileSync(name, Buffer.from(data, "base64")); frames.push([name, metadata.timestamp]);
  cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
});
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 95, maxWidth: 1080, maxHeight: 1920, everyNthFrame: 1 });
const rec = { stop: async () => { await cdp.send("Page.stopScreencast"); writeFileSync("frames.json", JSON.stringify(frames)); } };
await sleep(300);
const SCENES = [
  { c: "orange", t: ["คุณทำ", "ธุรกิจอยู่", "หรือกำลัง", "จะเริ่ม?"] },
  { c: "ink", t: ["คำถาม", "ที่คุณไม่เคยถาม", "คือความเสี่ยง", "ที่คุณมองไม่เห็น"], blur: 3 },
  { c: "orange", t: ["ตั้งคำถาม", "ที่ทำให้เห็นจุดอ่อน", "และทางต่อยอดธุรกิจ"] },
  { c: "cream", t: ["พร้อม use case จริง", "จากบริษัท", "ในตลาดหลักทรัพย์", "ต่างประเทศ"] },
  { c: "ink", t: ["แล้วสร้างคำตอบ", "ของธุรกิจ", "คุณเอง"] },
];
// Swipe direction out of each scene, and how long each scene stays after its text lands
const DIR = [1, -1, 1, -1];
const HOLD = [1700, 2300, 2100, 2000, 1900];
await page.evaluate(s => reel.deck(s), SCENES);
await page.evaluate(() => reel.deckIn());
for (let i = 0; i < DIR.length; i++) { await sleep(HOLD[i]); await page.evaluate((i, d) => reel.swipe(i, d), i, DIR[i]); }
await sleep(HOLD[4]);
await page.evaluate(() => reel.toPhone());
await sleep(600);

await cap("1 · ปัดซ้าย", "ยังไม่ใช่คำถามของคุณ<br>ข้ามไป");
await sleep(700); await swipe(-1); await sleep(900);

await cap("2 · ปัดขวา", "คำถามนี้น่าสนใจ<br>เก็บไว้ฟัง");
await sleep(600); await swipe(1); await sleep(900); await swipe(1); await sleep(1100);

await cap("3 · แตะการ์ด", "ดูว่าเป็น use case<br>ของบริษัทไหน");
await sleep(600);
const card = await rect(".card:not(.gone):last-of-type");
await tap(card.x, card.y - 40); await sleep(2300);
await tap(187, 60); await sleep(700);

await cap("4 · กด ▶", "ฟังได้ทันที<br>ในหน้าเดิม");
await sleep(600);
const play = await rect("#bPlay");
await tap(play.x, play.y); await hide(); await sleep(3200);

await cap("5 · ปัดต่อได้", "ฟังไปด้วย<br>หาคำถามต่อไปด้วย");
await sleep(600); await swipe(-1); await sleep(800); await swipe(1); await sleep(1000);

await cap("6 · Playlist ของคุณ", "รวมคำถามที่เก็บไว้<br>จบตอนหนึ่ง เล่นตอนต่อไปให้เอง");
await sleep(600);
const saved = await rect("#savedBtn");
await tap(saved.x, saved.y); await hide(); await sleep(3600);

await page.evaluate(() => reel.end()); await sleep(4200);
await rec.stop();
await app.evaluate(() => { try { player.ctrl && player.ctrl.pause(); } catch {} });
await browser.close();
console.log("recorded", frames.length, "frames");
