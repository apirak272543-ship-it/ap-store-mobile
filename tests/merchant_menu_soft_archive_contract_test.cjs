const fs = require('fs');
const assert = require('assert');

const app = fs.readFileSync('merchant/merchant-app.js', 'utf8');

assert.match(app, /archived_at=is\.null/, 'รายการใช้งานต้องไม่รวมเมนูที่เก็บออกจากรายการ');
assert.match(app, /archived_at=not\.is\.null/, 'ต้องอ่านรายการเมนูที่เก็บไว้เพื่อกู้คืน');
assert.match(app, /rpc\/archive_menu_item/, 'ปุ่มเก็บเมนูต้องเรียก server RPC');
assert.match(app, /rpc\/restore_menu_item/, 'ปุ่มนำกลับต้องเรียก server RPC');
assert.match(app, /เก็บเมนูออกจากรายการ/, 'ต้องมีข้อความอธิบายว่าไม่ใช่การลบข้อมูล');
assert.match(app, /นำกลับเป็นแบบร่าง/, 'ต้องมี flow นำเมนูกลับอย่างปลอดภัย');
assert.doesNotMatch(app, /menu_items\?id=eq\.\$\{encodeURIComponent\([^)]*\)\}[^\n]*method:\s*['"]DELETE/, 'Merchant MPA ห้ามใช้ hard delete เมนู');

console.log('merchant menu soft archive contract: PASS');
