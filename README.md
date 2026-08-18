# AP Service — Merchant

Repository นี้เป็น **Merchant / Store Application เท่านั้น** ของ AP Service โดยมีทั้ง Expo mobile shell และ Merchant web console แบบ Multi-Page Architecture

| Path | หน้าที่ |
|---|---|
| `App.tsx`, `src/` | Mobile shell, notification, OTA และ session bridge สำหรับร้านค้า |
| `merchant/` | Merchant MPA: dashboard, orders, menu, store, finance และ settings |
| `store.html` | Legacy Store Console fallback |
| `shared/` | Shared Core, MPA runtime และ Shared Media Service |

Repository นี้ใช้ Supabase, Auth, RLS และ data contracts ร่วมกับ Customer, Admin และ Rider แต่ไม่รวม application entry point ของบทบาทอื่น
