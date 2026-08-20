const fs = require('fs');
const assert = require('assert');
const html = fs.readFileSync('merchant/orders.html', 'utf8');
const source = fs.readFileSync('merchant/merchant-quick-decline.js', 'utf8');

assert.match(html, /merchant-quick-decline\.js/, 'Merchant orders ต้องโหลด quick decline enhancement');
assert.match(source, /request_merchant_order_cancellation/, 'UI ต้องใช้ cancellation RPC กลาง');
assert.match(source, /สินค้า\/วัตถุดิบหมด/, 'UI ต้องมี dropdown เหตุผลรวดเร็ว');
assert.match(source, /ทีม Admin เพื่อตัดสินใจยกเลิกและคืนเงิน/, 'UI ต้องไม่สื่อว่า Merchant คืนเงินโดยตรง');
assert.match(source, /crypto\.randomUUID/, 'UI ต้องส่ง idempotency key');
assert.match(source, /reason === 'other' && detail\.length < 3/, 'UI ต้องบังคับรายละเอียดเมื่อเลือกเหตุผลอื่น ๆ');
console.log('merchant quick decline contract: PASS');
