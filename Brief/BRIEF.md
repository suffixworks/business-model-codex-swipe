# Business Model Codex Swipe — สร้างเว็บจริงจาก prototype

## บริบท
เว็บมือถือของ podcast "Business Model Codex by SUFFIX" (podcast ภาษาไทย วิเคราะห์ business model บริษัทจดทะเบียน สำหรับเจ้าของ SME)
ผู้ใช้ปัดการ์ดคำถามธุรกิจแบบ Tinder แล้วกดฟังตอนที่ตอบคำถามนั้นได้ทันทีในหน้าเดิม

## ไฟล์ที่แนบ
- `codex-swipe.html` : prototype ไฟล์เดียว ใช้เป็นต้นแบบ flow หน้าตา และ interaction
- `episodes.json` : ข้อมูล 63 ตอน ฟิลด์
  - `n` เลขตอน
  - `id` Spotify episode ID
  - `q` คำถาม เป็น array ของย่อหน้า แต่ละย่อหน้าเป็น array ของบรรทัด
  - `hook` ชื่อตอนไม่รวมเลข EP
  - `co` ชื่อบริษัทเต็ม

## แหล่งข้อมูล
- Spotify show: https://open.spotify.com/show/72769c7eiWc88azlyoMtLQ
  - show นี้มีหลายซีรีส์ ตอนของ Business Model Codex คือชื่อที่ขึ้นต้น `EP.<เลข>` และลงท้าย ` — <ชื่อบริษัท>`
- Artwork คำถาม: Google Drive folder https://drive.google.com/open?id=1oOeoMy3or-3z2HurkoEeYmGM1PNVWk_Q
  - `Artwork_N.jpg` ตรงกับ EP.N
  - Artwork 64–70 มีแล้วแต่ตอนยังไม่ออก ยังไม่ต้องใส่

## สิ่งที่ต้องคงไว้จาก prototype
- การ์ดซ้อนเป็นกอง ลากแล้วเอียงตามนิ้ว ปัดขวา = เก็บไว้ฟัง ปัดซ้าย = ข้าม แตะการ์ด = เปิดรายละเอียด
- ปุ่มด้านล่าง ✕ ข้าม / ▶ ฟังเลย / เก็บไว้ฟัง คีย์บอร์ดลูกศรซ้ายขวาบนเดสก์ท็อป
- ปุ่ม "เก็บไว้ฟัง" มุมขวาบน แสดงรายการที่เก็บ ลบออกได้
- การ์ดไม่หมด ครบชุดแล้วสับใหม่
- ลิงก์ของแต่ละคำถามเป็น `#ep-<เลข>` เปิดแล้วเจอคำถามนั้นเป็นใบแรก
- การ์ดสีส้มแบรนด์ `#DD492F` ตัวอักษรขาว ฟอนต์ Anuphan โลโก้ wordmark ใน prototype ตัดมาจาก artwork ชั่วคราว
- คำถามแสดงทีละบรรทัดตาม `episodes.json` ห้ามให้เบราว์เซอร์ตัดบรรทัดเอง ยกเว้นจอแคบจนบรรทัดล้น

## งานรอบนี้
1. **ตัวเล่น: Spotify Embed + iFrame API**
   - iframe ตัวเดียว อยู่เป็น mini player ด้านล่าง สลับตอนด้วย `controller.loadUri("spotify:episode:<id>")`
   - กด ▶ = เล่นตอนบนการ์ดทันทีในหน้าเดิม ปัดต่อได้โดยเสียงไม่หยุด
   - ใช้ `playback_update` ตรวจว่าฟังจบ แล้วเล่นตอนถัดไปในรายการ "เก็บไว้ฟัง"
   - ทดสอบ iPhone Safari ว่ากดแล้วเล่นได้เลยไหม ถ้าไม่ได้ ให้กด ▶ แล้วเปิด mini player พร้อมบอกให้แตะเล่นใน embed
2. **โลโก้:** ใช้ไฟล์โลโก้จริงของ Business Model Codex และ SUFFIX (ขอไฟล์จากผม) ใส่หัวหน้า favicon และ app icon
3. **รายการเก็บไว้ฟัง** เก็บใน localStorage ของผู้ใช้ ไม่ต้องมีระบบล็อกอิน
4. **OG image และ meta ต่อคำถาม** แชร์ `#ep-<เลข>` ใน LINE / Facebook แล้วเห็นคำถามบนภาพ (ใช้ artwork ของตอนนั้นได้)
5. **PWA:** manifest + icon ให้ Add to Home Screen ได้
6. **เก็บ event ด้วย GA4:** ปัดขวา ปัดซ้าย เปิดรายละเอียด กดเล่น ฟังจบ
7. **Script sync ตอนใหม่** (`scripts/sync-episodes`)
   - ดึงรายการตอนจาก Spotify Web API (`SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` ใน `.env` ห้าม commit)
   - กรองเฉพาะตอน Business Model Codex แล้วเติม `id`, `hook`, `co` ลง `episodes.json`
   - ตอนใหม่ที่ยังไม่มีคำถาม ให้ list ออกมาให้ผมใส่เอง ห้ามเดาหรือเขียนคำถามเอง

## ข้อกำหนด
- เนื้อหาไทยทั้งหมด ห้ามแก้ถ้อยคำคำถามใน `episodes.json`
- ห้ามใช้ em-dash ในข้อความที่เขียนเพิ่มบนเว็บ
- ทดสอบบน iPhone Safari และ Android Chrome ที่ความกว้าง 375px

## ถามผมก่อนเริ่ม
- host ที่ไหน (subdomain ของ suffix.works หรือแยกโดเมน)
- stack ที่จะใช้ หรือให้คงเป็น static HTML/JS
