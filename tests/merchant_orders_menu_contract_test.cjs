const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'merchant', 'merchant-app.js'), 'utf8');
const media = fs.readFileSync(path.join(root, 'shared', 'ap-service-media.js'), 'utf8');
const menuRoute = fs.readFileSync(path.join(root, 'merchant', 'menu.html'), 'utf8');
const ordersRoute = fs.readFileSync(path.join(root, 'merchant', 'orders.html'), 'utf8');

assert.match(app, /async function orders\(\)/, 'orders route must remain available');
assert.match(app, /data-order-group="\$\{section\.key\}"/, 'orders must be grouped for new, active, and history work');
assert.match(app, /C\.order\.canTransition/, 'status choices must remain governed by Shared Core');
assert.match(app, /merchant-orders:\$\{ctx\.store\.id\}/, 'orders must retain scoped refresh cache');
assert.match(app, /menu_categories\?select=id,name,icon,sort_order,active/, 'menu must read real central categories');
assert.match(app, /data-menu-edit/, 'menu cards must expose an edit workflow');
assert.match(app, /data-menu-available/, 'menu cards must retain sale availability control');
assert.match(app, /uploadPublicCatalogImage/, 'menu image upload must reuse shared media pipeline');
assert.match(app, /mediaType: 'PRODUCT_IMAGE'/, 'menu images must declare the product media profile');
assert.doesNotMatch(app, /type="url"/, 'menu must not expose URL image input');
assert.match(menuRoute, /ap-service-media\.js\?v=shared-media-v5/, 'menu route must load media pipeline before app code');
assert.match(menuRoute, /merchant-app\.js\?v=merchant-ui-v2/, 'menu route must bust the previous app cache');
assert.match(ordersRoute, /merchant-app\.js\?v=merchant-ui-v2/, 'orders route must bust the previous app cache');
assert.match(media, /DEFAULT_MAX_DIMENSION = 1200/, 'media max dimension must be 1200px');
assert.match(media, /PRODUCT_IMAGE: Object\.freeze\(\{ maxDimension: 1200/, 'product uploads must use 1200px profile');
assert.match(media, /let quality = 0\.82/, 'media compression must start at JPEG quality 0.82');
assert.match(media, /const type = 'image\/jpeg';/, 'all image uploads must be encoded as JPEG');

console.log('merchant_orders_menu_contract_test: passed');
