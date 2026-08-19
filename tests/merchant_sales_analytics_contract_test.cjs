const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'merchant', 'merchant-app.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'merchant', 'finance.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'merchant', 'merchant-sales-analytics.css'), 'utf8');

assert.match(app, /salesPath/, 'Merchant finance must request a server-owned sales dataset');
assert.match(app, /C\.contracts\.orderStatus\.COMPLETED/, 'Sales analytics must use only completed-order status from the shared contract');
assert.match(app, /payable \?\? row\.total/, 'Sales analytics must use server-calculated payable amount with total fallback');
assert.match(app, /Asia\/Bangkok/, 'Daily/monthly reporting must use Thailand timezone');
assert.match(app, /monthKeys\(\)/, 'Sales analytics must provide a 12-month series');
assert.match(app, /ยอดขายรายวัน–รายเดือน/, 'Merchant UI must expose Thai daily/monthly analytics copy');
assert.match(app, /merchant-sales-analytics/, 'Merchant finance must mount the analytics workspace');
assert.match(app, /merchant-sales-analytics:\$\{ctx\.store\.id\}/, 'Sales cache must remain scoped to the authenticated store');
assert.match(page, /merchant-sales-analytics\.css\?v=merchant-sales-v1/, 'Finance page must load analytics styles');
assert.match(css, /@media\(max-width:700px\)/, 'Analytics layout must be mobile-first responsive');
console.log('merchant sales analytics contract: PASS');
