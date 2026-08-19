const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('merchant/merchant-app.js', 'utf8');
assert.match(app, /href="\.\.\/store\.html" aria-label="เปิดระบบร้านค้าเดิม">ระบบเดิม</, 'Merchant must retain the legacy route with a Thai-first label');
assert.doesNotMatch(app, /href="\.\.\/store\.html">Fallback</, 'Merchant navigation must not expose the raw technical fallback label');
console.log('merchant thai-first navigation contract: PASS');
