const fs = require('fs');
const assert = require('assert');
const source = fs.readFileSync('merchant/merchant-app.js', 'utf8');

assert.match(source, /merchant_update_store_operations/, 'Merchant ต้องบันทึกเวลาร้านและสถานะผ่าน server RPC');
assert.match(source, /store_opening_hours/, 'Merchant ต้องโหลดตารางเวลาเดิมจาก backend');
assert.match(source, /emergencyClosed/, 'Merchant ต้องมีการปิดฉุกเฉินพร้อม workflow เฉพาะ');
assert.match(source, /p_hours/, 'Merchant ต้องส่งตารางเวลา 7 วันไปตรวจ server-side');
assert.doesNotMatch(source, /active:\s*\$\('#active'\)\.checked/, 'Merchant ห้าม PATCH สถานะเปิดร้านตรงจาก browser');
console.log('merchant store operations contract: PASS');
