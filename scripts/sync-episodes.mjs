// Pulls the show's episode list from the Spotify Web API and fills id / hook / co in episodes.json
// for Business Model Codex episodes (titles shaped "EP.<n> <hook> — <company>").
// Questions (q) are never written here: new episodes are added with q: [] and listed so they can be filled in by hand.
//
// Usage: node scripts/sync-episodes.mjs [--dry-run] [--update]
//   --dry-run  show what would change, write nothing
//   --update   also overwrite id / hook / co that differ from Spotify (default: only fill empty fields)
// Needs SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env (never committed).
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = join(ROOT, "episodes.json");
const args = new Set(process.argv.slice(2));
const DRY = args.has("--dry-run"), UPDATE = args.has("--update");

async function loadEnv(){
  try {
    for (const line of (await readFile(join(ROOT, ".env"), "utf8")).split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  } catch { /* no .env: rely on the real environment */ }
}
await loadEnv();
const { SPOTIFY_CLIENT_ID: ID, SPOTIFY_CLIENT_SECRET: SECRET } = process.env;
if (!ID || !SECRET) { console.error("Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (put them in .env)"); process.exit(1); }
const config = JSON.parse(await readFile(join(ROOT, "site.config.json"), "utf8"));

async function token(){
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(ID + ":" + SECRET).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Spotify token request failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}
async function allEpisodes(tok){
  const out = [];
  let url = `https://api.spotify.com/v1/shows/${config.showId}/episodes?market=TH&limit=50`;
  while (url) {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1000 * (+res.headers.get("retry-after") || 2))); continue; }
    if (!res.ok) throw new Error(`Spotify episodes request failed: ${res.status} ${await res.text()}`);
    const page = await res.json();
    out.push(...page.items.filter(Boolean));
    url = page.next;
  }
  return out;
}

// "EP.12 <hook> — <company>". The last em-dash (or en-dash) separates the company.
const TITLE = /^EP\.?\s*(\d+)\s*[:.|\-]?\s*(.+)\s+[—–]\s+(.+?)\s*$/;
function parse(item){
  const m = TITLE.exec(item.name.trim());
  return m ? { n: +m[1], id: item.id, hook: m[2].trim(), co: m[3].trim(), name: item.name, date: item.release_date } : null;
}

const data = JSON.parse(await readFile(FILE, "utf8"));
const items = await allEpisodes(await token());
const codex = [], unparsed = [];
for (const it of items) {
  if (!/^EP\.?\s*\d+/i.test(it.name.trim())) continue; // other series on the same show
  const p = parse(it);
  (p ? codex : unparsed).push(p || it);
}

const added = [], filled = [], differs = [];
for (const p of codex.sort((a, b) => a.n - b.n)) {
  let e = data.find(x => x.n === p.n);
  if (!e) {
    e = { n: p.n, id: p.id, q: [], hook: p.hook, co: p.co };
    data.push(e); added.push(p); continue;
  }
  for (const k of ["id", "hook", "co"]) {
    if (!e[k]) { e[k] = p[k]; filled.push(`EP.${p.n} ${k}`); }
    else if (e[k] !== p[k]) {
      differs.push(`EP.${p.n} ${k}\n    episodes.json: ${e[k]}\n    Spotify:       ${p[k]}`);
      if (UPDATE) e[k] = p[k];
    }
  }
}
data.sort((a, b) => a.n - b.n);
const missingQ = data.filter(e => !Array.isArray(e.q) || !e.q.length);

console.log(`Spotify: ${items.length} episodes on the show, ${codex.length} Business Model Codex`);
if (filled.length) console.log(`\nFilled empty fields:\n  ${filled.join("\n  ")}`);
if (differs.length) console.log(`\n${UPDATE ? "Updated from Spotify" : "Different from Spotify (kept; run with --update to overwrite)"}:\n  ${differs.join("\n  ")}`);
if (added.length) console.log(`\nNew episodes added:\n  ${added.map(p => `EP.${p.n}  ${p.co}  (${p.date})`).join("\n  ")}`);
if (unparsed.length) console.log(`\nTitles starting with EP. that did not match "EP.<n> <hook> — <company>" (not imported):\n  ${unparsed.map(i => i.name).join("\n  ")}`);
if (missingQ.length) {
  console.log(`\nWaiting for a question (q) in episodes.json. These stay off the site until q is filled in:`);
  for (const e of missingQ) console.log(`  EP.${e.n}  ${e.co}\n         ${e.hook}`);
}
if (!filled.length && !added.length && !(UPDATE && differs.length)) console.log("\nepisodes.json is already up to date.");
else if (DRY) console.log("\n--dry-run: nothing written.");
else { await writeFile(FILE, JSON.stringify(data, null, 1)); console.log("\nepisodes.json updated. Run `npm run build` to regenerate the site files."); }
