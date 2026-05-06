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

## ขั้นตอน deploy

1. ตั้งค่า secret ฝั่ง Supabase (ห้ามใส่ secret ใน `index.html`):

   ```bash
   supabase secrets set SAVE_HMAC_SECRET="<สุ่มยาวอย่างน้อย 32 ตัวอักษร>"
   ```

2. Deploy function จาก root repo:

   ```bash
   supabase functions deploy save-sign
   ```

3. Apply migration สำหรับตาราง cloud save/signature:

   ```bash
   supabase db push
   ```

หลัง deploy แล้ว client ใน `index.html` จะเรียก function นี้ผ่าน `SAVE_SIGN_ENDPOINT` เพื่อ sign/verify save ก่อนเก็บหรือโหลดใช้งาน


## ถ้าในเกมขึ้น `Network error` ตอน Cloud Load

ถ้ารัน SQL สำเร็จแล้วแต่กด Cloud Load/Cloud Save แล้วยังขึ้น `Network error` แปลว่าส่วนฐานข้อมูลผ่านแล้ว แต่ client ยังติดต่อ signing endpoint ไม่สำเร็จ ให้เช็ค 3 อย่างนี้:

1. มีไฟล์ function อยู่ที่ `supabase/functions/save-sign/index.ts` แล้ว deploy ด้วย `supabase functions deploy save-sign`
2. ตั้ง secret แล้ว: `supabase secrets set SAVE_HMAC_SECRET="<สุ่มยาวอย่างน้อย 32 ตัวอักษร>"`
3. URL ใน `SAVE_SIGN_ENDPOINT` ต้องเปิดได้เป็น `/functions/v1/save-sign` ของ project เดียวกับ `_SUPA_URL`

การรัน SQL อย่างเดียวจะสร้าง/แก้ตาราง `cloud_saves` เท่านั้น ยังไม่ deploy Edge Function ที่ใช้เซ็นและ verify save
