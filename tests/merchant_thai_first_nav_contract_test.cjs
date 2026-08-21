const assert = require('node:assert/strict');
const fs = require('node:fs');

const app = fs.readFileSync('merchant/merchant-app.js', 'utf8');
assert.doesNotMatch(app, /href="\.\.\/store\.html"|ระบบเดิม|กลับหน้าหลักร้านค้า/, 'Merchant must not expose the retired legacy store route or back link');
console.log('merchant thai-first navigation contract: PASS');
