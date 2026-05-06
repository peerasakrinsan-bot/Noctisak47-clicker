# Supabase Edge Function: `save-sign`

วางไฟล์ `index.ts` ของ Edge Function ไว้ที่ path นี้ใน repo:

```text
supabase/functions/save-sign/index.ts
```

เหตุผลคือ Supabase CLI จะมองแต่ละโฟลเดอร์ใต้ `supabase/functions/` เป็น Edge Function 1 ตัว และใช้ `index.ts` ในโฟลเดอร์นั้นเป็น entrypoint ของ function นั้น ดังนั้น endpoint ที่ client เรียกคือ:

```text
https://<project-ref>.supabase.co/functions/v1/save-sign
```

## SQL ต้องเอาไปแทนของเก่าไหม?

ไม่ต้องลบตารางหรือแทนข้อมูลเก่าครับ ให้ **รัน migration นี้ทับของเดิมได้เลย** เพราะ SQL ใช้ `create table if not exists`, `add column if not exists`, `create index if not exists` และเช็ค policy ก่อนสร้าง จึงออกแบบมาให้ปลอดภัยกับโปรเจกต์ที่มี `cloud_saves` อยู่แล้ว:

```text
supabase/migrations/20260506000000_add_cloud_save_signature.sql
```

กรณีที่มีตาราง `public.cloud_saves` เดิมอยู่แล้ว SQL จะเพิ่มเฉพาะของที่ขาด เช่น `signature`, `uploaded_at`, index และ RLS policies โดยไม่ล้าง `save_data` เดิม

ถ้าใช้ Supabase Dashboard โดยตรง ให้เปิด SQL Editor แล้วรันเนื้อหาในไฟล์ migration นี้ 1 ครั้งได้เลย หรือถ้าใช้ Supabase CLI ให้ใช้ `supabase db push`

## ใน Edge Function ต้องใส่ code อะไร?

ให้ใส่ code ทั้งไฟล์จาก:

```text
supabase/functions/save-sign/index.ts
```

ถ้าสร้างผ่าน Supabase Dashboard ให้ไปที่ **Edge Functions > New function** ตั้งชื่อ function ว่า `save-sign` แล้ว copy เนื้อหาในไฟล์ `index.ts` ทั้งหมดไปวางใน editor ของ function นั้น ห้ามใส่แค่บางส่วน เพราะ code นี้มีทั้ง CORS, validation, canonical JSON, HMAC signing/verify และ `Deno.serve(...)` entrypoint

ถ้าใช้ Supabase CLI ไม่ต้อง copy วางเอง ให้เก็บไฟล์ไว้ที่ path ด้านบนแล้ว deploy ด้วย:

```bash
supabase functions deploy save-sign --no-verify-jwt
```

## เห็นไฟล์ใน GitHub แล้ว ถือว่า deploy แล้วไหม?

ยังไม่ถือว่า deploy ครับ ภาพที่เห็นใน GitHub แปลว่าไฟล์ `README.md` และ `index.ts` อยู่ใน repository แล้วเท่านั้น แต่ Supabase Edge Function จะยังไม่ทำงานจนกว่าจะ deploy ไปที่ Supabase project จริงด้วยคำสั่ง:

```bash
supabase functions deploy save-sign --no-verify-jwt
```

หลัง deploy แล้วให้เช็คใน Supabase Dashboard > Edge Functions ว่ามี function ชื่อ `save-sign` และตั้ง **Verify JWT = off** (หรือ deploy ด้วย `--no-verify-jwt`) แล้วลองเปิด endpoint นี้ควรได้ JSON `ok: true` จาก function ไม่ใช่ 404/401:

```text
https://ouhtyyddclgqvrqqdwlc.supabase.co/functions/v1/save-sign
```

ถ้า deploy ผ่าน GitHub Actions/CI ต้องมี workflow ที่รัน `supabase functions deploy save-sign --no-verify-jwt` ด้วย การ push ไฟล์ขึ้น GitHub อย่างเดียวไม่ deploy ให้อัตโนมัติ

## ตั้ง Secret หน้านี้ใช่ไหม?

ใช่ครับ หน้าที่ชื่อ **Edge Function Secrets** ใน Supabase Dashboard คือหน้าที่ถูกต้อง ให้กรอกแบบนี้:

| Field | Value |
| --- | --- |
| Name | `SAVE_HMAC_SECRET` |
| Value | สุ่ม string ของคุณเอง ยาวอย่างน้อย 32 ตัวอักษร เช่น `n47-9f3b8c2d7e6a5b4c1d0e9f8a7b6c5d4e` |

ข้อสำคัญ:

- อย่าใส่ anon key, service role key, player ID หรือ secret key ของผู้เล่นในช่องนี้
- ค่านี้เป็น secret ของ server สำหรับ HMAC เท่านั้น และต้องไม่อยู่ใน `index.html`
- อย่า copy ค่า example ที่มีคำว่า `CHANGE-ME` ไปใช้จริง ให้พิมพ์/สร้างค่า random ใหม่ของโปรเจกต์คุณเอง
- หลัง Save secret แล้ว ให้ deploy/redeploy function `save-sign` อีกครั้งเพื่อให้ function อ่านค่า secret ล่าสุด

## ขั้นตอน deploy

1. ตั้งค่า secret ฝั่ง Supabase (ห้ามใส่ secret ใน `index.html`):

   ```bash
   supabase secrets set SAVE_HMAC_SECRET="<สุ่มยาวอย่างน้อย 32 ตัวอักษร>"
   ```

2. Deploy function จาก root repo:

   ```bash
   supabase functions deploy save-sign --no-verify-jwt
   ```

3. Apply migration สำหรับตาราง cloud save/signature:

   ```bash
   supabase db push
   ```

หลัง deploy แล้ว client ใน `index.html` จะเรียก function นี้ผ่าน `SAVE_SIGN_ENDPOINT` เพื่อ sign/verify save ก่อนเก็บหรือโหลดใช้งาน


## ถ้าทำครบแล้วยังขึ้น `Network error`

สาเหตุที่พบบ่อยคือ Edge Function ถูกบล็อกก่อนเข้า code เพราะ **Verify JWT เปิดอยู่** หรือ deploy โดยไม่ได้ใช้ `--no-verify-jwt` ทำให้ browser เห็นเป็น CORS/Network error แทนที่จะเห็น error จริงจาก function

วิธีแก้:

```bash
supabase functions deploy save-sign --no-verify-jwt
```

หรือถ้าทำผ่าน Dashboard ให้เข้า **Edge Functions > save-sign > Settings** แล้วปิด **Verify JWT** จากนั้น Deploy/Save อีกครั้ง

> ใน repo นี้มี `supabase/config.toml` ตั้ง `verify_jwt = false` ให้ `save-sign` แล้ว เพื่อให้ Supabase CLI deploy แบบไม่บังคับ JWT ได้ตรงกัน

## ถ้าในเกมขึ้น `Network error` ตอน Cloud Load

ถ้ารัน SQL สำเร็จแล้วแต่กด Cloud Load/Cloud Save แล้วยังขึ้น `Network error` แปลว่าส่วนฐานข้อมูลผ่านแล้ว แต่ client ยังติดต่อ signing endpoint ไม่สำเร็จ ให้เช็ค 3 อย่างนี้:

1. มีไฟล์ function อยู่ที่ `supabase/functions/save-sign/index.ts` แล้ว deploy ด้วย `supabase functions deploy save-sign --no-verify-jwt`
2. ตั้ง secret แล้ว: `supabase secrets set SAVE_HMAC_SECRET="<สุ่มยาวอย่างน้อย 32 ตัวอักษร>"`
3. ใน Supabase Dashboard > Edge Functions > `save-sign` ให้ **Verify JWT = off** ถ้าใช้ Dashboard deploy
4. URL ใน `SAVE_SIGN_ENDPOINT` ต้องเปิดได้เป็น `/functions/v1/save-sign` ของ project เดียวกับ `_SUPA_URL` และควรเห็น JSON `ok: true` เมื่อเปิด endpoint ด้วย browser

การรัน SQL อย่างเดียวจะสร้าง/แก้ตาราง `cloud_saves` เท่านั้น ยังไม่ deploy Edge Function ที่ใช้เซ็นและ verify save
