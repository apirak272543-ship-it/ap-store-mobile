(() => {
  'use strict';
  if (document.body?.dataset?.page !== 'orders') return;
  const M = window.APServiceMPA;
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const time = value => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? '-' : date.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }); };
  const mount = () => document.querySelectorAll('.mpa-order-card').forEach(card => {
    if (card.querySelector('[data-adjustment-log]')) return;
    const orderId = card.querySelector('[data-status]')?.dataset?.status;
    if (!orderId) return;
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.adjustmentLog = orderId; button.className = 'mpa-button mpa-button-secondary'; button.textContent = 'ดูประวัติการปรับ';
    card.querySelector('.mpa-order-card__foot')?.append(button);
    button.addEventListener('click', async () => {
      const dialog = document.createElement('dialog');
      dialog.style.cssText = 'border:0;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.3);width:min(92vw,560px);padding:0';
      dialog.innerHTML = '<section style="padding:20px"><h2 style="margin:0 0 8px">ประวัติการปรับออร์เดอร์</h2><p class="mpa-muted" data-log-state>กำลังอ่านประวัติจากระบบ…</p><div data-log-list style="display:grid;gap:10px"></div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button type="button" class="mpa-button mpa-button-secondary" data-close>ปิด</button></div></section>';
      document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-close]').onclick = () => { dialog.close(); dialog.remove(); }; dialog.addEventListener('close', () => dialog.remove(), { once: true });
      try {
        const rows = await M.request('rpc/merchant_list_order_adjustment_log', { method: 'POST', private: true, body: JSON.stringify({ p_order_id: orderId, p_limit: 60 }) });
        const list = dialog.querySelector('[data-log-list]'); const state = dialog.querySelector('[data-log-state]');
        state.textContent = rows?.length ? `พบ ${rows.length} รายการ · อ่านได้อย่างเดียว` : 'ยังไม่มีประวัติการปรับของออร์เดอร์นี้';
        list.innerHTML = (rows || []).map(row => `<article style="border:1px solid var(--ap-line);border-radius:12px;padding:11px"><strong>${escapeHtml(row.label || row.source)}</strong><p class="mpa-muted" style="margin:5px 0 0">${escapeHtml(row.actor_label || '-')} · ${escapeHtml(time(row.created_at))}</p>${row.detail ? `<p style="margin:6px 0 0">${escapeHtml(row.detail)}</p>` : ''}</article>`).join('');
      } catch (error) { dialog.querySelector('[data-log-state]').textContent = error.message || 'อ่านประวัติการปรับไม่สำเร็จ'; }
    });
  });
  const observer = new MutationObserver(mount); observer.observe(document.body, { childList: true, subtree: true }); mount(); addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
