(() => {
  'use strict';
  if (document.body?.dataset?.page !== 'orders') return;
  const M = window.APServiceMPA;
  const reasons = [
    ['out_of_stock', 'สินค้า/วัตถุดิบหมด'],
    ['store_closed', 'ร้านปิดกะทันหัน'],
    ['equipment_issue', 'อุปกรณ์ทำอาหารมีปัญหา'],
    ['other', 'อื่น ๆ (ระบุรายละเอียด)'],
  ];
  const nonce = () => `${Date.now()}-${crypto.randomUUID()}`;
  const mount = () => {
    document.querySelectorAll('.mpa-order-card').forEach(card => {
      if (card.querySelector('[data-quick-decline]')) return;
      const orderId = card.querySelector('[data-status]')?.dataset?.status;
      if (!orderId) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'mpa-button mpa-button-secondary'; button.dataset.quickDecline = orderId;
      button.style.cssText = 'border-color:#f0b7b0;color:#a32820'; button.textContent = 'ปฏิเสธออร์เดอร์';
      card.querySelector('.mpa-order-card__foot')?.append(button);
      button.addEventListener('click', () => {
        const dialog = document.createElement('dialog');
        dialog.style.cssText = 'border:0;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.3);width:min(92vw,440px);padding:0';
        dialog.innerHTML = `<form method="dialog" style="padding:20px"><h2 style="margin:0 0 8px">ปฏิเสธออร์เดอร์</h2><p class="mpa-muted">คำขอจะเข้าสู่ทีม Admin เพื่อตัดสินใจยกเลิกและคืนเงินตามสถานะการชำระจริง ระบบจะไม่คืนเงินจากหน้าร้านโดยตรง</p><label class="mpa-field"><span>เหตุผล</span><select name="reason" required>${reasons.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label><label class="mpa-field"><span>รายละเอียดเพิ่มเติม</span><textarea name="detail" rows="3" maxlength="500" placeholder="จำเป็นเมื่อเลือกอื่น ๆ"></textarea></label><p data-decline-status class="mpa-muted" aria-live="polite"></p><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px"><button type="button" data-close class="mpa-button mpa-button-secondary">ยกเลิก</button><button type="submit" class="mpa-button" style="background:#b42318">ส่งคำขอปฏิเสธ</button></div></form>`;
        document.body.append(dialog); dialog.showModal();
        dialog.querySelector('[data-close]').onclick = () => { dialog.close(); dialog.remove(); };
        dialog.addEventListener('close', () => dialog.remove(), { once: true });
        dialog.querySelector('form').addEventListener('submit', async event => {
          event.preventDefault(); const form = event.currentTarget, reason = form.elements.reason.value, detail = form.elements.detail.value.trim(), status = form.querySelector('[data-decline-status]'), submit = form.querySelector('[type="submit"]');
          if (reason === 'other' && detail.length < 3) { status.textContent = 'กรุณาระบุรายละเอียดอย่างน้อย 3 ตัวอักษร'; return; }
          submit.disabled = true;
          try {
            await M.request('rpc/request_merchant_order_cancellation', { method: 'POST', private: true, body: JSON.stringify({ p_order_id: orderId, p_reason_code: reason, p_detail: detail, p_idempotency_key: nonce() }) });
            M.ui.setNotice('ส่งคำขอยกเลิกให้ทีม Admin แล้ว'); dialog.close(); setTimeout(() => location.reload(), 400);
          } catch (error) { submit.disabled = false; status.textContent = error.message || 'ส่งคำขอปฏิเสธไม่สำเร็จ'; }
        });
      });
    });
  };
  const observer = new MutationObserver(mount);
  observer.observe(document.body, { childList: true, subtree: true });
  mount(); addEventListener('pagehide', () => observer.disconnect(), { once: true });
})();
