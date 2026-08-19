const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'merchant', 'merchant-app.js'), 'utf8');
const shell = fs.readFileSync(path.join(root, 'merchant', 'finance.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'shared', 'ap-service-mpa.css'), 'utf8');

assert.match(app, /async function finance\(\)/, 'Finance route must keep a dedicated page implementation');
assert.match(app, /settlements\?select=id,status,gross_amount,gp_percent,gp_amount,net_amount/, 'Finance must request only the verified settlement fields');
assert.match(app, /store_id=eq\.\$\{encodeURIComponent\(ctx\.store\.id\)\}/, 'Settlement query must remain store-scoped');
assert.match(app, /recipient_type=eq\.store/, 'Finance must display only store settlement records');
assert.match(app, /String\(row\.status \|\| ''\)\.toLowerCase\(\) !== 'void'/, 'Void settlement rows must be excluded from financial summary totals');
assert.match(app, /ยังไม่มีรอบสรุปยอดสำหรับร้านนี้/, 'Finance needs a truthful no-records state');
assert.doesNotMatch(app, /JSON\.stringify\(rows, null, 2\)/, 'Raw settlement JSON may not be rendered');
assert.match(app, /merchant-finance:\$\{ctx\.store\.id\}/, 'Finance must use a store-scoped cache key');
assert.match(app, /startBackgroundSync\(\{ key: `merchant-finance:/, 'Finance must use the established bounded refresh mechanism');
assert.match(app, /addEventListener\('pagehide', stop/, 'Finance must stop refresh work on pagehide');
assert.match(app, /maskedAccount/, 'Payout account numbers must be masked in the UI');
assert.match(shell, /merchant-app\.js\?v=merchant-ui-v3/, 'Finance shell must request the released finance script version');
assert.match(css, /mpa-finance-summary/, 'Finance must have responsive presentation styles');
console.log('merchant finance contract: passed');
