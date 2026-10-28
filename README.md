# Business Model Codex Swipe

เว็บมือถือของ podcast Business Model Codex by SUFFIX ปัดการ์ดคำถามธุรกิจ แล้วกดฟังตอนที่ตอบคำถามนั้นได้ในหน้าเดิม

เป็น static site ล้วน ทุกอย่างที่ deploy อยู่ใน `public/` และ commit ไว้แล้ว โฮสต์ไม่ต้องรัน build

## โครงสร้าง
- `episodes.json` ข้อมูลหลักของทุกตอน (n, id, q, hook, co) แก้ที่ไฟล์นี้ที่เดียว
- `site.config.json` URL ของเว็บ (`siteUrl`), GA4 Measurement ID (`ga4`), Spotify show ID
- `public/` ไฟล์เว็บ: `index.html`, `app.js`, `app.css`, manifest, icons
- `public/ep/<n>/` หน้าสำหรับแชร์ มี OG meta ของคำถามนั้น แล้วพาไปที่ `/#ep-<n>` (สร้างโดย build)
- `public/og/<n>.png` ภาพ OG ของแต่ละคำถาม (สร้างโดย build)
- `scripts/build.mjs` สร้าง episodes.js, config.js, หน้า /ep, ภาพ OG, sw.js
- `scripts/sync-episodes.mjs` ดึงตอนใหม่จาก Spotify
- `scripts/make-brand-assets.py` ตัดโลโก้และทำ favicon / app icon จาก `scripts/assets/logo-source.jpg`

## คำสั่ง
```
npm run dev        # เปิด http://localhost:8080
npm run build      # หลังแก้ episodes.json หรือ site.config.json (ต้องมี Google Chrome ในเครื่องเพื่อทำภาพ OG)
npm run sync       # ดึงตอนใหม่จาก Spotify (ใส่ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET ใน .env ก่อน)
npm run sync -- --dry-run
```

## เพิ่มตอนใหม่
1. `npm run sync` ตอนใหม่จะถูกเพิ่มเข้า `episodes.json` พร้อม id, hook, co และ `q: []`
2. ใส่คำถามใน `q` เอง (ตอนที่ q ว่างจะยังไม่ขึ้นบนเว็บ)
3. `npm run build` แล้ว commit และ push

## Deploy
ตอนนี้: GitHub Pages ที่ https://suffixworks.github.io/business-model-codex-swipe/
push ขึ้น `main` แล้ว `.github/workflows/pages.yml` จะ deploy โฟลเดอร์ `public/` ให้เอง

ทุก path ในเว็บเป็นแบบ relative จึงย้ายไปโดเมนอื่นหรือ Cloudflare Pages ได้โดยไม่ต้องแก้โค้ด
ต่อโดเมนจริงแล้ว แก้ `siteUrl` ใน `site.config.json` รัน `npm run build` แล้ว push

## GA4 events
`swipe_right`, `swipe_left` (method: drag / button / key), `open_detail`, `play` (source: card / detail / saved / auto), `complete`, `preview_end`, `share`
ทุก event มี `episode_number` และ `company`
