const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('merchant/merchant-app.js', 'utf8');
assert.match(source, /const newEntityId = prefix =>/, 'Merchant UI must generate client-side text IDs where the table has no default');
assert.match(source, /body: JSON\.stringify\(\{ id: newEntityId\('menu'\), store_id: ctx\.store\.id/, 'New menu payload must include an id before insert');
console.log('merchant_menu_identifier_contract_test: PASS');
