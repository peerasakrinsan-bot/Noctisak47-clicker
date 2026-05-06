# Supabase Edge Function: `save-sign`

วางไฟล์ `index.ts` ของ Edge Function ไว้ที่ path นี้ใน repo:

```text
supabase/functions/save-sign/index.ts
```

Supabase CLI จะใช้ชื่อโฟลเดอร์ใต้ `supabase/functions/` เป็นชื่อ function และใช้ `index.ts` เป็น entrypoint ดังนั้น endpoint ที่ client เรียกคือ:

```text
https://<project-ref>.supabase.co/functions/v1/save-sign
```

## ต้องตั้ง Secret อะไรบ้าง

ตั้งค่าใน **Supabase Dashboard > Edge Function Secrets** หรือใช้ CLI:

| Name | ใช้ทำอะไร |
| --- | --- |
| `SAVE_HMAC_SECRET` | secret สุ่มของคุณเอง ยาวอย่างน้อย 32 ตัวอักษร สำหรับ HMAC signature |
| `SUPABASE_SERVICE_ROLE_KEY` | service role key ของ Supabase ให้ Edge Function อ่าน/เขียน `cloud_saves` แทน client |

> ห้ามใส่สองค่านี้ใน `index.html` และห้ามใช้ค่า example/placeholder จริง

ตัวอย่าง CLI:

```bash
supabase secrets set SAVE_HMAC_SECRET="<สุ่มยาวอย่างน้อย 32 ตัวอักษร>"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key-from-supabase-api-settings>"
```

## ขั้นตอน deploy

1. Apply migration สำหรับตาราง cloud save/signature:

   ```bash
   supabase db push
   ```

2. Deploy function โดยไม่บังคับ JWT เพราะ client เกมไม่ได้ login Supabase Auth:

   ```bash
   supabase functions deploy save-sign --no-verify-jwt
   ```

   หรือถ้าทำผ่าน Dashboard ให้เข้า **Edge Functions > save-sign > Settings** แล้วปิด **Verify JWT**

3. เปิด endpoint นี้ใน browser เพื่อเช็ค health check:

   ```text
   https://ouhtyyddclgqvrqqdwlc.supabase.co/functions/v1/save-sign
   ```

   ถ้าถูกต้องควรเห็น JSON คล้าย ๆ:

   ```json
   { "ok": true, "function": "save-sign" }
   ```

## Cloud Save ทำงานยังไงหลังแก้ security

- Client ไม่อ่าน/เขียนตาราง `public.cloud_saves` ด้วย anon REST API แล้ว
- Client เรียก `save-sign` เพื่อ Cloud Upload/Download พร้อม `player_id` และรหัสลับของผู้เล่น
- Edge Function ใช้ `SUPABASE_SERVICE_ROLE_KEY` ฝั่ง server เท่านั้นเพื่ออ่าน/เขียนตาราง
- Migration ปิด public anon policies ของ `cloud_saves` เพื่อไม่ให้ใครใช้ anon key ดู `secret_key`, `save_data`, หรือ `signature` ของผู้เล่นทั้งหมดได้

## ป้องกันการเซ็น save ปลอม

`save-sign` จะไม่เซ็น save ใด ๆ ที่ client ส่งมาเฉย ๆ อีกแล้ว ยกเว้น:

1. `action: "bootstrap"` สำหรับ save ใหม่ว่าง ๆ เท่านั้น
2. request มี `previous_save` + `previous_signature` ที่ server verify ได้ แล้ว reward delta ไม่เกินกฎ
3. Cloud Download ที่ผ่านรหัสลับและดึงข้อมูลจากตารางฝั่ง server สำเร็จ

ถ้า request ไม่มี trusted previous signature จะได้ error `trusted previous signature required`

## ถ้าในเกมขึ้น `Network error` ตอน Cloud Load/Save

เช็คตามนี้:

1. Deploy function ด้วย `supabase functions deploy save-sign --no-verify-jwt`
2. Dashboard > Edge Functions > `save-sign` > Settings ต้องปิด **Verify JWT** ถ้า deploy ผ่าน Dashboard
3. ตั้ง `SAVE_HMAC_SECRET` แล้ว และต้องยาวอย่างน้อย 32 ตัวอักษร
4. ตั้ง `SUPABASE_SERVICE_ROLE_KEY` แล้ว ไม่ใช่ anon key
5. เปิด `/functions/v1/save-sign` แล้วต้องเห็น JSON `{ "ok": true, ... }`
6. รัน migration แล้ว เพื่อให้ตารางมี `signature`, `uploaded_at` และปิด anon policies เดิม
