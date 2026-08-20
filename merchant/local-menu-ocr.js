(() => {
  'use strict';

  const MAX_BYTES = 1024 * 1024;
  const MAX_SIDE = 1800;
  const priceAtLineEnd = /(?:฿\s*|ราคา\s*)?(\d{1,6}(?:[.,]\d{1,2})?)\s*(?:บาท|฿|[.\-–]+)?\s*$/iu;
  const letters = /[A-Za-zก-๙]/u;
  const categoryCandidates = new Set(['อาหารจานเดียว', 'กับข้าว', 'ต้ม', 'ผัด', 'ทอด', 'ยำ', 'ก๋วยเตี๋ยว', 'ข้าว', 'เครื่องดื่ม', 'ของหวาน', 'ของทานเล่น', 'เมนูแนะนำ']);

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const normalizeLine = value => String(value || '').replace(/\s+/g, ' ').replace(/[|¦]/g, ' ').trim();
  const newKey = () => `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  async function compressForOcr(file) {
    if (!(file instanceof File)) throw new Error('กรุณาเลือกไฟล์ภาพก่อนเริ่มอ่านรายการ');
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('รองรับเฉพาะ JPEG, PNG หรือ WebP');
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;
    const ratio = Math.min(1, MAX_SIDE / Math.max(width, height));
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('อุปกรณ์ไม่รองรับการเตรียมภาพสำหรับ OCR');
    let quality = 0.88;
    let blob = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (blob && blob.size <= MAX_BYTES) break;
      quality = Math.max(0.5, quality - 0.08);
      if (attempt >= 3) {
        width = Math.max(480, Math.round(width * 0.82));
        height = Math.max(480, Math.round(height * 0.82));
      }
    }
    bitmap.close?.();
    if (!blob || blob.size > MAX_BYTES) throw new Error('ไม่สามารถลดขนาดภาพให้ไม่เกิน 1 MB ได้ กรุณาถ่ายภาพให้ใกล้และชัดขึ้น');
    return blob;
  }

  function parsePrice(value) {
    const line = normalizeLine(value);
    const match = line.match(priceAtLineEnd);
    if (!match) return { name: line, price: null };
    const price = Number(match[1].replace(',', '.'));
    const name = normalizeLine(line.slice(0, match.index));
    if (!name || !Number.isFinite(price) || price < 0) return { name: line, price: null };
    return { name, price };
  }

  function parseMenuText(text) {
    const sourceLines = String(text || '').split(/\r?\n/).map(normalizeLine).filter(line => line.length > 0);
    const drafts = [];
    let activeCategory = '';
    sourceLines.forEach((line, index) => {
      const parsed = parsePrice(line);
      if (parsed.price !== null && letters.test(parsed.name)) {
        drafts.push({ id: newKey(), name: parsed.name.slice(0, 120), price: parsed.price, categoryName: activeCategory, stock: 0, selected: true, needsReview: false, sourceLine: line });
        return;
      }
      const next = sourceLines[index + 1] ? parsePrice(sourceLines[index + 1]) : null;
      const isHeader = letters.test(line) && !/\d/.test(line) && line.length <= 50 && (categoryCandidates.has(line) || next?.price !== null);
      if (isHeader) activeCategory = line.slice(0, 80);
    });
    if (drafts.length === 0) {
      sourceLines.filter(line => letters.test(line) && line.length <= 120).slice(0, 60).forEach(line => {
        drafts.push({ id: newKey(), name: line, price: null, categoryName: activeCategory, stock: 0, selected: true, needsReview: true, sourceLine: line });
      });
    }
    return drafts;
  }

  async function recognize(file, onProgress = () => {}) {
    if (!window.Tesseract?.createWorker) throw new Error('ชุด OCR ในเครื่องยังโหลดไม่พร้อม กรุณารีเฟรชแล้วลองใหม่');
    const compressed = await compressForOcr(file);
    const assetRoot = new URL('../shared/ocr/', window.location.href).href;
    const worker = await window.Tesseract.createWorker('tha+eng', 1, {
      workerPath: `${assetRoot}worker.min.js`,
      langPath: `${assetRoot}lang`,
      corePath: `${assetRoot}core/tesseract-core-lstm.wasm.js`,
      logger: event => {
        if (event?.status) onProgress(event.status, Number(event.progress || 0));
      },
    });
    try {
      const result = await worker.recognize(compressed);
      return { drafts: parseMenuText(result?.data?.text || ''), sourceText: result?.data?.text || '', bytes: compressed.size };
    } finally {
      await worker.terminate();
    }
  }

  function mount({ host, getCategories, onCommit }) {
    if (!host || host.dataset.localOcrMounted === 'true') return;
    host.dataset.localOcrMounted = 'true';
    const state = { drafts: [], busy: false, sourceText: '' };
    const render = () => {
      const categories = typeof getCategories === 'function' ? getCategories() : [];
      const selected = state.drafts.filter(row => row.selected);
      const ready = selected.filter(row => row.name.trim() && Number.isFinite(Number(row.price)) && Number(row.price) >= 0);
      const missingPrice = selected.length - ready.length;
      host.innerHTML = `<div class="mpa-page-head"><div><h2 style="margin:0">นำเข้าเมนูจากภาพ</h2><p class="mpa-muted">OCR ทำงานในอุปกรณ์จากไฟล์ภายในแอป ไม่มี API หรือ token ภายนอก ข้อมูลจะยังไม่ถูกบันทึกจนกว่าคุณตรวจและยืนยัน</p></div></div><div class="mpa-menu-media"><div><strong>ภาพรายการเมนู</strong><p class="mpa-muted">รองรับ JPEG, PNG, WebP; ระบบลดขนาดสำหรับ OCR ไม่เกิน 1 MB</p><label class="mpa-button mpa-button-secondary">เลือกภาพรายการ<input id="localOcrFile" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden></label><button id="localOcrRun" type="button" class="mpa-button">อ่านรายการจากภาพ</button></div><p id="localOcrStatus" class="mpa-muted" aria-live="polite">ยังไม่ได้เลือกภาพ</p></div>${state.drafts.length ? `<div class="mpa-card" style="box-shadow:none;border:1px solid var(--ap-line);margin-top:14px"><div class="mpa-page-head"><div><h3 style="margin:0">ตรวจทานก่อนบันทึก</h3><p class="mpa-muted">เลือกแล้ว ${selected.length} รายการ · พร้อมบันทึก ${ready.length} รายการ${missingPrice ? ` · ต้องกรอกราคา ${missingPrice} รายการ` : ''}</p></div><button id="localOcrAddRow" type="button" class="mpa-button mpa-button-secondary">เพิ่มรายการเอง</button></div><div style="overflow-x:auto"><table class="mpa-table" style="min-width:760px"><thead><tr><th>นำเข้า</th><th>ชื่อเมนู</th><th>ราคา</th><th>หมวด</th><th>สต็อก</th><th></th></tr></thead><tbody>${state.drafts.map(row => `<tr data-local-ocr-row="${escapeHtml(row.id)}"><td><input data-field="selected" type="checkbox" ${row.selected ? 'checked' : ''}></td><td><input data-field="name" maxlength="120" value="${escapeHtml(row.name)}">${row.needsReview ? '<small class="mpa-muted">ต้องตรวจราคา</small>' : ''}</td><td><input data-field="price" type="number" min="0" step="0.01" value="${row.price ?? ''}" placeholder="ต้องกรอก"></td><td><select data-field="categoryName"><option value="">ยังไม่จัดหมวด</option>${categories.map(category => `<option value="${escapeHtml(category.name)}" ${category.name === row.categoryName ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}<option value="__new__" ${row.categoryName && !categories.some(category => category.name === row.categoryName) ? 'selected' : ''}>สร้างหมวด: ${escapeHtml(row.categoryName || '—')}</option></select></td><td><input data-field="stock" type="number" min="0" step="1" value="${Number(row.stock || 0)}"></td><td><button data-local-ocr-remove="${escapeHtml(row.id)}" type="button" class="mpa-button mpa-button-secondary">ลบ</button></td></tr>`).join('')}</tbody></table></div><p id="localOcrCommitStatus" class="mpa-muted" aria-live="polite">เมนูจะถูกบันทึกเป็นแบบร่างและยังไม่เปิดขาย</p><button id="localOcrCommit" type="button" class="mpa-button" ${ready.length === 0 || missingPrice ? 'disabled' : ''}>ยืนยันนำเข้า ${ready.length} รายการ</button></div>` : ''}`;
      const fileInput = host.querySelector('#localOcrFile');
      const run = host.querySelector('#localOcrRun');
      const status = host.querySelector('#localOcrStatus');
      if (fileInput) fileInput.onchange = () => { status.textContent = fileInput.files?.[0] ? `เลือก ${fileInput.files[0].name} แล้ว` : 'ยังไม่ได้เลือกภาพ'; };
      if (run) run.onclick = async () => {
        const file = fileInput?.files?.[0];
        if (!file) { status.textContent = 'กรุณาเลือกภาพก่อน'; return; }
        run.disabled = true; state.busy = true;
        try {
          status.textContent = 'กำลังเตรียม OCR ในอุปกรณ์…';
          const result = await recognize(file, (label, progress) => { status.textContent = `${label} ${Math.round(progress * 100)}%`; });
          state.drafts = result.drafts;
          state.sourceText = result.sourceText;
          status.textContent = `อ่านได้ ${result.drafts.length} รายการจากภาพ ${Math.ceil(result.bytes / 1024)} KB โปรดตรวจทานก่อนบันทึก`;
          render();
        } catch (error) { status.textContent = error?.message || 'ไม่สามารถอ่านรายการจากภาพได้'; }
        finally { state.busy = false; run.disabled = false; }
      };
      host.querySelectorAll('[data-local-ocr-row]').forEach(node => node.querySelectorAll('[data-field]').forEach(input => input.oninput = () => {
        const row = state.drafts.find(item => item.id === node.dataset.localOcrRow); if (!row) return;
        const field = input.dataset.field;
        row[field] = field === 'selected' ? input.checked : field === 'price' || field === 'stock' ? (input.value === '' ? null : Number(input.value)) : input.value;
        render();
      }));
      host.querySelectorAll('[data-local-ocr-remove]').forEach(button => button.onclick = () => { state.drafts = state.drafts.filter(row => row.id !== button.dataset.localOcrRemove); render(); });
      const add = host.querySelector('#localOcrAddRow');
      if (add) add.onclick = () => { state.drafts.push({ id: newKey(), name: '', price: null, categoryName: '', stock: 0, selected: true, needsReview: true, sourceLine: '' }); render(); };
      const commit = host.querySelector('#localOcrCommit');
      if (commit) commit.onclick = async () => {
        const rows = state.drafts.filter(row => row.selected).map(row => ({ name: String(row.name || '').trim(), price: Number(row.price), stock: Math.max(0, Number(row.stock || 0)), categoryName: String(row.categoryName || '').trim() }));
        if (rows.some(row => !row.name || !Number.isFinite(row.price) || row.price < 0)) { host.querySelector('#localOcrCommitStatus').textContent = 'กรุณากรอกชื่อและราคาที่ถูกต้องก่อนยืนยัน'; return; }
        if (!window.confirm(`ยืนยันนำเข้า ${rows.length} รายการเป็นแบบร่างหรือไม่? เมนูจะยังไม่เปิดขาย`)) return;
        commit.disabled = true;
        try { const result = await onCommit(rows); host.querySelector('#localOcrCommitStatus').textContent = result?.message || `นำเข้า ${rows.length} รายการแล้ว`; state.drafts = []; render(); }
        catch (error) { host.querySelector('#localOcrCommitStatus').textContent = error?.message || 'นำเข้ารายการไม่สำเร็จ'; commit.disabled = false; }
      };
    };
    render();
  }

  window.APServiceLocalMenuOCR = Object.freeze({ compressForOcr, parseMenuText, recognize, mount });
})();
