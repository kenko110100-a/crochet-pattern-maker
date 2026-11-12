'use strict';
/* UI shell: start screen, palette, side panel, pan/zoom, undo, autosave, export. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  let doc = null, sel = null, active = 0, L = null, undo = [], redo = [], rowErr = null;
  let sameSt = false, shift = false, space = false, drag = null;
  const view = { x: 0, y: 0, k: 2 };
  const cfg = Object.assign({ lang: I18N.detect(), sc: 'x', knit: 'jis' }, store.get('pm.cfg', {}));
  I18N.set(cfg.lang);
  const t = I18N.t;
  const brush = { mode: 'sym', s: 'p', color: Knit.PALETTE[3] };
  const svg = $('#svg');
  const isKnit = () => doc && doc.type === 'knit';
  const nm = d => d[cfg.lang] || d.en;
  const wn = n => t(doc.shape === 'round' ? 'roundN' : 'rowN', n);

  // ---------- crochet palette ----------
  const CPAL = [
    ['secBasic', ['ch', 'sl', 'sc', 'hdc', 'dc', 'tr', 'dtr']],
    ['secInc', [
      { k: 'inc', g: ['sc', 'sc'], ab: 'inc', en: 'Sc increase (2 sc in one stitch)', ja: 'こま編み2目編み入れる', zh: '短針加針（1針放2針）' },
      { k: 'inc3', g: ['sc', 'sc', 'sc'], ab: 'sc ×3', en: '3 sc in one stitch', ja: 'こま編み3目編み入れる', zh: '短針1針放3針' },
      { k: 'hinc', g: ['hdc', 'hdc'], ab: 'hdc ×2', en: '2 hdc in one stitch', ja: '中長編み2目編み入れる', zh: '中長針加針' },
      { k: 'dinc', g: ['dc', 'dc'], ab: 'dc ×2', en: '2 dc in one stitch', ja: '長編み2目編み入れる', zh: '長針加針' },
      { k: 'd3', g: ['dc', 'dc', 'dc'], ab: 'dc ×3', en: '3 dc in one stitch', ja: '長編み3目編み入れる', zh: '長針1針放3針' },
      { k: 'shell', g: ['dc', 'dc', 'dc', 'dc', 'dc'], ab: 'shell', en: '5-dc shell', ja: '長編み5目編み入れる（松編み）', zh: '貝殼針（長針5針）' },
      { k: 'vst', g: ['dc', 'ch', 'dc'], ab: 'V-st', en: 'V-stitch (dc, ch 1, dc)', ja: 'V字編み', zh: 'V字針' },
    ]],
    ['secDec', ['sc2tog', 'sc3tog', 'hdc2tog', 'dc2tog', 'dc3tog', 'tr2tog']],
    ['secTex', ['scblo', 'fpdc', 'bpdc', 'cl', 'puff', 'pc', 'picot']],
    ['secStruct', ['sk', 'tch', 'sch', 'join']],
  ];
  const PITEM = {};
  CPAL.forEach(([, items]) => items.forEach(it => {
    if (typeof it === 'string') {
      const d = Crochet.ST[it];
      PITEM[it] = { ...d, k: it, ab: it === 'tch' ? 'turn ch' : it === 'sch' ? 'ch = st' : (d.out || it), spec: it,
        ops: [it === 'tch' ? { t: it, n: 1 } : it === 'sch' ? { t: it, n: 3 } : { t: it }] };
    } else PITEM[it.k] = { ...it, spec: it.g, ops: [{ g: it.g.map(t => ({ t })) }] };
  }));

  function buildPalette() {
    let h = '<div id="palInfo"></div>';
    if (isKnit()) {
      h += `<div class="pal-head">${t('symbols')}</div><div class="pal-grid">`;
      const btn = k => `<button class="pal${brush.mode === 'sym' && brush.s === k ? ' on' : ''}" data-k="${k}">${Knit.preview(k, cfg.knit)}<span>${esc(Knit.SY[k].rs || t('noSt'))}</span></button>`;
      const keys = Object.keys(Knit.SY);
      h += keys.filter(k => !Knit.SY[k].n).map(btn).join('');
      h += `<button class="pal wide${brush.mode === 'erase' ? ' on' : ''}" data-k="erase"><span>${t('eraser')}</span></button></div>`;
      h += `<div class="pal-head">${t('cables')}</div><div class="pal-grid two">` + keys.filter(k => Knit.SY[k].n).map(btn).join('') + '</div>';
      h += `<div class="pal-head">${t('colours')}</div><div class="swatches">`;
      Knit.PALETTE.forEach(c => { h += `<button class="sw${brush.mode === 'color' && brush.color === c ? ' on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`; });
      h += `</div><div class="pal-row"><input type="color" id="customColor" value="${brush.color}"> ${t('customColour')}</div>`;
    } else {
      CPAL.forEach(([title, items]) => {
        h += `<div class="pal-head">${t(title)}</div><div class="pal-grid">`;
        items.forEach(it => {
          const p = PITEM[typeof it === 'string' ? it : it.k];
          h += `<button class="pal" data-k="${p.k}">${Crochet.preview(p.spec, { plus: cfg.sc === '+' })}<span>${esc(p.ab)}</span></button>`;
        });
        h += '</div>';
      });
      h += `<div class="pal-head">${t('modifier')}</div><div class="pal-grid"><button class="pal wide${sameSt ? ' on' : ''}" data-k="same"><span>${t(sameSt ? 'sameOn' : 'sameOff')}</span></button></div>`;
    }
    $('#palette').innerHTML = h;
    palInfo();
  }
  function palInfo(k) {
    const el = $('#palInfo'); if (!el) return;
    if (isKnit()) {
      const d = Knit.SY[k];
      el.innerHTML = d ? `<b>${esc(nm(d))}</b><small>${esc(d.rs ? t('rsws', d.rs, d.ws) : d.en)}</small>`
        : `<b>${t('paintGrid')}</b><small>${t('paintGridP')}</small>`;
    } else {
      const p = PITEM[k];
      el.innerHTML = p ? `<b>${esc(nm(p))}</b><small>${esc(p.ab)}${cfg.lang !== 'en' ? ' · ' + esc(p.en) : ''}</small>`
        : `<b>${t('addSt')}</b><small>${t('addStP')}</small>`;
    }
  }
  $('#palette').addEventListener('mouseover', e => { const b = e.target.closest('.pal'); palInfo(b && b.dataset.k); });
  $('#palette').addEventListener('click', e => {
    const sw = e.target.closest('.sw');
    if (sw) { brush.mode = 'color'; brush.color = sw.dataset.c; return buildPalette(); }
    const b = e.target.closest('.pal'); if (!b) return;
    const k = b.dataset.k;
    if (isKnit()) { if (k === 'erase') brush.mode = 'erase'; else { brush.mode = 'sym'; brush.s = k; } return buildPalette(); }
    if (k === 'same') { sameSt = !sameSt; return buildPalette(); }
    addOps(PITEM[k].ops);
  });
  $('#palette').addEventListener('input', e => {
    if (e.target.id === 'customColor') { brush.mode = 'color'; brush.color = e.target.value; document.querySelectorAll('.sw.on,.pal.on').forEach(x => x.classList.remove('on')); }
  });

  // ---------- state changes ----------
  function change(fn) {
    undo.push(JSON.stringify(doc)); if (undo.length > 100) undo.shift();
    redo = []; rowErr = null;
    fn(); refresh(); keepVisible();
  }
  function refresh() {
    draw(); buildSide(); hint();
    $('#btnUndo').disabled = !undo.length; $('#btnRedo').disabled = !redo.length;
    store.set('pm.doc', doc);
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(doc)); doc = JSON.parse(from.pop());
    sel = null; rowErr = null;
    if (!isKnit()) active = clamp(active, 0, doc.rows.length - 1);
    $('#title').value = doc.title; refresh();
  }

  // ---------- crochet editing ----------
  function addOps(ops) {
    const uses = ops.reduce((a, op) => a + Crochet.parOf(op), 0);
    change(() => {
      let row = doc.rows[active]; const R = L.rows[active], same = sameSt || shift;
      const atEnd = !(sel && sel.r === active) || sel.i === row.ops.length - 1;
      // a finished round rolls over to the next one automatically
      if (!same && uses && atEnd && active === doc.rows.length - 1 && row.ops.length && isFinite(R.pc) && R.used >= R.pc) {
        doc.rows.push({ ops: [] }); active++; sel = null; row = doc.rows[active];
      }
      const idx = sel && sel.r === active ? sel.i + 1 : row.ops.length;
      const one = ops.length === 1 && Crochet.isPlain(ops[0]) ? ops[0] : null, p = row.ops[idx - 1];
      if (same && one && p && (p.g || (Crochet.isPlain(p) && p.t !== 'ch' && p.t !== 'picot'))) {
        if (p.g) p.g.push(clone(one)); else row.ops[idx - 1] = { g: [p, clone(one)] };
        sel = { r: active, i: idx - 1 }; return;
      }
      row.ops.splice(idx, 0, ...clone(ops));
      sel = { r: active, i: idx + ops.length - 1 };
    });
  }
  function delSel() {
    const row = doc.rows[active];
    if (!row.ops.length && doc.rows.length < 2) return;
    change(() => {
      if (sel && sel.r === active && row.ops[sel.i]) {
        const op = row.ops[sel.i];
        if (op.g && sel.j != null) { op.g.splice(sel.j, 1); if (op.g.length === 1) row.ops[sel.i] = op.g[0]; sel = { r: active, i: sel.i }; }
        else { row.ops.splice(sel.i, 1); sel = sel.i > 0 ? { r: active, i: sel.i - 1 } : null; }
      } else if (row.ops.length) row.ops.pop();
      else { doc.rows.splice(active, 1); active = Math.max(0, active - 1); sel = null; }
    });
  }
  function newRow() {
    if (!doc.rows[doc.rows.length - 1].ops.length) { active = doc.rows.length - 1; sel = null; return refresh(); }
    change(() => { doc.rows.push({ ops: [] }); active = doc.rows.length - 1; sel = null; });
  }
  function repeatToEnd() {
    const row = doc.rows[active], pc = L.rows[active].pc;
    let a = 0, b = row.ops.length;
    while (a < b && ['tch', 'sch'].includes(row.ops[a].t)) a++;
    while (b > a && row.ops[b - 1].t === 'join') b--;
    const head = row.ops.slice(0, a), unit = row.ops.slice(a, b), tail = row.ops.slice(b);
    const sum = o => o.reduce((x, op) => x + Crochet.parOf(op), 0), u = sum(unit);
    if (!u || !isFinite(pc)) return;
    const k = Math.floor((pc - sum(head) - sum(tail)) / u);
    if (k < 1) return;
    change(() => { row.ops = [...head, ...Array.from({ length: k }, () => clone(unit)).flat(), ...tail]; sel = null; });
  }

  // ---------- side panel ----------
  function buildSide() {
    if (isKnit()) return buildKnitSide();
    const round = doc.shape === 'round', total = L.rows.reduce((a, R) => a + R.count, 0);
    let h = `<div class="side-head"><h2>${t(round ? 'rounds' : 'rows')}</h2><span class="help">${t('nStitches', total)}</span></div>`;
    h += round ? `<div class="found">${t('startRing')}</div>`
      : `<div class="found">${t('foundChain')} <input type="number" id="chainN" min="1" max="300" value="${doc.chain}"></div>`;
    h += '<div id="rows">';
    doc.rows.forEach((row, r) => {
      const R = L.rows[r], err = rowErr && rowErr.r === r ? rowErr : null;
      let st = t('nSts', R.count), cls = '';
      if (isFinite(R.pc) && row.ops.length) {
        if (R.used === R.pc) { st = `${R.count} ✓`; cls = 'ok'; }
        else if (R.used < R.pc) st = t('nLeft', R.pc - R.used);
        else { st = t('nOver', R.used - R.pc); cls = 'bad'; }
      }
      h += `<div class="row${r === active ? ' act' : ''}" data-r="${r}"><div class="row-main">
        <span class="num" style="color:${R.color}">${r + 1}</span>
        <span class="dot" style="background:${R.color}" title="${t('colour')}"><input type="color" value="${R.color}" data-act="rowcolor"></span>
        <input class="txt" value="${esc(err ? err.text : Crochet.toText(row.ops))}" placeholder="${t('placeholder')}" spellcheck="false" autocomplete="off">
        <span class="cnt ${cls}">${st}</span></div>`;
      if (err) h += `<div class="row-err">${esc(err.msg)}</div>`;
      if (r === active) {
        const canRep = isFinite(R.pc) && row.ops.length && R.used < R.pc;
        h += `<div class="row-tools">
          <button class="btn small" data-act="repeat" ${canRep ? '' : 'disabled'} title="${t('repeatTip')}">${t('repeat')}</button>
          <button class="btn small" data-act="clear" ${row.ops.length ? '' : 'disabled'}>${t('clear')}</button>
          <button class="btn small" data-act="delrow" ${doc.rows.length > 1 ? '' : 'disabled'}>${t('del')}</button></div>`;
      }
      h += '</div>';
    });
    h += `</div><button class="btn" id="addRow">${t(round ? 'newRound' : 'newRow')} <span class="help">(Enter)</span></button>`;

    const op = sel && doc.rows[sel.r] && doc.rows[sel.r].ops[sel.i];
    if (op) {
      const m = op.g && sel.j != null ? op.g[sel.j] : op;
      const label = m.g ? t('nInOne', m.g.length) : nm(Crochet.ST[m.t]);
      const col = (m.g ? m.g[0].c : m.c) || L.rows[sel.r].color;
      h += `<div class="panel"><h3>${t('selected')}</h3><div class="line"><b>${esc(label)}</b></div>
        <div class="line"><input type="color" value="${col}" data-act="stcolor"> ${t('colour')}
        <span class="grow"></span><button class="btn small" data-act="delst">${t('del')}</button></div>
        <div class="help">${t('afterSel')}</div></div>`;
    }
    if (round) h += `<div class="panel"><label class="line"><input type="checkbox" data-act="guides" ${doc.guides !== false ? 'checked' : ''}> ${t('guides')}</label></div>`;
    const ex = [['sc 6', 'h1'], ['inc', 'h2'], ['(sc 2, inc) x6', 'h3'], ['(sc, inc) x', 'h4'], ['[dc 2, ch 2, dc 2]', 'h5'],
      ['ch 3', 'h6'], ['sk 2', 'h7'], ['sch 3', 'h8'], ['tch 1', 'h9'], ['join', 'h10']];
    h += `<div class="panel"><h3>${t('typing')}</h3><div class="help">${t('typingIntro')}<br>`
      + ex.map(([code, k]) => `<code>${code}</code> ${t(k)}`).join('<br>') + `<br><br>${t('abbrNote')}</div></div>`;
    $('#side').innerHTML = h;
    const act = $('#side .row.act'); if (act) act.scrollIntoView({ block: 'nearest' });
  }
  function buildKnitSide() {
    $('#side').innerHTML = `<div class="panel" style="border-top:0;margin-top:0"><h3>${t('chartSize')}</h3>
      <div class="line"><input type="number" id="kw" min="1" max="120" value="${doc.w}"> ${t('stsX')} <input type="number" id="kh" min="1" max="200" value="${doc.h}"> ${t('rowsUnit')}</div>
      <div class="line"><select id="kflat"><option value="1" ${doc.flat ? 'selected' : ''}>${t('flat')}</option><option value="0" ${doc.flat ? '' : 'selected'}>${t('inRound')}</option></select></div>
      <div class="help">${t('knitHelp')}</div></div>
      <div class="panel"><h3>${t('written')}</h3><pre class="written">${esc(Knit.written(doc).join('\n'))}</pre></div>`;
  }
  $('#side').addEventListener('click', e => {
    if (isKnit()) return;
    const rowEl = e.target.closest('.row'), act = e.target.closest('[data-act]');
    if (e.target.id === 'addRow' || e.target.closest('#addRow')) return newRow();
    if (act && act.tagName === 'BUTTON') {
      const a = act.dataset.act;
      if (a === 'repeat') return repeatToEnd();
      if (a === 'clear') return change(() => { doc.rows[active].ops = []; sel = null; });
      if (a === 'delrow') return change(() => { doc.rows.splice(active, 1); active = Math.max(0, active - 1); sel = null; });
      if (a === 'delst') return delSel();
    }
    if (rowEl && !e.target.matches('input')) { active = +rowEl.dataset.r; sel = null; refresh(); }
  });
  $('#side').addEventListener('focusin', e => {
    const rowEl = e.target.closest('.row');
    if (rowEl && e.target.classList.contains('txt') && active !== +rowEl.dataset.r) {
      active = +rowEl.dataset.r; sel = null;
      document.querySelectorAll('#rows .row').forEach(x => x.classList.toggle('act', x === rowEl));
      draw(); hint();
    }
  });
  $('#side').addEventListener('change', e => {
    const t = e.target, rowEl = t.closest('.row');
    if (isKnit()) {
      if (t.id === 'kw' || t.id === 'kh') return change(() => Knit.resize(doc, +$('#kw').value || doc.w, +$('#kh').value || doc.h));
      if (t.id === 'kflat') return change(() => { doc.flat = t.value === '1'; });
      return;
    }
    if (t.id === 'chainN') return change(() => { doc.chain = clamp(+t.value || 1, 1, 300); });
    if (t.dataset.act === 'guides') return change(() => { doc.guides = t.checked; });
    if (t.dataset.act === 'stcolor') return change(() => {
      const op = doc.rows[sel.r].ops[sel.i];
      (op.g ? (sel.j != null ? [op.g[sel.j]] : op.g) : [op]).forEach(m => { m.c = t.value; });
    });
    if (!rowEl) return;
    const r = +rowEl.dataset.r;
    if (t.dataset.act === 'rowcolor') return change(() => { doc.rows[r].color = t.value; });
    if (t.classList.contains('txt')) {
      try {
        const ops = Crochet.parse(t.value, L.rows[r].pc);
        change(() => { doc.rows[r].ops = ops; active = r; sel = null; });
      } catch (err) { rowErr = { r, msg: err.message, text: t.value }; active = r; refresh(); }
    }
  });

  function hint() {
    let h;
    if (isKnit()) h = t('hKnit');
    else {
      const R = L.rows[active], n = active + 1;
      if (!doc.rows[active].ops.length) h = t('hEmpty', wn(n));
      else if (!isFinite(R.pc)) h = t('hRing', wn(n), R.count, wn(n + 1));
      else if (R.used === R.pc) h = t('hDone', wn(n), R.count, wn(n + 1));
      else if (R.used < R.pc) h = t('hPart', wn(n), R.used, R.pc);
      else h = t('hOver', wn(n), R.used - R.pc, wn(n - 1));
    }
    $('#hint').innerHTML = h;
  }

  // ---------- drawing, pan & zoom ----------
  function draw() {
    if (isKnit()) { const R = Knit.render(doc, { style: cfg.knit }); $('#chart').innerHTML = R.svg; L = { bounds: R.bounds }; }
    else { L = Crochet.layout(doc); $('#chart').innerHTML = Crochet.render(doc, L, { sel, active, plus: cfg.sc === '+', lang: cfg.lang }); }
    applyView();
  }
  const applyView = () => $('#view').setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  function fit() {
    const r = svg.getBoundingClientRect(), b = L.bounds;
    if (!r.width) return;
    view.k = Math.min(r.width / b.w, (r.height - 40) / b.h, isKnit() ? 1.8 : 3.4);
    view.x = r.width / 2 - (b.x + b.w / 2) * view.k; view.y = (r.height - 40) / 2 - (b.y + b.h / 2) * view.k;
    applyView();
  }
  function keepVisible() { // re-fit when the chart grows past the edge of the stage
    if (isKnit()) return;
    const r = svg.getBoundingClientRect(), b = L.bounds, m = 8 * view.k;
    if (b.x * view.k + view.x < -m || b.y * view.k + view.y < -m || (b.x + b.w) * view.k + view.x > r.width + m || (b.y + b.h) * view.k + view.y > r.height + m) fit();
  }
  function zoomAt(cx, cy, factor) {
    const r = svg.getBoundingClientRect(), k = clamp(view.k * factor, .2, 12), px = cx - r.left, py = cy - r.top;
    view.x = px - (px - view.x) * k / view.k; view.y = py - (py - view.y) * k / view.k; view.k = k; applyView();
  }
  function paintAt(e) {
    const r = svg.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left - view.x) / view.k / Knit.S), row = doc.h - 1 - Math.floor((e.clientY - r.top - view.y) / view.k / Knit.S);
    const wide = brush.mode === 'sym' && Knit.SY[brush.s].w > 1;
    if (wide && drag.last) return; // cables are stamped once per click, not smeared
    const from = drag.last || [row, c], n = Math.max(Math.abs(row - from[0]), Math.abs(c - from[1]), 1);
    let changed = false; // fill every cell between two pointer samples so fast drags leave no gaps
    for (let i = 0; i <= n; i++) changed = Knit.paint(doc, Math.round(from[0] + (row - from[0]) * i / n), Math.round(from[1] + (c - from[1]) * i / n), brush) || changed;
    drag.last = [row, c];
    if (changed) { drag.changed = true; draw(); }
  }
  svg.addEventListener('pointerdown', e => {
    if (!doc || e.button === 2) return;
    svg.setPointerCapture(e.pointerId);
    if (isKnit() && !space && e.button === 0) { undo.push(JSON.stringify(doc)); drag = { paint: true, changed: false }; paintAt(e); }
    else { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, target: e.target }; }
  });
  svg.addEventListener('pointermove', e => {
    if (!drag) return;
    if (drag.paint) return paintAt(e);
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true; svg.classList.add('panning');
    view.x = drag.vx + dx; view.y = drag.vy + dy; applyView();
  });
  const endDrag = () => {
    const d = drag; drag = null; svg.classList.remove('panning');
    if (!d) return;
    if (d.paint) { if (d.changed) { redo = []; refresh(); } else undo.pop(); return; }
    if (d.moved || isKnit()) return;
    const st = d.target.closest && d.target.closest('.st');
    if (st) { const [r, i, j] = st.dataset.p.split(',').map(Number); active = r; sel = { r, i, j: Number.isNaN(j) ? null : j }; }
    else sel = null;
    refresh();
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (isKnit() && !e.ctrlKey && !e.metaKey) { view.x -= e.deltaX; view.y -= e.deltaY; applyView(); }
    else zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0022)));
  }, { passive: false });
  const center = () => { const r = svg.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  $('#btnZoomIn').onclick = () => zoomAt(...center(), 1.25);
  $('#btnZoomOut').onclick = () => zoomAt(...center(), .8);
  $('#btnFit').onclick = fit;
  $('#btnUndo').onclick = () => restore(undo, redo);
  $('#btnRedo').onclick = () => restore(redo, undo);

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    if (e.key === 'Shift') shift = true;
    const field = e.target.matches && e.target.matches('input, select, textarea');
    if (field) { if (e.key === 'Enter' && e.target.classList.contains('txt')) e.target.blur(); return; }
    if (!doc || !$('#start').hidden) return;
    if (e.code === 'Space') { space = true; svg.classList.remove('paint'); e.preventDefault(); return; }
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); return e.shiftKey ? restore(redo, undo) : restore(undo, redo); }
    if (mod && key === 'y') { e.preventDefault(); return restore(redo, undo); }
    if (isKnit() || mod) return;
    const row = doc.rows[active];
    if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); delSel(); }
    else if (e.key === 'Enter') { e.preventDefault(); newRow(); }
    else if (e.key === 'Escape') { sel = null; refresh(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      if (!row.ops.length) return;
      const cur = sel && sel.r === active ? sel.i : row.ops.length - 1;
      sel = { r: active, i: clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, row.ops.length - 1) }; refresh();
    }
  });
  document.addEventListener('keyup', e => {
    if (e.key === 'Shift') shift = false;
    if (e.code === 'Space') { space = false; svg.classList.toggle('paint', !!isKnit()); }
  });
  window.addEventListener('blur', () => { shift = false; space = false; });

  // ---------- documents ----------
  function openDoc(d) {
    doc = d; sel = null; undo = []; redo = []; rowErr = null;
    active = isKnit() ? 0 : doc.rows.length - 1;
    $('#start').hidden = true;
    $('#title').value = doc.title;
    svg.classList.toggle('paint', !!isKnit());
    chrome(); draw(); fit(); refresh();
  }
  /** Everything whose text depends on the language: static labels, badge, style menu, palette. */
  function chrome() {
    I18N.apply();
    $('#selLang').value = $('#selLang2').value = cfg.lang;
    const saved = store.get('pm.doc', null), b = $('#btnContinue');
    b.hidden = !valid(saved);
    if (!b.hidden) b.textContent = t('continue', saved.title);
    if (!doc) return;
    $('#badge').textContent = t(isKnit() ? 'mKnit' : doc.shape === 'round' ? 'mRound' : 'mRows');
    $('#selStyle').innerHTML = isKnit()
      ? `<option value="jis">${t('styleJis')}</option><option value="west">${t('styleWest')}</option>`
      : `<option value="x">${t('scX')}</option><option value="+">${t('scPlus')}</option>`;
    $('#selStyle').value = isKnit() ? cfg.knit : cfg.sc;
    buildPalette();
  }
  function valid(d) {
    if (!d || typeof d !== 'object') return false;
    if (d.type === 'knit') return Array.isArray(d.cells) && d.cells.length === d.h && d.cells.every(r => Array.isArray(r) && r.length === d.w && r.every(c => c && Knit.SY[c.s] || c.s === '_'));
    if (d.type === 'crochet') return Array.isArray(d.rows) && d.rows.length > 0 && d.rows.every(r => Array.isArray(r.ops) && r.ops.every(op => (op.g || [op]).every(m => Crochet.ST[m.t])));
    return false;
  }
  document.querySelectorAll('.modes form').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const m = form.dataset.mode, v = n => +form.elements[n].value;
    if (m === 'knit') openDoc(Knit.newDoc(clamp(v('w') || 20, 1, 120), clamp(v('h') || 20, 1, 200), form.elements.flat.value === '1'));
    else if (m === 'round') openDoc({ type: 'crochet', shape: 'round', title: t('untitledC'), guides: true,
      rows: [{ ops: Array.from({ length: clamp(v('n') || 0, 0, 60) }, () => ({ t: 'sc' })) }] });
    else openDoc({ type: 'crochet', shape: 'rows', title: t('untitledC'), chain: clamp(v('n') || 16, 1, 200), rows: [{ ops: [] }] });
  }));
  function showStart() {
    chrome();
    $('#start').hidden = false;
  }
  $('#btnContinue').onclick = () => openDoc(store.get('pm.doc', null));
  $('#btnHome').onclick = showStart;
  $('#title').addEventListener('change', e => change(() => { doc.title = e.target.value.trim() || t('untitled'); }));
  $('#selLang').onchange = $('#selLang2').onchange = e => {
    cfg.lang = e.target.value; store.set('pm.cfg', cfg); I18N.set(cfg.lang);
    if (rowErr) { try { Crochet.parse(rowErr.text, L.rows[rowErr.r].pc); } catch (err) { rowErr.msg = err.message; } } // re-word a pending error
    chrome(); if (doc) refresh();
  };
  $('#selStyle').onchange = e => { if (isKnit()) cfg.knit = e.target.value; else cfg.sc = e.target.value; store.set('pm.cfg', cfg); buildPalette(); refresh(); };

  // ---------- save / open / export ----------
  const fileName = ext => (doc.title.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'pattern') + '.' + ext;
  function download(name, blob) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  $('#btnSave').onclick = () => download(fileName('json'), new Blob([JSON.stringify({ app: 'pattern-maker', v: 1, doc }, null, 1)], { type: 'application/json' }));
  $('#btnOpen').onclick = $('#btnOpen2').onclick = () => $('#fileOpen').click();
  $('#fileOpen').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try { const d = JSON.parse(await file.text()).doc; if (!valid(d)) throw 0; openDoc(d); }
    catch { alert(t('badFile')); }
  });
  function chartSVG(sized) {
    let inner, b;
    if (isKnit()) { const R = Knit.render(doc, { style: cfg.knit }); inner = R.svg; b = R.bounds; }
    else { const l = Crochet.layout(doc); inner = Crochet.render(doc, l, { exporting: true, plus: cfg.sc === '+', lang: cfg.lang }); b = l.bounds; }
    const size = sized ? ` width="${Math.round(b.w * 2)}" height="${Math.round(b.h * 2)}"` : '';
    return { b, svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"${size}><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#fff"/>${inner}</svg>` };
  }
  const writtenLines = () => isKnit() ? Knit.written(doc) : Crochet.written(doc, L);
  function keyHTML() {
    if (isKnit()) return Knit.usedTypes(doc).filter(k => k !== '_').map(k => { const d = Knit.SY[k]; return `<div>${Knit.preview(k, cfg.knit)}<span><b>${esc(d.rs || '—')}</b> ${esc(nm(d))}</span></div>`; }).join('');
    return Crochet.usedTypes(doc).map(t => { const d = Crochet.ST[t]; return `<div>${Crochet.preview(t, { plus: cfg.sc === '+' })}<span><b>${esc(d.out || t)}</b> ${esc(nm(d))}</span></div>`; }).join('');
  }
  $('#exportMenu').addEventListener('click', e => {
    const x = e.target.dataset.x; if (!x) return;
    $('#exportMenu').open = false;
    if (x === 'svg') download(fileName('svg'), new Blob([chartSVG(true).svg], { type: 'image/svg+xml' }));
    else if (x === 'txt') download(fileName('txt'), new Blob([doc.title + '\n\n' + writtenLines().join('\n') + '\n'], { type: 'text/plain' }));
    else if (x === 'png') {
      const { b, svg: s } = chartSVG(true), img = new Image();
      const scale = Math.min(4, 6000 / Math.max(b.w, b.h));
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = Math.round(b.w * scale); c.height = Math.round(b.h * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(blob => download(fileName('png'), blob), 'image/png');
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
    } else if (x === 'print') {
      $('#printSheet').innerHTML = `<h1>${esc(doc.title)}</h1><p class="sub">${esc($('#badge').textContent)}</p>
        <div class="chart">${chartSVG(false).svg}</div><h2>${t('key')}</h2><div class="key">${keyHTML()}</div>
        <h2>${t('written')}</h2><pre>${esc(writtenLines().join('\n'))}</pre>`;
      window.print();
    }
  });
  document.addEventListener('click', e => { if (!e.target.closest('#exportMenu')) $('#exportMenu').open = false; });

  // ---------- start-screen icons, drawn with the real engines ----------
  function icon(id, d) {
    const l = Crochet.layout(d), b = l.bounds;
    const el = $(id); el.setAttribute('viewBox', `${b.x + 14} ${b.y + 14} ${b.w - 28} ${b.h - 28}`);
    el.innerHTML = Crochet.render(d, l, { exporting: true });
  }
  icon('#icoRound', { shape: 'round', guides: false, rows: [{ ops: Crochet.parse('sc 6', Infinity) }, { ops: Crochet.parse('inc 6', 6) }, { ops: Crochet.parse('(dc, ch) x12', 12) }] });
  icon('#icoRows', { shape: 'rows', chain: 7, rows: [{ ops: Crochet.parse('tch 1, sc 7', 7) }, { ops: Crochet.parse('sch 3, dc 6', 7) }, { ops: Crochet.parse('tch 1, sc 7', 7) }] });
  (() => {
    const d = Knit.newDoc(5, 5, true);
    [[0, 1, 'yo'], [0, 2, 'k2tog'], [1, 3, 'p'], [2, 1, 'p'], [2, 3, 'ssk'], [2, 4, 'yo'], [3, 0, 'c1l'], [4, 2, 'yo'], [4, 3, 'cdd']].forEach(([r, c, s]) => Knit.paint(d, r, c, { mode: 'sym', s }));
    [[1, 0], [1, 1], [3, 3], [3, 4]].forEach(([r, c]) => Knit.paint(d, r, c, { mode: 'color', color: '#e8b4a0' }));
    const el = $('#icoKnit'); el.setAttribute('viewBox', `-4 -4 ${5 * Knit.S + 8} ${5 * Knit.S + 8}`);
    el.innerHTML = Knit.render(d, {}).svg.replace(/<text[^>]*>[^<]*<\/text>/g, '');
  })();

  showStart();
  window.addEventListener('resize', () => { if (doc) applyView(); });
})();
