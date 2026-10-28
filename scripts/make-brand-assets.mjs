// Builds the logo files from the vector logo (scripts/assets/logo-source.svg, exported from Illustrator):
//   public/img/wordmark.svg   the "business model codex" wordmark, cropped tight
//   public/icons/*.png, public/favicon.ico   app icons: the "codex" part on brand orange
// Run when the logo changes: node scripts/make-brand-assets.mjs   (needs Google Chrome; uses macOS sips to resize)
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const run = promisify(execFile);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUB = join(ROOT, "public");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BRAND = "#dd492f";

// Bounds of the artwork inside the 1200x1350 Illustrator canvas (measured with getBBox, 1 unit of padding)
const WORDMARK_BOX = "46 637 1109 76";
const CODEX_BOX = "879 640 277 74";

const src = (await readFile(join(ROOT, "scripts/assets/logo-source.svg"), "utf8"))
  .replace(/<\?xml[^>]*>\s*/, "").replace(/<!--[\s\S]*?-->\s*/g, "").replace(/\s*id="Layer_1"/, "");
const crop = box => src.replace(/viewBox="[^"]*"/, `viewBox="${box}"`);

await writeFile(join(PUB, "img/wordmark.svg"), crop(WORDMARK_BOX));
const codex = crop(CODEX_BOX).replace("<svg", '<svg width="100%" height="100%"');

// Each icon is rendered at 1024px by Chrome, then scaled down with sips
const tmp = join(tmpdir(), "bmc-icons-" + process.pid);
await mkdir(tmp, { recursive: true });
async function render(name, widthRatio){
  const html = join(tmp, name + ".html"), png = join(tmp, name + ".png");
  await writeFile(html, `<!doctype html><html><body style="margin:0;width:1024px;height:1024px;background:${BRAND};display:grid;place-items:center">
<div style="width:${Math.round(1024 * widthRatio)}px;aspect-ratio:277/74">${codex}</div></body></html>`);
  await run(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--no-first-run",
    `--user-data-dir=${join(tmp, "profile-" + name)}`, "--window-size=1024,1024", `--screenshot=${png}`, pathToFileURL(html).href], { timeout: 60000 });
  return png;
}
async function sized(master, size, out){ await run("sips", ["-z", String(size), String(size), master, "--out", out]); return out; }

const any = await render("any", 0.70), maskable = await render("maskable", 0.56), apple = await render("apple", 0.66), small = await render("small", 0.86);
await sized(any, 512, join(PUB, "icons/icon-512.png"));
await sized(any, 192, join(PUB, "icons/icon-192.png"));
await sized(maskable, 512, join(PUB, "icons/maskable-512.png"));
await sized(apple, 180, join(PUB, "icons/apple-touch-icon.png"));
await sized(small, 48, join(PUB, "icons/favicon-48.png"));

// favicon.ico holding 16/32/48 PNGs (PNG-in-ICO is supported by every current browser)
const sizes = [16, 32, 48], pngs = [];
for (const s of sizes) pngs.push(await readFile(await sized(small, s, join(tmp, `fav-${s}.png`))));
const head = Buffer.alloc(6 + 16 * sizes.length);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(sizes.length, 4);
let offset = head.length;
sizes.forEach((s, i) => {
  const o = 6 + 16 * i;
  head.writeUInt8(s, o); head.writeUInt8(s, o + 1); head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(pngs[i].length, o + 8); head.writeUInt32LE(offset, o + 12); offset += pngs[i].length;
});
await writeFile(join(PUB, "favicon.ico"), Buffer.concat([head, ...pngs]));

await rm(tmp, { recursive: true, force: true });
console.log("wordmark.svg, icons and favicon.ico written to public/");
