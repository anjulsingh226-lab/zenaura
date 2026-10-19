# ZENAURA – Dropshipping Registration

## Setup
1. Supabase -> SQL Editor -> `schema.sql` run karo.
2. Supabase -> Storage -> New bucket `payments` (Private).
3. GitHub repo me saari files upload (qr.png, index.html, admin.html, package.json, api/index.js).
4. Vercel -> Import repo -> Environment Variables:
   SUPABASE_URL, SUPABASE_SERVICE_KEY, JWT_SECRET, ADMIN_PASSWORD
5. Deploy. Admin panel: yoursite.vercel.app/admin.html
