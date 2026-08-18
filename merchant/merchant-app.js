(() => {
  'use strict';
  const M = window.APServiceMPA;
  const C = window.APServiceCore;
  const $ = selector => document.querySelector(selector);
  const h = M.ui.escapeHtml;
  const page = document.body.dataset.page;
  const pageScope = name => { const scope = M.network.createScope(name); addEventListener('pagehide', () => scope.dispose(), { once: true }); return scope; };
  const links = [['dashboard', 'ภาพรวม'], ['orders', 'ออร์เดอร์'], ['menu', 'เมนู'], ['store', 'ข้อมูลร้าน'], ['finance', 'การเงิน'], ['settings', 'ตั้งค่า']];

  const app = (active, content) => {
    const nav = links.map(([key, label]) => `<a class="${active === key ? 'active' : ''}" href="${key}.html">${label}</a>`).join('');
    document.body.innerHTML = `<header class="mpa-topbar"><a class="mpa-brand" href="dashboard.html">AP Service · ร้านค้า</a><nav class="mpa-nav">${nav}<a href="../store.html">Fallback</a></nav></header><main class="mpa-shell" data-page-content>${content}</main>`;
  };

  async function ownStore(user) {
    const rows = await M.request(`stores?select=id,name,description,phone,eta,active,owner_id,image_url,background_url&owner_id=eq.${encodeURIComponent(user.id)}&limit=1`, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-store:${user.id}` });
    return rows?.[0] || null;
  }

  async function gate(active, content) {
    app(active, content);
    const access = await M.auth.requireRole('store_owner', { loginUrl: 'login.html', container: $('[data-page-content]') });
    if (!access) return null;
    const controls = await M.request(`account_controls?select=status,suspension_reason,feature_overrides&user_id=eq.${encodeURIComponent(access.user.id)}&limit=1`, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-account-control:${access.user.id}` });
    const control = controls?.[0] || { status: 'active', feature_overrides: {} };
    if (control.status === 'suspended') {
      $('[data-page-content]').innerHTML = M.ui.error('บัญชีร้านค้าถูกระงับการใช้งาน', control.suspension_reason || 'กรุณาติดต่อผู้ดูแลระบบ');
      return null;
    }
    const store = await ownStore(access.user);
    if (!store) {
      $('[data-page-content]').innerHTML = M.ui.error('ไม่พบข้อมูลร้านค้าที่ผูกกับบัญชีนี้', 'กรุณาติดต่อผู้ดูแลระบบ');
      return null;
    }
    const config = await readCentralConfig(access.user.id);
    mountCentralConfig(config);
    return { ...access, store, control, config };
  }

  async function readCentralConfig(userId) {
    const read = async (path, options = {}) => { try { return await M.request(path, options); } catch (error) { console.warn('Store central config read skipped', error); return []; } };
    const [publicRows, paymentRows] = await Promise.all([
      read('platform_configs?select=key,value&key=in.(brand_public,customer_promotions)', { cacheTtlMs: 30_000, cacheKey: 'merchant-platform-public-configs' }),
      read('platform_configs?select=key,value&key=eq.payment_public', { private: true, cacheTtlMs: 30_000, cacheKey: `merchant-payment-public:${userId}` }),
    ]);
    const rows = [...(publicRows || []), ...(paymentRows || [])];
    return { brand: rows.find(row => row.key === 'brand_public')?.value || {}, promotions: rows.find(row => row.key === 'customer_promotions')?.value || {}, payment: rows.find(row => row.key === 'payment_public')?.value || {} };
  }

  const configValue = (value, keys, fallback = '') => keys.map(key => value?.[key]).find(item => item !== undefined && item !== null && String(item).trim() !== '') ?? fallback;
  const safeAsset = value => { const text = String(value || '').trim(); return /^https?:/i.test(text) || text.toLowerCase().startsWith('data:image/') ? text : ''; };
  function centralConfigMarkup(config) {
    const brand = config?.brand || {}, promotions = Array.isArray(config?.promotions?.items) ? config.promotions.items.filter(item => item && item.active !== false) : [];
    const name = configValue(brand, ['brand_name', 'brandName', 'name', 'title'], 'AP Service');
    const logo = safeAsset(configValue(brand, ['logo_url', 'logoUrl', 'logo']));
    const background = safeAsset(configValue(brand, ['background_url', 'backgroundUrl', 'background']));
    const banner = safeAsset(configValue(brand, ['banner_url', 'bannerUrl', 'banner']));
    const payment = config?.payment || {}, provider = configValue(payment, ['provider'], 'ยังไม่กำหนด');
    return `<section class="mpa-card" data-central-config-card style="margin-bottom:18px;overflow:hidden;padding:0"><div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:${background ? `linear-gradient(90deg,rgba(24,18,10,.72),rgba(24,18,10,.18)),url('${h(background)}') center/cover` : 'linear-gradient(135deg,#fff7e8,#fff)'};color:${background ? '#fff' : 'inherit'}"><div style="width:52px;height:52px;border-radius:15px;overflow:hidden;display:grid;place-items:center;background:rgba(255,255,255,.78);font-size:25px;flex:0 0 auto">${logo ? `<img src="${h(logo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '🍽️'}</div><div><strong>${h(name)}</strong><div style="font-size:11px;opacity:.85">ค่ากลางจาก Admin · ช่องทางชำระเงิน: ${h(provider)}</div></div></div>${banner ? `<img src="${h(banner)}" alt="แบนเนอร์จาก Admin" loading="lazy" style="display:block;width:100%;max-height:150px;object-fit:cover">` : ''}<div style="padding:12px 16px"><strong style="font-size:12px">โปรโมชันที่เผยแพร่</strong>${promotions.length ? `<div style="display:grid;gap:8px;margin-top:9px">${promotions.slice(0, 4).map(item => `<div style="display:flex;gap:9px;align-items:center"><div style="width:38px;height:38px;border-radius:10px;overflow:hidden;background:#fff4dc;display:grid;place-items:center;flex:0 0 auto">${safeAsset(item.image_url) ? `<img src="${h(safeAsset(item.image_url))}" alt="" style="width:100%;height:100%;object-fit:cover">` : '✦'}</div><div><strong style="font-size:11px">${h(item.badge ? `${item.badge} · ` : '')}${h(item.title || 'โปรโมชัน')}</strong><div class="mpa-muted">${h(item.description || '')}</div></div></div>`).join('')}</div>` : '<p class="mpa-muted" style="margin:8px 0 0">ยังไม่มีโปรโมชันที่เปิดเผย</p>'}<p class="mpa-muted" style="margin:10px 0 0">กฎธุรกิจส่วนกลางไม่ถูกเปิดให้อ่านจากบทบาทร้านค้าตาม RLS ปัจจุบัน</p></div></section>`;
  }
  function mountCentralConfig(config) { const host = $('[data-page-content]'); if (!host) return; host.insertAdjacentHTML('afterbegin', centralConfigMarkup(config)); }

  async function login() {
    document.body.innerHTML = `<main class="mpa-shell" style="min-height:100vh;display:grid;place-items:center"><section class="mpa-card" style="width:min(430px,100%)"><h1>เข้าสู่ระบบร้านค้า</h1><p class="mpa-muted">ใช้บัญชีเจ้าของร้านที่ผู้ดูแลระบบสร้างให้</p><form id="login"><div class="mpa-field"><label>อีเมล</label><input id="email" type="email" required></div><div class="mpa-field"><label>รหัสผ่าน</label><input id="password" type="password" required></div><button class="mpa-button" style="width:100%">เข้าสู่ระบบร้านค้า</button></form><p class="mpa-muted"><a href="../store.html">เปิด Store fallback เดิม</a></p></section></main>`;
    $('#login').onsubmit = async event => {
      event.preventDefault();
      try {
        const session = await M.auth.signIn($('#email').value.trim(), $('#password').value);
        if (!(await M.auth.rolesFor(session.user.id)).includes('store_owner')) {
          M.auth.signOut('login.html');
          throw new Error('บัญชีนี้ไม่มีสิทธิ์ร้านค้า');
        }
        location.assign('dashboard.html');
      } catch (err) { M.ui.setNotice(err.message, 'error'); }
    };
  }

  async function dashboard() {
    const ctx = await gate('dashboard', `<div class="mpa-page-head"><div><h1>ภาพรวมร้านค้า</h1><p>สรุปข้อมูลร้านและออร์เดอร์ที่ได้รับสิทธิ์</p></div><button class="mpa-button mpa-button-secondary" id="out">ออกจากระบบ</button></div><div id="content">${M.ui.loading('กำลังโหลดข้อมูลร้าน…')}</div>`);
    if (!ctx) return;
    $('#out').onclick = () => M.auth.signOut('login.html');
    const scope = pageScope('merchant:dashboard'); const path = `delivery_orders?select=id,status,payable&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=ordered_at.desc&limit=200`; let lastSignature = '';
    const render = orders => {
      const signature = JSON.stringify((orders || []).map(row => [row.id, row.status, row.payable])); if (signature === lastSignature) return; lastSignature = signature;
      const active = orders.filter(row => !['สำเร็จแล้ว', 'ยกเลิก'].includes(row.status));
      const sales = orders.filter(row => row.status === 'สำเร็จแล้ว').reduce((sum, row) => sum + Number(row.payable || 0), 0);
      $('#content').innerHTML = `<div class="mpa-grid stats"><div class="mpa-card mpa-stat"><small>ออร์เดอร์ที่กำลังทำ</small><strong>${active.length}</strong></div><div class="mpa-card mpa-stat"><small>ออร์เดอร์ทั้งหมด</small><strong>${orders.length}</strong></div><div class="mpa-card mpa-stat"><small>ยอดสำเร็จ</small><strong>${M.ui.baht(sales)}</strong></div><div class="mpa-card mpa-stat"><small>สถานะร้าน</small><strong>${ctx.store.active ? 'เปิด' : 'ปิด'}</strong></div></div><section class="mpa-card" style="margin-top:18px"><h2 style="margin-top:0">${h(ctx.store.name)}</h2><p class="mpa-muted">${h(ctx.store.description || 'ยังไม่ได้ใส่รายละเอียดร้าน')}</p><a class="mpa-button" href="orders.html">จัดการออร์เดอร์</a></section>`;
    };
    try { render(await scope.request(path, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-dashboard-orders:${ctx.store.id}` })); } catch (err) { if (err.code !== M.network.STALE_RESPONSE) $('#content').innerHTML = M.ui.error('โหลดภาพรวมร้านไม่สำเร็จ', err.message); return; }
    const stop = M.network.startBackgroundSync({ key: `merchant-dashboard:${ctx.store.id}`, intervalMs: 15_000, task: async () => { const orders = await M.request(path, { private: true, forceFresh: true, cacheKey: `merchant-dashboard-orders:${ctx.store.id}` }); const signature = JSON.stringify((orders || []).map(row => [row.id, row.status, row.payable])); return { changed: signature !== lastSignature, data: orders }; }, onData: render, onError: error => M.ui.setNotice(`อัปเดตภาพรวมร้านไม่สำเร็จ: ${error.message}`, 'error') }); addEventListener('pagehide', stop, { once: true });
  }

  async function orders() {
    const ctx = await gate('orders', `<div class="mpa-page-head"><div><h1>ออร์เดอร์ของร้าน</h1><p>เปลี่ยนได้เฉพาะสถานะที่ Shared Core อนุญาต</p></div></div><section id="list" class="mpa-card">${M.ui.loading('กำลังโหลดออร์เดอร์…')}</section>`);
    if (!ctx) return;
    const scope = pageScope('merchant:orders'); const path = `delivery_orders?select=id,customer_name,status,total,payable,ordered_at,delivery_address&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=ordered_at.desc&limit=200`; let lastSignature = '';
    const render = rows => {
      const signature = JSON.stringify((rows || []).map(row => [row.id, row.status, row.updated_at])); if (signature === lastSignature) return; lastSignature = signature;
      $('#list').innerHTML = rows.length ? `<div class="mpa-table-wrap"><table class="mpa-table"><thead><tr><th>เวลา</th><th>ลูกค้า/ที่อยู่</th><th>สถานะ</th><th>ยอด</th><th>ดำเนินการ</th></tr></thead><tbody>${rows.map(row => {
        const choices = Object.values(C.contracts.orderStatus).filter(next => C.order.canTransition({ from: row.status, to: next, actor: 'merchant' }).ok);
        return `<tr><td>${new Date(row.ordered_at).toLocaleString('th-TH')}</td><td>${h(row.customer_name || '-')}<br><span class="mpa-muted">${h(row.delivery_address || '')}</span></td><td><span class="mpa-badge">${h(row.status)}</span></td><td>${M.ui.baht(row.payable ?? row.total)}</td><td>${choices.length ? `<select data-status="${h(row.id)}"><option value="">เลือก…</option>${choices.map(item => `<option>${h(item)}</option>`).join('')}</select>` : '—'}</td></tr>`;
      }).join('')}</tbody></table></div>` : M.ui.empty('ยังไม่มีออร์เดอร์');
      document.querySelectorAll('[data-status]').forEach(select => select.onchange = async () => {
        if (!select.value) return;
        try {
          await M.request(`delivery_orders?id=eq.${encodeURIComponent(select.dataset.status)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: select.value, updated_at: M.ui.nowIso() }) });
          M.ui.setNotice('อัปเดตสถานะออร์เดอร์แล้ว'); setTimeout(() => location.reload(), 350);
        } catch (err) { M.ui.setNotice(err.message, 'error'); }
      });
    };
    try { render(await scope.request(path, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-orders:${ctx.store.id}` })); } catch (err) { if (err.code !== M.network.STALE_RESPONSE) $('#list').innerHTML = M.ui.error('โหลดออร์เดอร์ไม่สำเร็จ', err.message); return; }
    const stop = M.network.startBackgroundSync({ key: `merchant-orders:${ctx.store.id}`, intervalMs: 15_000, task: async () => { const rows = await M.request(path, { private: true, forceFresh: true, cacheKey: `merchant-orders:${ctx.store.id}` }); const signature = JSON.stringify((rows || []).map(row => [row.id, row.status, row.updated_at])); return { changed: signature !== lastSignature, data: rows }; }, onData: render, onError: error => M.ui.setNotice(`อัปเดตออร์เดอร์ไม่สำเร็จ: ${error.message}`, 'error') }); addEventListener('pagehide', stop, { once: true });
  }

  async function menu() {
    const ctx = await gate('menu', `<div class="mpa-page-head"><div><h1>เมนูและสต็อก</h1><p>เพิ่มหรือแก้ไขเมนูของร้านที่กำลังล็อกอิน</p></div></div><section class="mpa-card"><form id="add"><div class="mpa-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))"><div class="mpa-field"><label>ชื่อเมนู</label><input id="name" required></div><div class="mpa-field"><label>ราคา</label><input id="price" type="number" min="0" required></div><div class="mpa-field"><label>สต็อก</label><input id="stock" type="number" min="0" value="0"></div></div><button class="mpa-button">เพิ่มเมนู</button></form></section><section id="list" class="mpa-card" style="margin-top:18px">${M.ui.loading('กำลังโหลดเมนู…')}</section>`);
    if (!ctx) return;
    const load = async () => {
      try {
        const rows = await M.request(`menu_items?select=id,name,emoji,description,price,stock,available&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=name.asc`, { private: true });
        $('#list').innerHTML = rows.length ? `<div class="mpa-table-wrap"><table class="mpa-table"><thead><tr><th>เมนู</th><th>ราคา</th><th>สต็อก</th><th>พร้อมขาย</th></tr></thead><tbody>${rows.map(row => `<tr><td>${h(row.emoji || '🍜')} ${h(row.name)}</td><td>${M.ui.baht(row.price)}</td><td>${row.stock}</td><td>${row.available ? 'พร้อม' : 'ปิดขาย'}</td></tr>`).join('')}</tbody></table></div>` : M.ui.empty('ยังไม่มีเมนู');
      } catch (err) { $('#list').innerHTML = M.ui.error('โหลดเมนูไม่สำเร็จ', err.message); }
    };
    $('#add').onsubmit = async event => {
      event.preventDefault();
      try {
        await M.request('menu_items', { method: 'POST', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ store_id: ctx.store.id, name: $('#name').value.trim(), emoji: '🍜', price: Number($('#price').value), stock: Number($('#stock').value), available: true }) });
        M.ui.setNotice('เพิ่มเมนูแล้ว'); event.target.reset(); load();
      } catch (err) { M.ui.setNotice(err.message, 'error'); }
    };
    load();
  }

  async function store() {
    const ctx = await gate('store', `<div class="mpa-page-head"><div><h1>ข้อมูลร้าน</h1><p>แก้ไขเฉพาะข้อมูลของร้านที่กำลังเข้าสู่ระบบ</p></div></div><section id="form" class="mpa-card">${M.ui.loading()}</section>`);
    if (!ctx) return;
    const draftMedia = { image_url: ctx.store.image_url || '', background_url: ctx.store.background_url || '' };
    $('#form').innerHTML = `<form id="save" style="max-width:760px"><div class="mpa-field"><label>ชื่อร้าน</label><input id="name" value="${h(ctx.store.name)}" required></div><div class="mpa-field"><label>รายละเอียด</label><textarea id="description" rows="3">${h(ctx.store.description || '')}</textarea></div><div class="mpa-field"><label>โทรศัพท์</label><input id="phone" value="${h(ctx.store.phone || '')}"></div><div class="mpa-field"><label>เวลาจัดส่งโดยประมาณ</label><input id="eta" value="${h(ctx.store.eta || '')}"></div><section style="margin:18px 0;padding:16px;border:1px solid var(--ap-line);border-radius:14px"><h2 style="margin:0 0 6px">รูปและสื่อหน้าร้าน</h2><p class="mpa-muted">เลือกจากคลังหรือถ่ายจากกล้องได้ ระบบบีบอัดรูปก่อนอัปโหลดให้ไม่เกิน 1 MB และตรวจสอบ URL ก่อนบันทึก</p><div class="mpa-grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))"><div class="mpa-field"><label>ไอคอนร้าน</label><img id="preview-image_url" ${draftMedia.image_url ? `src="${h(draftMedia.image_url)}"` : ''} alt="ตัวอย่างไอคอนร้าน" loading="lazy" style="width:96px;height:96px;object-fit:cover;border-radius:18px;border:1px solid var(--ap-line);${draftMedia.image_url ? '' : 'display:none'}"><label class="mpa-button mpa-button-secondary" style="display:inline-block;margin-top:9px">เลือกจากคลัง<input type="file" accept="image/jpeg,image/png,image/webp" data-media-field="image_url" hidden></label><label class="mpa-button mpa-button-secondary" style="display:inline-block;margin-top:9px">ถ่ายจากกล้อง<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-media-field="image_url" hidden></label></div><div class="mpa-field"><label>ภาพพื้นหลังร้าน</label><img id="preview-background_url" ${draftMedia.background_url ? `src="${h(draftMedia.background_url)}"` : ''} alt="ตัวอย่างภาพพื้นหลังร้าน" loading="lazy" style="width:100%;height:96px;object-fit:cover;border-radius:12px;border:1px solid var(--ap-line);${draftMedia.background_url ? '' : 'display:none'}"><label class="mpa-button mpa-button-secondary" style="display:inline-block;margin-top:9px">เลือกจากคลัง<input type="file" accept="image/jpeg,image/png,image/webp" data-media-field="background_url" hidden></label><label class="mpa-button mpa-button-secondary" style="display:inline-block;margin-top:9px">ถ่ายจากกล้อง<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-media-field="background_url" hidden></label></div></div><p id="mediaStatus" class="mpa-muted" aria-live="polite">ยังไม่มีการเปลี่ยนรูปภาพ</p></section><label><input id="active" type="checkbox" ${ctx.store.active ? 'checked' : ''}> เปิดรับออร์เดอร์</label><br><button class="mpa-button" style="margin-top:16px">บันทึกข้อมูลร้าน</button></form>`;
    document.querySelectorAll('[data-media-field]').forEach(input => input.addEventListener('change', async () => {
      const file = input.files?.[0]; const field = input.dataset.mediaField; if (!file || !field) return;
      const status = $('#mediaStatus');
      try {
        if (!window.APServiceMedia?.uploadPublicCatalogImage) throw new Error('ระบบอัปโหลดรูปภาพยังโหลดไม่พร้อม กรุณารีเฟรชแล้วลองใหม่');
        status.textContent = 'กำลังเตรียมรูปภาพ…'; const session = await M.auth.refreshSession(false);
        if (!session?.access_token || !session?.user?.id) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ก่อนอัปโหลด');
        const uploaded = await window.APServiceMedia.uploadPublicCatalogImage(file, { url: M.config.url, publishableKey: M.config.publishableKey, accessToken: session.access_token, actorId: session.user.id, pathPrefix: 'merchant', scope: `store-${ctx.store.id}-${field}`, mediaType: field === 'image_url' ? 'STORE_LOGO' : 'STORE_BACKGROUND', ownerType: 'merchant' });
        draftMedia[field] = uploaded.publicUrl; const preview = $(`#preview-${field}`); if (preview) { preview.src = uploaded.publicUrl; preview.style.display = ''; }
        status.textContent = `อัปโหลดและตรวจสอบรูป ${field === 'image_url' ? 'ไอคอนร้าน' : 'ภาพพื้นหลัง'} แล้ว กดบันทึกข้อมูลร้านเพื่อยืนยัน`;
      } catch (err) { input.value = ''; status.textContent = err.message || 'อัปโหลดรูปภาพไม่สำเร็จ'; M.ui.setNotice(status.textContent, 'error'); }
    }));
    $('#save').onsubmit = async event => {
      event.preventDefault();
      try {
        await M.request(`stores?id=eq.${encodeURIComponent(ctx.store.id)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: $('#name').value.trim(), description: $('#description').value.trim(), phone: $('#phone').value.trim(), eta: $('#eta').value.trim(), active: $('#active').checked, ...draftMedia, updated_at: M.ui.nowIso() }) });
        M.ui.setNotice('บันทึกข้อมูลร้านแล้ว');
      } catch (err) { M.ui.setNotice(err.message, 'error'); }
    };
  }

  async function finance() {
    const ctx = await gate('finance', `<div class="mpa-page-head"><div><h1>การเงินร้านค้า</h1><p>แสดง settlement และยอดขายตามสิทธิ์ของร้าน</p></div></div><section id="list" class="mpa-card">${M.ui.loading('กำลังโหลดข้อมูลการเงิน…')}</section>`);
    if (!ctx) return;
    try {
      const rows = await M.request(`settlements?select=*&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=created_at.desc&limit=100`, { private: true });
      $('#list').innerHTML = rows.length ? `<pre style="white-space:pre-wrap">${h(JSON.stringify(rows, null, 2))}</pre>` : M.ui.empty('ยังไม่มีรอบสรุปยอดสำหรับร้านนี้');
    } catch (err) { $('#list').innerHTML = M.ui.error('โหลดข้อมูลการเงินไม่สำเร็จ', err.message); }
  }

  async function settings() {
    const ctx = await gate('settings', `<section class="mpa-card"><h1>ตั้งค่าร้านค้า</h1><p class="mpa-muted">การตั้งค่าเฉพาะร้าน ไม่กระทบกติกากลางของแพลตฟอร์ม</p><button class="mpa-button mpa-button-secondary" id="out">ออกจากระบบ</button></section>`);
    if (ctx) $('#out').onclick = () => M.auth.signOut('login.html');
  }

  ({ login, dashboard, orders, menu, store, finance, settings }[page] || login)();
})();
