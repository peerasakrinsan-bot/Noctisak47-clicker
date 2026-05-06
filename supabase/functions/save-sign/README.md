# Supabase Edge Function: `save-sign`

วางไฟล์ `index.ts` ของ Edge Function ไว้ที่ path นี้ใน repo:

```text
supabase/functions/save-sign/index.ts
```

เหตุผลคือ Supabase CLI จะมองแต่ละโฟลเดอร์ใต้ `supabase/functions/` เป็น Edge Function 1 ตัว และใช้ `index.ts` ในโฟลเดอร์นั้นเป็น entrypoint ของ function นั้น ดังนั้น endpoint ที่ client เรียกคือ:

```text
https://<project-ref>.supabase.co/functions/v1/save-sign
```

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
