const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../merchant/menu.html'), 'utf8');
const ocr = fs.readFileSync(path.join(__dirname, '../merchant/local-menu-ocr.js'), 'utf8');
const app = fs.readFileSync(path.join(__dirname, '../merchant/merchant-app.js'), 'utf8');

assert.match(html, /shared\/ocr\/tesseract\.min\.js/);
assert.match(html, /local-menu-ocr\.js/);
assert.match(ocr, /workerPath: '\.\.\/shared\/ocr\/worker\.min\.js'/);
assert.match(ocr, /langPath: '\.\.\/shared\/ocr\/lang'/);
assert.match(ocr, /corePath: '\.\.\/shared\/ocr\/core\/tesseract-core-lstm\.wasm\.js'/);
assert.doesNotMatch(ocr, /https:\/\//);
assert.match(ocr, /MAX_BYTES = 1024 \* 1024/);
assert.match(ocr, /parseMenuText/);
assert.match(ocr, /ยังไม่เปิดขาย/);
assert.match(app, /rpc\/import_menu_drafts/);
assert.match(app, /p_store_id: ctx\.store\.id/);

const parseModule = new Function('window', `${ocr}; return window.APServiceLocalMenuOCR.parseMenuText;`);
const parser = parseModule({});
assert.equal(typeof parser, 'function');
const parsed = parser('เครื่องดื่ม\nชาเย็น 35 บาท\nกาแฟดำ ฿45\nข้าวผัด 55.-');
assert.equal(parsed.length, 3);
assert.deepEqual(parsed.map(row => [row.name, row.price]), [['ชาเย็น', 35], ['กาแฟดำ', 45], ['ข้าวผัด', 55]]);

console.log('local_ocr_menu_ui_contract_test: passed');
