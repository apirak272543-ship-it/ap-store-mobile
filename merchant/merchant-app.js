(() => {
  'use strict';
  const M = window.APServiceMPA;
  const C = window.APServiceCore;
  const $ = selector => document.querySelector(selector);
  const h = M.ui.escapeHtml;
  if (!document.getElementById('merchant-modern-theme-style')) document.head.insertAdjacentHTML('beforeend', '<link id="merchant-modern-theme-style" rel="stylesheet" href="merchant-modern-theme.css?v=merchant-soft-art-v1">');
  const page = document.body.dataset.page;
  const pageScope = name => { const scope = M.network.createScope(name); addEventListener('pagehide', () => scope.dispose(), { once: true }); return scope; };
  const links = [['dashboard', 'ภาพรวม'], ['orders', 'ออร์เดอร์'], ['menu', 'เมนู'], ['store', 'ข้อมูลร้าน'], ['finance', 'การเงิน'], ['settings', 'ตั้งค่า']];

  const app = (active, content) => {
    const nav = links.map(([key, label]) => `<a class="${active === key ? 'active' : ''}" href="${key}.html">${label}</a>`).join('');
    document.body.innerHTML = `<header class="mpa-topbar"><a class="mpa-brand" href="dashboard.html">AP Service · ร้านค้า</a><nav class="mpa-nav">${nav}<a href="../store.html">Fallback</a></nav></header><main class="mpa-shell" data-page-content>${content}</main>`;
  };

  async function ownStore(user) {
    const rows = await M.request(`stores?select=id,name,description,phone,eta,active,owner_id,image_url,background_url,settlement_mode,settlement_credit_days,settlement_gp_percent,payout_method,payout_bank_name,payout_account_name,payout_account_number,payout_qr_url,settlement_note&owner_id=eq.${encodeURIComponent(user.id)}&limit=1`, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-store:${user.id}` });
    return rows?.[0] || null;
  }

  async function gate(active, content) {
    app(active, content);
    const access = await M.auth.requireRole('store_owner', { loginUrl: 'login.html', container: $('[data-page-content]'), renderLoading: false });
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
    const ctx = await gate('orders', `<div class="mpa-page-head"><div><h1>ออร์เดอร์ของร้าน</h1><p>แยกออร์เดอร์ใหม่ งานที่กำลังดำเนินการ และประวัติ โดยเปลี่ยนสถานะได้เฉพาะที่ Shared Core อนุญาต</p></div></div><section id="list" class="mpa-order-stack">${M.ui.loading('กำลังโหลดออร์เดอร์…')}</section>`);
    if (!ctx) return;
    const scope = pageScope('merchant:orders'); const path = `delivery_orders?select=id,customer_name,status,total,payable,ordered_at,updated_at,delivery_address,note,payment_method&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=ordered_at.desc&limit=200`; let lastSignature = '';
    const bucketFor = status => {
      const text = String(status || '');
      if (/สำเร็จ|ยกเลิก|ปฏิเสธ|คืนเงิน/.test(text)) return 'history';
      if (/ใหม่|รอร้าน|รอตอบรับ|รอรับ/.test(text)) return 'new';
      return 'active';
    };
    const render = rows => {
      const signature = JSON.stringify((rows || []).map(row => [row.id, row.status, row.updated_at])); if (signature === lastSignature) return; lastSignature = signature;
      if (!rows.length) { $('#list').innerHTML = M.ui.empty('ยังไม่มีออร์เดอร์'); return; }
      const sections = [
        { key: 'new', title: 'ออร์เดอร์ใหม่', caption: 'รายการที่ต้องตรวจสอบและตอบรับ', tone: 'new' },
        { key: 'active', title: 'กำลังดำเนินการ', caption: 'รายการที่ร้านกำลังจัดเตรียมหรือส่งต่อ', tone: 'active' },
        { key: 'history', title: 'ประวัติ', caption: 'รายการสำเร็จ ยกเลิก หรือปิดงานแล้ว', tone: 'history' },
      ];
      $('#list').innerHTML = sections.map(section => {
        const entries = rows.filter(row => bucketFor(row.status) === section.key);
        const cards = entries.length ? entries.map(row => {
          const choices = Object.values(C.contracts.orderStatus).filter(next => C.order.canTransition({ from: row.status, to: next, actor: 'merchant' }).ok);
          const orderTime = row.ordered_at ? new Date(row.ordered_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'ไม่พบเวลา';
          return `<article class="mpa-order-card"><div class="mpa-order-card__head"><div><span class="mpa-kicker">${h(row.id || 'ORDER')}</span><h3>${h(row.customer_name || 'ไม่ระบุชื่อลูกค้า')}</h3></div><span class="mpa-badge">${h(row.status || 'ไม่ทราบสถานะ')}</span></div><div class="mpa-order-card__meta"><span>🕒 ${h(orderTime)}</span><span>💳 ${h(row.payment_method || 'ยังไม่ระบุวิธีชำระ')}</span></div><p class="mpa-order-card__address">📍 ${h(row.delivery_address || 'ยังไม่มีที่อยู่จัดส่ง')}</p>${row.note ? `<p class="mpa-order-card__note">หมายเหตุ: ${h(row.note)}</p>` : ''}<div class="mpa-order-card__foot"><strong>${M.ui.baht(row.payable ?? row.total)}</strong>${choices.length ? `<label class="mpa-order-card__action"><span>อัปเดตงาน</span><select data-status="${h(row.id)}"><option value="">เลือกสถานะ…</option>${choices.map(item => `<option value="${h(item)}">${h(item)}</option>`).join('')}</select></label>` : '<span class="mpa-muted">ไม่มีการดำเนินการเพิ่มเติม</span>'}</div></article>`;
        }).join('') : `<p class="mpa-muted mpa-group-empty">ไม่มี${section.title.toLowerCase()}ในขณะนี้</p>`;
        return `<section class="mpa-order-group" data-order-group="${section.key}"><div class="mpa-order-group__head"><div><span class="mpa-kicker mpa-kicker--${section.tone}">${section.title}</span><p>${section.caption}</p></div><strong>${entries.length}</strong></div><div class="mpa-order-grid">${cards}</div></section>`;
      }).join('');
      document.querySelectorAll('[data-status]').forEach(select => select.onchange = async () => {
        if (!select.value) return;
        select.disabled = true;
        try {
          await M.request(`delivery_orders?id=eq.${encodeURIComponent(select.dataset.status)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: select.value, updated_at: M.ui.nowIso() }) });
          M.ui.setNotice('อัปเดตสถานะออร์เดอร์แล้ว'); setTimeout(() => location.reload(), 350);
        } catch (err) { select.disabled = false; M.ui.setNotice(err.message, 'error'); }
      });
    };
    try { render(await scope.request(path, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-orders:${ctx.store.id}` })); } catch (err) { if (err.code !== M.network.STALE_RESPONSE) $('#list').innerHTML = M.ui.error('โหลดออร์เดอร์ไม่สำเร็จ', err.message); return; }
    const stop = M.network.startBackgroundSync({ key: `merchant-orders:${ctx.store.id}`, intervalMs: 15_000, task: async () => { const rows = await M.request(path, { private: true, forceFresh: true, cacheKey: `merchant-orders:${ctx.store.id}` }); const signature = JSON.stringify((rows || []).map(row => [row.id, row.status, row.updated_at])); return { changed: signature !== lastSignature, data: rows }; }, onData: render, onError: error => M.ui.setNotice(`อัปเดตออร์เดอร์ไม่สำเร็จ: ${error.message}`, 'error') }); addEventListener('pagehide', stop, { once: true });
  }

  async function menu() {
    const ctx = await gate('menu', `<div class="mpa-page-head"><div><h1>เมนูและสต็อก</h1><p>เพิ่ม แก้ไขรูปภาพ ราคา สต็อก และสถานะขายของเมนูที่อยู่ในร้านของคุณ</p></div></div><section class="mpa-card mpa-menu-editor"><form id="add"><div class="mpa-grid mpa-menu-editor__fields"><div class="mpa-field"><label>ชื่อเมนู</label><input id="name" required maxlength="120"></div><div class="mpa-field"><label>หมวดเมนู</label><select id="category"><option value="">ยังไม่จัดหมวด</option></select></div><div class="mpa-field"><label>ราคา (บาท)</label><input id="price" type="number" min="0" step="0.01" required></div><div class="mpa-field"><label>สต็อก</label><input id="stock" type="number" min="0" value="0" required></div><div class="mpa-field mpa-menu-editor__wide"><label>รายละเอียด</label><input id="description" maxlength="280" placeholder="บอกรายละเอียดสั้น ๆ ให้ลูกค้าตัดสินใจง่ายขึ้น"></div></div><div class="mpa-menu-media"><img id="preview-menu-image" alt="ตัวอย่างรูปเมนูใหม่" loading="lazy" hidden><div><strong>รูปเมนู</strong><p class="mpa-muted">เลือกจากคลังหรือถ่ายจากกล้อง ระบบบีบอัด JPEG อัตโนมัติไม่เกิน 1200px ที่คุณภาพ 0.82</p><label class="mpa-button mpa-button-secondary">เลือกจากคลัง<input type="file" accept="image/jpeg,image/png,image/webp" data-new-menu-image hidden></label><label class="mpa-button mpa-button-secondary">ถ่ายจากกล้อง<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-new-menu-image hidden></label></div></div><label class="mpa-check"><input id="promo" type="checkbox"> เมนูโปรโมชัน</label><p id="menuMediaStatus" class="mpa-muted" aria-live="polite">ยังไม่มีการเลือกรูปภาพ</p><button class="mpa-button">เพิ่มเมนู</button></form></section><section id="list" class="mpa-menu-list">${M.ui.loading('กำลังโหลดเมนู…')}</section>`);
    if (!ctx) return;
    const draftMedia = { image_url: '' };
    let categoryRows = [];
    const categoryOptions = selected => `<option value="">ยังไม่จัดหมวด</option>${categoryRows.filter(row => row.active !== false || row.id === selected).map(row => `<option value="${h(row.id)}" ${row.id === selected ? 'selected' : ''}>${h(row.icon || '🍽️')} ${h(row.name)}</option>`).join('')}`;
    const writeMenuImage = async (file, itemId = '') => {
      if (!file) return '';
      if (!window.APServiceMedia?.uploadPublicCatalogImage) throw new Error('ระบบอัปโหลดรูปภาพยังโหลดไม่พร้อม กรุณารีเฟรชแล้วลองใหม่');
      const session = await M.auth.refreshSession(false);
      if (!session?.access_token || !session?.user?.id) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่ก่อนอัปโหลด');
      const uploaded = await window.APServiceMedia.uploadPublicCatalogImage(file, { url: M.config.url, publishableKey: M.config.publishableKey, accessToken: session.access_token, actorId: session.user.id, pathPrefix: 'merchant', scope: `menu-${ctx.store.id}-${itemId || 'draft'}`, mediaType: 'PRODUCT_IMAGE', ownerType: 'merchant' });
      return uploaded.publicUrl;
    };
    const bindNewImage = () => document.querySelectorAll('[data-new-menu-image]').forEach(input => input.addEventListener('change', async () => {
      const file = input.files?.[0]; if (!file) return;
      const status = $('#menuMediaStatus');
      try {
        status.textContent = 'กำลังอัปโหลดและตรวจสอบรูปเมนู…'; draftMedia.image_url = await writeMenuImage(file); const preview = $('#preview-menu-image'); preview.src = draftMedia.image_url; preview.hidden = false; status.textContent = 'รูปเมนูพร้อมแล้ว กดเพิ่มเมนูเพื่อบันทึก';
      } catch (err) { input.value = ''; status.textContent = err.message || 'อัปโหลดรูปเมนูไม่สำเร็จ'; M.ui.setNotice(status.textContent, 'error'); }
    }));
    const render = rows => {
      if (!rows.length) { $('#list').innerHTML = M.ui.empty('ยังไม่มีเมนู'); return; }
      const categoryById = new Map(categoryRows.map(row => [row.id, row]));
      const groups = categoryRows.filter(row => row.active !== false).map(category => ({ id: category.id, name: category.name, icon: category.icon || '🍽️', rows: rows.filter(row => row.category_id === category.id) })).filter(group => group.rows.length);
      const ungrouped = rows.filter(row => !row.category_id || !categoryById.has(row.category_id)); if (ungrouped.length) groups.push({ id: '', name: 'ยังไม่จัดหมวด', icon: '⋯', rows: ungrouped });
      $('#list').innerHTML = groups.map(group => `<section class="mpa-menu-group"><div class="mpa-menu-group__head"><div><span>${h(group.icon)}</span><h2>${h(group.name)}</h2></div><strong>${group.rows.length}</strong></div><div class="mpa-menu-grid">${group.rows.map(row => `<article class="mpa-menu-card"><div class="mpa-menu-card__media">${safeAsset(row.image_url) ? `<img src="${h(safeAsset(row.image_url))}" alt="${h(row.name)}" loading="lazy">` : `<span>${h(row.emoji || '🍜')}</span>`}</div><div class="mpa-menu-card__body"><div class="mpa-menu-card__head"><div><h3>${h(row.name)}</h3>${row.promo ? '<span class="mpa-badge">โปรโมชัน</span>' : ''}</div><strong>${M.ui.baht(row.price)}</strong></div><p>${h(row.description || 'ยังไม่มีรายละเอียดเมนู')}</p><div class="mpa-menu-card__stock"><span>คงเหลือ <strong>${Number(row.stock || 0)}</strong></span><label class="mpa-switch"><input type="checkbox" data-menu-available="${h(row.id)}" ${row.available ? 'checked' : ''}><span>พร้อมขาย</span></label></div><details class="mpa-menu-card__edit"><summary>แก้ไขเมนู</summary><form data-menu-edit="${h(row.id)}"><div class="mpa-grid"><div class="mpa-field"><label>ชื่อ</label><input name="name" value="${h(row.name)}" required maxlength="120"></div><div class="mpa-field"><label>หมวด</label><select name="category_id">${categoryOptions(row.category_id || '')}</select></div><div class="mpa-field"><label>ราคา</label><input name="price" type="number" min="0" step="0.01" value="${Number(row.price || 0)}" required></div><div class="mpa-field"><label>สต็อก</label><input name="stock" type="number" min="0" value="${Number(row.stock || 0)}" required></div><div class="mpa-field mpa-menu-editor__wide"><label>รายละเอียด</label><input name="description" value="${h(row.description || '')}" maxlength="280"></div></div><label class="mpa-check"><input name="promo" type="checkbox" ${row.promo ? 'checked' : ''}> เมนูโปรโมชัน</label><button class="mpa-button" type="submit">บันทึกการแก้ไข</button></form></details><div class="mpa-menu-card__image-actions"><label class="mpa-button mpa-button-secondary">เปลี่ยนจากคลัง<input type="file" accept="image/jpeg,image/png,image/webp" data-menu-image="${h(row.id)}" hidden></label><label class="mpa-button mpa-button-secondary">ถ่ายรูปใหม่<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" data-menu-image="${h(row.id)}" hidden></label></div></div></article>`).join('')}</div></section>`).join('');
      document.querySelectorAll('[data-menu-available]').forEach(input => input.onchange = async () => { input.disabled = true; try { await M.request(`menu_items?id=eq.${encodeURIComponent(input.dataset.menuAvailable)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ available: input.checked, updated_at: M.ui.nowIso() }) }); M.ui.setNotice(input.checked ? 'เปิดขายเมนูแล้ว' : 'ปิดขายเมนูแล้ว'); } catch (err) { input.checked = !input.checked; M.ui.setNotice(err.message, 'error'); } finally { input.disabled = false; } });
      document.querySelectorAll('[data-menu-edit]').forEach(form => form.onsubmit = async event => { event.preventDefault(); const fields = event.currentTarget.elements; try { await M.request(`menu_items?id=eq.${encodeURIComponent(event.currentTarget.dataset.menuEdit)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ name: fields.name.value.trim(), description: fields.description.value.trim(), price: Number(fields.price.value), stock: Number(fields.stock.value), category_id: fields.category_id.value || null, promo: fields.promo.checked, updated_at: M.ui.nowIso() }) }); M.ui.setNotice('บันทึกเมนูแล้ว'); load(); } catch (err) { M.ui.setNotice(err.message, 'error'); } });
      document.querySelectorAll('[data-menu-image]').forEach(input => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; try { const image_url = await writeMenuImage(file, input.dataset.menuImage); await M.request(`menu_items?id=eq.${encodeURIComponent(input.dataset.menuImage)}`, { method: 'PATCH', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ image_url, updated_at: M.ui.nowIso() }) }); M.ui.setNotice('อัปเดตรูปเมนูแล้ว'); load(); } catch (err) { input.value = ''; M.ui.setNotice(err.message || 'อัปโหลดรูปเมนูไม่สำเร็จ', 'error'); } }));
    };
    const load = async () => {
      try {
        const [rows, categories] = await Promise.all([
          M.request(`menu_items?select=id,name,emoji,description,price,stock,available,promo,image_url,category_id,updated_at&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=name.asc`, { private: true }),
          M.request(`menu_categories?select=id,name,icon,sort_order,active&store_id=eq.${encodeURIComponent(ctx.store.id)}&order=sort_order.asc`, { private: true }).catch(() => []),
        ]);
        categoryRows = categories || []; $('#category').innerHTML = categoryOptions(''); render(rows || []);
      } catch (err) { $('#list').innerHTML = M.ui.error('โหลดเมนูไม่สำเร็จ', err.message); }
    };
    $('#add').onsubmit = async event => { event.preventDefault(); try { await M.request('menu_items', { method: 'POST', private: true, headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ store_id: ctx.store.id, name: $('#name').value.trim(), emoji: '🍜', description: $('#description').value.trim(), price: Number($('#price').value), stock: Number($('#stock').value), available: true, promo: $('#promo').checked, category_id: $('#category').value || null, image_url: draftMedia.image_url || null }) }); M.ui.setNotice('เพิ่มเมนูแล้ว'); event.target.reset(); draftMedia.image_url = ''; $('#preview-menu-image').hidden = true; $('#menuMediaStatus').textContent = 'ยังไม่มีการเลือกรูปภาพ'; load(); } catch (err) { M.ui.setNotice(err.message, 'error'); } };
    bindNewImage(); load();
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
    const ctx = await gate('finance', `<div class="mpa-page-head"><div><h1>การเงินร้านค้า</h1><p>ดูรอบสรุปยอดที่ Admin อนุมัติให้ร้าน พร้อมรายละเอียดการจ่ายเงินจริง</p></div></div><section id="finance">${M.ui.loading('กำลังโหลดข้อมูลการเงิน…')}</section>`);
    if (!ctx) return;
    const scope = pageScope('merchant:finance');
    const path = `settlements?select=id,status,gross_amount,gp_percent,gp_amount,net_amount,period_start,period_end,due_date,paid_at,created_at,payment_reference,payment_note,proof_image_url&store_id=eq.${encodeURIComponent(ctx.store.id)}&recipient_type=eq.store&order=created_at.desc&limit=100`;
    let lastSignature = '';
    const dateLabel = value => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' }) : 'ยังไม่ระบุ';
    const dateOnly = value => value ? new Date(value).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : 'ยังไม่ระบุ';
    const amount = value => Number.isFinite(Number(value)) ? M.ui.baht(Number(value)) : 'ไม่พบยอด';
    const summaryAmount = rows => rows.length ? amount(rows.reduce((total, row) => total + Number(row.net_amount || 0), 0)) : 'ไม่มีข้อมูล';
    const settlementStatus = status => ({ paid: 'จ่ายแล้ว', pending: 'รอจ่าย', void: 'ยกเลิก' }[String(status || '').toLowerCase()] || 'ไม่ทราบสถานะ');
    const settlementTone = status => String(status || '').toLowerCase() === 'paid' ? 'mpa-finance-status--paid' : String(status || '').toLowerCase() === 'pending' ? 'mpa-finance-status--pending' : 'mpa-finance-status--void';
    const maskedAccount = value => { const text = String(value || '').trim(); return text ? `${'•'.repeat(Math.max(0, text.length - 4))}${text.slice(-4)}` : 'ยังไม่ระบุ'; };
    const renderPayout = () => {
      const config = [
        ['รูปแบบสรุปยอด', ctx.store.settlement_mode],
        ['เครดิตการจ่ายเงิน', Number.isFinite(Number(ctx.store.settlement_credit_days)) ? `${Number(ctx.store.settlement_credit_days)} วัน` : 'ยังไม่ระบุ'],
        ['ช่องทางรับเงิน', ctx.store.payout_method],
        ['ธนาคาร', ctx.store.payout_bank_name],
        ['ชื่อบัญชี', ctx.store.payout_account_name],
        ['เลขบัญชี', maskedAccount(ctx.store.payout_account_number)],
      ].filter(([, value]) => String(value || '').trim());
      if (!config.length && !ctx.store.settlement_note) return '';
      return `<section class="mpa-card mpa-finance-payout"><div><span class="mpa-kicker">การรับเงิน</span><h2>ข้อมูลรับชำระของร้าน</h2><p class="mpa-muted">ข้อมูลนี้ถูกตั้งค่าจากศูนย์กลางและแสดงแบบอ่านอย่างเดียว</p></div><dl>${config.map(([label, value]) => `<div><dt>${h(label)}</dt><dd>${h(value)}</dd></div>`).join('')}</dl>${ctx.store.settlement_note ? `<p class="mpa-finance-note">${h(ctx.store.settlement_note)}</p>` : ''}</section>`;
    };
    const render = rows => {
      const normalized = Array.isArray(rows) ? rows : [];
      const signature = JSON.stringify(normalized.map(row => [row.id, row.status, row.net_amount, row.gp_amount, row.paid_at, row.updated_at]));
      if (signature === lastSignature) return;
      lastSignature = signature;
      if (!normalized.length) {
        $('#finance').innerHTML = `<section class="mpa-card">${M.ui.empty('ยังไม่มีรอบสรุปยอดสำหรับร้านนี้', 'เมื่อ Admin สร้างและอนุมัติรอบการจ่ายเงิน รายการจะแสดงในหน้านี้')}</section>${renderPayout()}`;
        return;
      }
      const eligible = normalized.filter(row => String(row.status || '').toLowerCase() !== 'void');
      const paid = eligible.filter(row => String(row.status || '').toLowerCase() === 'paid');
      const pending = eligible.filter(row => String(row.status || '').toLowerCase() === 'pending');
      const gross = eligible.reduce((total, row) => total + Number(row.gross_amount || 0), 0);
      const gp = eligible.reduce((total, row) => total + Number(row.gp_amount || 0), 0);
      $('#finance').innerHTML = `<div class="mpa-grid cards mpa-finance-summary"><article class="mpa-card mpa-stat"><small>ยอดขายตามรอบที่ใช้งาน</small><strong>${amount(gross)}</strong><span>${eligible.length} รอบ · ไม่รวมรายการยกเลิก</span></article><article class="mpa-card mpa-stat"><small>ยอดสุทธิที่จ่ายแล้ว</small><strong>${summaryAmount(paid)}</strong><span>${paid.length ? `${paid.length} รอบที่ยืนยันการจ่าย` : 'ยังไม่มีรอบที่จ่ายแล้ว'}</span></article><article class="mpa-card mpa-stat"><small>ยอดสุทธิรอจ่าย</small><strong>${summaryAmount(pending)}</strong><span>${pending.length ? `${pending.length} รอบที่กำลังรอการจ่าย` : 'ไม่มีรายการรอจ่าย'}</span></article><article class="mpa-card mpa-stat"><small>GP แพลตฟอร์มตามรอบ</small><strong>${amount(gp)}</strong><span>ใช้ยอดที่ Admin บันทึกใน settlement</span></article></div><section class="mpa-card mpa-finance-ledger"><div class="mpa-finance-ledger__head"><div><span class="mpa-kicker">ประวัติ settlement</span><h2>รอบสรุปยอด</h2></div><span class="mpa-muted">${normalized.length} รายการ</span></div><div class="mpa-finance-list">${normalized.map(row => `<article class="mpa-finance-row"><div class="mpa-finance-row__head"><div><strong>${h(row.id || 'SETTLEMENT')}</strong><span>สร้างเมื่อ ${h(dateLabel(row.created_at))}</span></div><span class="mpa-finance-status ${settlementTone(row.status)}">${h(settlementStatus(row.status))}</span></div><dl><div><dt>ช่วงคำนวณ</dt><dd>${h(dateOnly(row.period_start))} — ${h(dateOnly(row.period_end))}</dd></div><div><dt>ยอดขายรวม</dt><dd>${h(amount(row.gross_amount))}</dd></div><div><dt>GP แพลตฟอร์ม${row.gp_percent !== null && row.gp_percent !== undefined ? ` (${h(row.gp_percent)}%)` : ''}</dt><dd>${h(amount(row.gp_amount))}</dd></div><div><dt>ยอดรับสุทธิ</dt><dd class="mpa-finance-row__net">${h(amount(row.net_amount))}</dd></div><div><dt>${String(row.status || '').toLowerCase() === 'paid' ? 'จ่ายเมื่อ' : 'ครบกำหนด'}</dt><dd>${h(String(row.status || '').toLowerCase() === 'paid' ? dateLabel(row.paid_at) : dateOnly(row.due_date))}</dd></div></dl>${row.payment_reference || row.payment_note || row.proof_image_url ? `<footer>${row.payment_reference ? `<span>อ้างอิง: ${h(row.payment_reference)}</span>` : ''}${row.payment_note ? `<span>${h(row.payment_note)}</span>` : ''}${row.proof_image_url ? `<a href="${h(row.proof_image_url)}" target="_blank" rel="noopener">ดูหลักฐานการจ่าย</a>` : ''}</footer>` : ''}</article>`).join('')}</div></section>${renderPayout()}`;
    };
    try { render(await scope.request(path, { private: true, cacheTtlMs: 10_000, cacheKey: `merchant-finance:${ctx.store.id}` })); } catch (err) { if (err.code !== M.network.STALE_RESPONSE) $('#finance').innerHTML = M.ui.error('โหลดข้อมูลการเงินไม่สำเร็จ', err.message); return; }
    const stop = M.network.startBackgroundSync({ key: `merchant-finance:${ctx.store.id}`, intervalMs: 20_000, task: async () => { const rows = await M.request(path, { private: true, forceFresh: true, cacheKey: `merchant-finance:${ctx.store.id}` }); const signature = JSON.stringify((rows || []).map(row => [row.id, row.status, row.net_amount, row.gp_amount, row.paid_at, row.updated_at])); return { changed: signature !== lastSignature, data: rows }; }, onData: render, onError: error => M.ui.setNotice(`อัปเดตข้อมูลการเงินไม่สำเร็จ: ${error.message}`, 'error') });
    addEventListener('pagehide', stop, { once: true });
  }

  async function settings() {
    const ctx = await gate('settings', `<section class="mpa-card"><h1>ตั้งค่าร้านค้า</h1><p class="mpa-muted">การตั้งค่าเฉพาะร้าน ไม่กระทบกติกากลางของแพลตฟอร์ม</p><button class="mpa-button mpa-button-secondary" id="out">ออกจากระบบ</button></section>`);
    if (ctx) $('#out').onclick = () => M.auth.signOut('login.html');
  }

  ({ login, dashboard, orders, menu, store, finance, settings }[page] || login)();
})();
