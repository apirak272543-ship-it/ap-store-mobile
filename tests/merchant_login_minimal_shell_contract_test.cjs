const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('merchant/merchant-app.js', 'utf8');
assert.match(source, /async function login\(\)/, 'Merchant ต้องมี login flow');
assert.match(source, /aria-label="อีเมล"/, 'Merchant login ต้องคง label สำหรับ accessibility');
assert.match(source, /aria-label="รหัสผ่าน"/, 'Merchant login ต้องคง label สำหรับ accessibility');
assert.doesNotMatch(source, /ใช้บัญชีเจ้าของร้านที่ผู้ดูแลระบบสร้างให้/, 'Merchant login ต้องไม่มีข้อความระบบ');
assert.doesNotMatch(source, /เปิด Store fallback เดิม/, 'Merchant login ต้องไม่มีข้อความ fallback ที่ไม่จำเป็น');
console.log('merchant login minimal shell contract: PASS');
