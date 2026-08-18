const fs = require('fs');
const assert = require('assert');

const page = fs.readFileSync('merchant/store.html', 'utf8');
const app = fs.readFileSync('merchant/merchant-app.js', 'utf8');
const media = fs.readFileSync('shared/ap-service-media.js', 'utf8');

assert.match(page, /ap-service-media\.js/, 'Merchant store route ต้องโหลด Shared Media Service');
assert.match(app, /data-media-field="image_url"/, 'Merchant ต้องมี upload ไอคอนร้าน');
assert.match(app, /data-media-field="background_url"/, 'Merchant ต้องมี upload ภาพพื้นหลังร้าน');
assert.match(app, /capture="environment"/, 'Merchant ต้องมีตัวเลือกถ่ายภาพจากกล้อง');
assert.match(app, /pathPrefix: 'merchant'/, 'Merchant media ต้องแยก path scope');
assert.match(media, /pathPrefix = 'admin'/, 'Shared Media Service ต้องรองรับ path prefix ที่จำกัดตาม RLS');
assert.match(media, /DEFAULT_OUTPUT_MAX_BYTES = 1_000_000/, 'การบีบอัดต้องคงขีดจำกัด 1 MB');

console.log('merchant media contract: PASS');
