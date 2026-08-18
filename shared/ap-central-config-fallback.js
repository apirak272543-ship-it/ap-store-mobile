(function () {
  'use strict';

  const asset = value => /^(https?:\/\/|data:image\/)/i.test(String(value || '').trim()) ? String(value).trim() : '';
  const pick = (value, keys, fallback = '') => keys.map(key => value?.[key]).find(item => item !== undefined && item !== null && String(item).trim() !== '') ?? fallback;
  const config = { brand: {}, promotions: {}, payment: {}, control: { status: 'active' } };
  let loading = false;
  let lastUserId = '';

  function panel() {
    let host = document.getElementById('storeCentralConfig');
    if (!host) {
      host = document.createElement('section');
      host.id = 'storeCentralConfig';
      host.className = 'card wide';
      host.style.cssText = 'margin-top:18px;overflow:hidden;padding:0';
      document.querySelector('#storePage-home')?.prepend(host);
    }
    return host;
  }

  function render() {
    const brand = config.brand || {};
    const promotions = Array.isArray(config.promotions?.items) ? config.promotions.items.filter(item => item && item.active !== false).slice(0, 4) : [];
    const name = pick(brand, ['brand_name', 'brandName', 'name', 'title'], 'AP Service');
    const logo = asset(pick(brand, ['logo_url', 'logoUrl', 'logo']));
    const background = asset(pick(brand, ['background_url', 'backgroundUrl', 'background']));
    const banner = asset(pick(brand, ['banner_url', 'bannerUrl', 'banner']));
    const provider = pick(config.payment, ['provider'], 'ยังไม่กำหนด');
    panel().innerHTML = `<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:${background ? `linear-gradient(90deg,rgba(56,32,11,.78),rgba(56,32,11,.18)),url('${esc(background)}') center/cover` : 'linear-gradient(135deg,#fff7e8,#fff)'};color:${background ? '#fff' : 'inherit'}"><div style="width:52px;height:52px;border-radius:15px;overflow:hidden;display:grid;place-items:center;background:rgba(255,255,255,.78);font-size:25px;flex:0 0 auto">${logo ? `<img src="${esc(logo)}" alt="" style="width:100%;height:100%;object-fit:cover">` : '🍽️'}</div><div><strong>${esc(name)}</strong><div style="font-size:10px;opacity:.85">ค่ากลางจาก Admin · ช่องทางชำระเงิน: ${esc(provider)}</div></div></div>${banner ? `<img src="${esc(banner)}" alt="แบนเนอร์จาก Admin" loading="lazy" style="display:block;width:100%;max-height:150px;object-fit:cover">` : ''}<div style="padding:12px 16px"><strong style="font-size:12px">โปรโมชันที่เผยแพร่</strong>${promotions.length ? `<div style="display:grid;gap:8px;margin-top:9px">${promotions.map(item => `<div style="display:flex;gap:9px;align-items:center"><div style="width:38px;height:38px;border-radius:10px;overflow:hidden;background:#fff4dc;display:grid;place-items:center;flex:0 0 auto">${asset(item.image_url) ? `<img src="${esc(asset(item.image_url))}" alt="" style="width:100%;height:100%;object-fit:cover">` : '✦'}</div><div><strong style="font-size:11px">${esc(item.badge ? `${item.badge} · ` : '')}${esc(item.title || 'โปรโมชัน')}</strong><div class="muted">${esc(item.description || '')}</div></div></div>`).join('')}</div>` : '<p class="muted" style="margin:8px 0 0">ยังไม่มีโปรโมชันที่เผยแพร่</p>'}<p class="muted" style="margin:10px 0 0">กฎธุรกิจส่วนกลางไม่ถูกเปิดให้อ่านจาก Store ตาม RLS ปัจจุบัน</p></div>`;
    const mark = document.querySelector('.brand .mark');
    if (mark) mark.innerHTML = logo ? `<img src="${esc(logo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : '🍽️';
    const title = document.querySelector('.brand b');
    if (title) title.textContent = name;
  }

  async function load() {
    if (loading) return;
    const session = Cloud.session();
    const userId = session?.user?.id || State.session?.userId || '';
    if (!userId) return;
    loading = true;
    try {
      const rows = await Cloud.request('platform_configs?select=key,value&key=in.(brand_public,customer_promotions,payment_public)');
      (rows || []).forEach(row => { if (row.key === 'brand_public') config.brand = row.value || {}; if (row.key === 'customer_promotions') config.promotions = row.value || {}; if (row.key === 'payment_public') config.payment = row.value || {}; });
      const controls = await Cloud.request('account_controls?select=status,suspension_reason,feature_overrides&user_id=eq.' + encodeURIComponent(userId) + '&limit=1');
      config.control = controls?.[0] || { status: 'active' };
      lastUserId = userId;
      if (config.control.status === 'suspended') {
        $('#dashboardView')?.classList.add('hidden');
        $('#storeBadge').textContent = 'บัญชีถูกระงับ';
        $('#storeBadge').className = 'status closed';
        toast('บัญชีร้านค้าถูกระงับการใช้งาน' + (config.control.suspension_reason ? `: ${config.control.suspension_reason}` : ''));
        return;
      }
      render();
    } catch (error) {
      console.warn('Store fallback central config read skipped', error);
    } finally {
      loading = false;
    }
  }

  const originalLogin = Cloud.login.bind(Cloud);
  Cloud.login = async function (...args) {
    const result = await originalLogin(...args);
    await load();
    return result;
  };

  load();
  setInterval(() => {
    const userId = Cloud.session()?.user?.id || '';
    if (userId && userId === lastUserId) load();
    else if (userId) load();
  }, 30_000);
})();

