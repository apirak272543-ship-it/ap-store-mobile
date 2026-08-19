const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('merchant/merchant-app.js', 'utf8');
assert.match(source, /requireRole\('store_owner', \{ loginUrl: 'login\.html', container: \$\('\[data-page-content\]'\), renderLoading: false \}\)/, 'Merchant gate must retain page DOM while checking role access');
console.log('merchant_mpa_gate_contract_test: PASS');
