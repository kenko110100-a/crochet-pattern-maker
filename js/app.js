'use strict';
/* UI shell: front page and chart library, stitch bar, side panel, pan/zoom, undo, export. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const store = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  let doc = null, sel = null, active = 0, L = null, undo = [], redo = [], rowErr = null;
  let sameSt = false, shift = false, space = false, drag = null, adjSnap = null;
  let clip = store.get('pm.clip', null);
  const view = { x: 0, y: 0, k: 2 };
  const cfg = Object.assign({ lang: I18N.detect(), sc: 'x', knit: 'jis', more: false }, store.get('pm.cfg', {}));
  I18N.set(cfg.lang);
  const t = I18N.t;
  const brush = { mode: 'sym', s: 'p', color: Knit.PALETTE[3] };
  const svg = $('#svg');
  const isKnit = () => doc && doc.type === 'knit';
  const nm = d => d[cfg.lang] || d.en;
  const wn = n => t(doc.shape === 'rows' ? 'rowN' : 'roundN', n);
  const kindKey = d => d.type === 'knit' ? 'mKnit' : d.shape === 'round' ? 'mRound' : d.shape === 'oval' ? 'mOval' : 'mRows';

  // ---------- chart library: every chart is kept in this browser until it is deleted ----------
  const lib = {
    index: () => store.get('pm.index', []),
    save(d) {
      if (!d.id) d.id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      store.set('pm.d.' + d.id, d);
      store.set('pm.index', [{ id: d.id, title: d.title, kind: kindKey(d), at: Date.now() }, ...lib.index().filter(e => e.id !== d.id)]);
    },
    load: id => store.get('pm.d.' + id, null),
    remove(id) { store.del('pm.d.' + id); store.set('pm.index', lib.index().filter(e => e.id !== id)); },
  };

  // ---------- crochet stitch bar ----------
  const CPAL = [
    ['secBasic', ['ch', 'sc', 'sctch', 'hdc', 'dc', 'tr', 'dtr', 'sl', 'join', 'sk'], true],
    ['secTurn', ['tch1', 'sch2', 'sch3', 'sch4'], true],
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
  ];
  const SPECIAL = {
    sctch: { ab: 'tch+sc', nk: 'pSctch', ops: [{ t: 'tch', n: 1 }, { t: 'sc' }] },
    tch1: { ab: 'tch 1', nk: 'pTch1', ops: [{ t: 'tch', n: 1 }] },
    sch2: { ab: 'sch 2', nk: 'pSch2', ops: [{ t: 'sch', n: 2 }] },
    sch3: { ab: 'sch 3', nk: 'pSch3', ops: [{ t: 'sch', n: 3 }] },
    sch4: { ab: 'sch 4', nk: 'pSch4', ops: [{ t: 'sch', n: 4 }] },
    sl: { ab: 'sl st', nk: 'pSl', ops: [{ t: 'sl' }] },
    join: { ab: 'join', nk: 'pJoin', ops: [{ t: 'join' }] },
  };
  const PITEM = {};
  CPAL.forEach(([, items]) => items.forEach(it => {
    if (typeof it !== 'string') PITEM[it.k] = { ...it, spec: it.g, ops: [{ g: it.g.map(x => ({ t: x })) }] };
    else if (SPECIAL[it]) PITEM[it] = { k: it, spec: it, ...SPECIAL[it] };
    else { const d = Crochet.ST[it]; PITEM[it] = { ...d, k: it, ab: d.out || it, spec: it, ops: [{ t: it }] }; }
  }));
  const pname = p => p.nk ? t(p.nk) : nm(p);

  function buildPalette() {
    const grp = (title, body) => `<div class="pg"><div class="pg-h">${title}</div><div class="pg-b">${body}</div></div>`;
    let h = '<div id="palInfo"></div>';
    if (isKnit()) {
      const btn = k => `<button class="pal${Knit.SY[k].n ? ' cable' : ''}${brush.mode === 'sym' && brush.s === k ? ' on' : ''}" data-k="${k}">${Knit.preview(k, cfg.knit)}<span>${esc(Knit.SY[k].rs || t('noSt'))}</span></button>`;
      const keys = Object.keys(Knit.SY);
      h += grp(t('symbols'), keys.filter(k => !Knit.SY[k].n).map(btn).join('')
        + `<button class="pal text${brush.mode === 'erase' ? ' on' : ''}" data-k="erase"><span>${t('eraser')}</span></button>`);
      h += grp(t('cables'), keys.filter(k => Knit.SY[k].n).map(btn).join(''));
      h += grp(t('colours'), Knit.PALETTE.map(c => `<button class="sw${brush.mode === 'color' && brush.color === c ? ' on' : ''}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join('')
        + `<input type="color" id="customColor" value="${brush.color}" title="${t('customColour')}">`);
    } else {
      CPAL.forEach(([title, items, always]) => {
        if (!always && !cfg.more) return;
        h += grp(t(title), items.map(it => {
          const p = PITEM[typeof it === 'string' ? it : it.k];
          return `<button class="pal" data-k="${p.k}" title="${esc(pname(p))}">${Crochet.preview(p.spec, { plus: cfg.sc === '+' })}<span>${esc(p.ab)}</span></button>`;
        }).join(''));
      });
      h += grp(t('modifier'), `<button class="pal text${sameSt ? ' on' : ''}" data-k="same"><span>${t(sameSt ? 'sameOn' : 'sameOff')}</span></button>`
        + `<button class="pal text" data-k="more"><span>${t(cfg.more ? 'less' : 'more')}</span></button>`);
    }
    $('#palette').innerHTML = h;
    palInfo();
  }
  function palInfo(k) {
    const el = $('#palInfo'); if (!el) return;
    if (isKnit()) {
      const d = Knit.SY[k];
      el.innerHTML = d ? `<b>${esc(nm(d))}</b><small>${esc(d.rs ? t('rsws', d.rs, d.ws) : d.en)}</small>` : `<b>${t('paintGrid')}</b><small>${t('paintGridP')}</small>`;
    } else {
      const p = PITEM[k];
      el.innerHTML = p ? `<b>${esc(pname(p))}</b><small>${esc(p.ab)}</small>` : `<b>${t('addSt')}</b><small>${t('addStP')}</small>`;
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
    if (k === 'more') { cfg.more = !cfg.more; store.set('pm.cfg', cfg); buildPalette(); return fit(); }
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
    lib.save(doc);
  }
  function restore(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(doc)); doc = JSON.parse(from.pop());
    sel = null; rowErr = null;
    if (!isKnit()) active = clamp(active, 0, doc.rows.length - 1);
    $('#title').value = doc.title; refresh();
  }

  // ---------- crochet editing ----------
  const lo = () => Math.min(sel.i, sel.i2 ?? sel.i), hi = () => Math.max(sel.i, sel.i2 ?? sel.i);
  const selOps = () => sel && doc.rows[sel.r] ? doc.rows[sel.r].ops.slice(lo(), hi() + 1) : [];
  /** The individual stitches the selection covers (group members are listed separately). */
  function targets() {
    const ops = selOps();
    if (ops.length === 1 && ops[0].g && sel.j != null && ops[0].g[sel.j]) return [ops[0].g[sel.j]];
    return ops.flatMap(op => op.g || [op]);
  }
  function addOps(ops, plain) {
    const uses = ops.reduce((a, op) => a + Crochet.parOf(op), 0), starts = !ops[0].g && (ops[0].t === 'tch' || ops[0].t === 'sch');
    change(() => {
      let row = doc.rows[active]; const R = L.rows[active], same = !plain && (sameSt || shift);
      const atEnd = !(sel && sel.r === active) || hi() === row.ops.length - 1;
      // a finished round rolls over to the next one automatically
      if (!same && (uses || starts) && atEnd && active === doc.rows.length - 1 && row.ops.length && isFinite(R.pc) && R.used >= R.pc) {
        doc.rows.push({ ops: [] }); active++; sel = null; row = doc.rows[active];
      }
      const idx = sel && sel.r === active ? hi() + 1 : row.ops.length;
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
        if (op.g && sel.j != null && sel.i2 == null) { op.g.splice(sel.j, 1); if (op.g.length === 1) row.ops[sel.i] = op.g[0]; sel = { r: active, i: sel.i }; }
        else { const a = lo(); row.ops.splice(a, hi() - a + 1); sel = a > 0 ? { r: active, i: a - 1 } : null; }
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
  function copySel() { const ops = selOps(); if (ops.length) { clip = clone(ops); store.set('pm.clip', clip); buildSide(); } }
  function pasteClip() { if (clip && clip.length && !isKnit()) addOps(clip, true); }

  // ---------- side panel ----------
  function buildSide() {
    if (isKnit()) return buildKnitSide();
    const flat = doc.shape === 'rows', total = L.rows.reduce((a, R) => a + R.count, 0);
    let h = `<div class="side-head"><h2>${t(flat ? 'rows' : 'rounds')}</h2><span class="help">${t('nStitches', total)}</span></div>`;
    h += doc.shape === 'round' ? `<div class="found">${t('startRing')}</div>`
      : `<div class="found">${t('foundChain')} <input type="number" id="chainN" min="${flat ? 1 : 3}" max="300" value="${doc.chain}"></div>`;
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
          <button class="btn small" data-act="duprow" ${row.ops.length ? '' : 'disabled'}>${t('dupRow')}</button>
          <button class="btn small" data-act="clear" ${row.ops.length ? '' : 'disabled'}>${t('clear')}</button>
          <button class="btn small" data-act="delrow" ${doc.rows.length > 1 ? '' : 'disabled'}>${t('del')}</button>
          <label class="chk"><input type="checkbox" data-act="arc" ${row.arc ? 'checked' : ''}> ${t('arcs')}</label></div>`;
      }
      h += '</div>';
    });
    h += `</div><button class="btn" id="addRow">${t(flat ? 'newRow' : 'newRound')} <span class="help">(Enter)</span></button>`;

    const tg = sel ? targets() : [];
    if (tg.length) {
      const n = hi() - lo() + 1, m = tg[0], a = m.adj || {};
      const label = n > 1 ? t('nSelected', tg.length) : tg.length > 1 ? t('nInOne', tg.length) : (m.t === 'sch' || m.t === 'tch') ? `${nm(Crochet.ST[m.t])} · ${m.n} ch` : nm(Crochet.ST[m.t]);
      const sl = (k, min, max, v, unit) => `<div class="line adj"><span>${t({ a: 'tilt', l: 'length', x: 'shiftX', y: 'shiftY' }[k])}</span>
        <input type="range" data-adj="${k}" min="${min}" max="${max}" value="${v}"><output>${v}${unit}</output></div>`;
      h += `<div class="panel"><h3>${t('selected')}</h3><div class="line"><b>${esc(label)}</b></div>
        <div class="line"><input type="color" value="${m.c || L.rows[sel.r].color}" data-act="stcolor"> ${t('colour')}<span class="grow"></span>
          <button class="btn small" data-act="copy">${t('copy')}</button>
          <button class="btn small" data-act="paste" ${clip ? '' : 'disabled'}>${t('paste')}</button>
          <button class="btn small" data-act="delst">${t('del')}</button></div>
        <div class="help">${t('afterSel')} ${t('rangeTip')}</div>
        <h3 class="sub">${t('adjust')} <button class="btn small" data-act="resetadj" ${tg.some(x => x.adj) ? '' : 'disabled'}>${t('reset')}</button></h3>
        ${sl('a', -75, 75, a.a || 0, '°')}${sl('l', 40, 250, Math.round((a.l || 1) * 100), '%')}${sl('x', -30, 30, a.x || 0, '')}${sl('y', -30, 30, a.y || 0, '')}</div>`;
    } else if (clip) h += `<div class="panel"><div class="line"><button class="btn small" data-act="paste">${t('paste')}</button><span class="help">${esc(Crochet.toText(clip))}</span></div></div>`;
    h += `<div class="panel"><label class="line"><input type="checkbox" data-act="guides" ${doc.guides !== false ? 'checked' : ''}> ${t(flat ? 'guidesRow' : 'guides')}</label></div>`;
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
    if (e.target.closest('#addRow')) return newRow();
    if (act && act.tagName === 'BUTTON') {
      const a = act.dataset.act;
      if (a === 'repeat') return repeatToEnd();
      if (a === 'duprow') return change(() => { doc.rows.splice(active + 1, 0, clone(doc.rows[active])); active++; sel = null; });
      if (a === 'clear') return change(() => { doc.rows[active].ops = []; sel = null; });
      if (a === 'delrow') return change(() => { doc.rows.splice(active, 1); active = Math.max(0, active - 1); sel = null; });
      if (a === 'delst') return delSel();
      if (a === 'copy') return copySel();
      if (a === 'paste') return pasteClip();
      if (a === 'resetadj') return change(() => targets().forEach(m => { delete m.adj; }));
    }
    if (rowEl && !e.target.matches('input, label')) { active = +rowEl.dataset.r; sel = null; refresh(); }
  });
  $('#side').addEventListener('focusin', e => {
    const rowEl = e.target.closest('.row');
    if (rowEl && e.target.classList.contains('txt') && active !== +rowEl.dataset.r) {
      active = +rowEl.dataset.r; sel = null;
      document.querySelectorAll('#rows .row').forEach(x => x.classList.toggle('act', x === rowEl));
      draw(); hint();
    }
  });
  // sliders: redraw live while dragging, record one undo step when released
  $('#side').addEventListener('input', e => {
    const k = e.target.dataset.adj; if (!k || isKnit()) return;
    if (!adjSnap) adjSnap = JSON.stringify(doc);
    const v = +e.target.value;
    targets().forEach(m => { m.adj = m.adj || {}; m.adj[k] = k === 'l' ? v / 100 : v; });
    e.target.nextElementSibling.textContent = v + (k === 'a' ? '°' : k === 'l' ? '%' : '');
    draw();
  });
  $('#side').addEventListener('change', e => {
    const el = e.target, rowEl = el.closest('.row');
    if (isKnit()) {
      if (el.id === 'kw' || el.id === 'kh') return change(() => Knit.resize(doc, +$('#kw').value || doc.w, +$('#kh').value || doc.h));
      if (el.id === 'kflat') return change(() => { doc.flat = el.value === '1'; });
      return;
    }
    if (el.dataset.adj) {
      targets().forEach(m => {
        const a = m.adj || {};
        ['a', 'x', 'y'].forEach(k => { if (!a[k]) delete a[k]; }); if (a.l === 1) delete a.l;
        if (!Object.keys(a).length) delete m.adj;
      });
      if (adjSnap) { undo.push(adjSnap); redo = []; adjSnap = null; }
      return refresh();
    }
    if (el.id === 'chainN') return change(() => { doc.chain = clamp(+el.value || 1, doc.shape === 'oval' ? 3 : 1, 300); });
    if (el.dataset.act === 'guides') return change(() => { doc.guides = el.checked; });
    if (el.dataset.act === 'arc') return change(() => { if (el.checked) doc.rows[active].arc = true; else delete doc.rows[active].arc; });
    if (el.dataset.act === 'stcolor') return change(() => targets().forEach(m => { m.c = el.value; }));
    if (!rowEl) return;
    const r = +rowEl.dataset.r;
    if (el.dataset.act === 'rowcolor') return change(() => { doc.rows[r].color = el.value; });
    if (el.classList.contains('txt')) {
      try {
        const ops = Crochet.parse(el.value, L.rows[r].pc);
        change(() => { doc.rows[r].ops = ops; active = r; sel = null; });
      } catch (err) { rowErr = { r, msg: err.message, text: el.value }; active = r; refresh(); }
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
    else { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false, target: e.target, shift: e.shiftKey }; }
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
    if (st) {
      const [r, i, j] = st.dataset.p.split(',').map(Number);
      if (d.shift && sel && sel.r === r) sel = { r, i: sel.i, i2: i };  // shift-click extends the selection along the round
      else { active = r; sel = { r, i, j: Number.isNaN(j) ? null : j }; }
    } else sel = null;
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
    const field = e.target.matches && e.target.matches('input:not([type=range]):not([type=checkbox]), select, textarea');
    if (field) { if (e.key === 'Enter' && e.target.classList.contains('txt')) e.target.blur(); return; }
    if (!doc || !$('#start').hidden) return;
    if (e.code === 'Space') { space = true; svg.classList.remove('paint'); e.preventDefault(); return; }
    const mod = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
    if (mod && key === 'z') { e.preventDefault(); return e.shiftKey ? restore(redo, undo) : restore(undo, redo); }
    if (mod && key === 'y') { e.preventDefault(); return restore(redo, undo); }
    if (isKnit()) return;
    if (mod && key === 'c') { if (sel) { e.preventDefault(); copySel(); } return; }
    if (mod && key === 'v') { if (clip) { e.preventDefault(); pasteClip(); } return; }
    if (mod) return;
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
    doc = d; sel = null; undo = []; redo = []; rowErr = null; adjSnap = null;
    active = isKnit() ? 0 : doc.rows.length - 1;
    $('#start').hidden = true;
    $('#title').value = doc.title;
    svg.classList.toggle('paint', !!isKnit());
    chrome(); draw(); fit(); refresh();
  }
  function valid(d) {
    if (!d || typeof d !== 'object') return false;
    if (d.type === 'knit') return Array.isArray(d.cells) && d.cells.length === d.h && d.cells.every(r => Array.isArray(r) && r.length === d.w && r.every(c => c && (Knit.SY[c.s] || c.s === '_')));
    if (d.type === 'crochet') return ['round', 'rows', 'oval'].includes(d.shape) && Array.isArray(d.rows) && d.rows.length > 0
      && d.rows.every(r => Array.isArray(r.ops) && r.ops.every(op => (op.g || [op]).every(m => Crochet.ST[m.t])));
    return false;
  }
  /** Everything whose text depends on the language: static labels, badge, style menu, stitch bar, chart list. */
  function chrome() {
    I18N.apply();
    $('#selLang').value = $('#selLang2').value = cfg.lang;
    const keep = $('#selFirst').value || 'sc';
    $('#selFirst').innerHTML = ['sc', 'hdc', 'dc'].map(k => `<option value="${k}">${esc(nm(Crochet.ST[k]))}</option>`).join('');
    $('#selFirst').value = keep;
    const ix = lib.index(), tag = cfg.lang === 'zh' ? 'zh-Hant' : cfg.lang;
    $('#lib').innerHTML = ix.length ? `<h2>${t('myCharts')}</h2><div class="lib-list">` + ix.map(e =>
      `<div class="lib-item" data-id="${e.id}"><b>${esc(e.title)}</b><span>${t(e.kind)} · ${new Date(e.at).toLocaleDateString(tag)}</span>
        <button class="btn small" data-del="1">${t('del')}</button></div>`).join('') + '</div>' : '';
    if (!doc) return;
    $('#badge').textContent = t(kindKey(doc));
    $('#selStyle').innerHTML = isKnit()
      ? `<option value="jis">${t('styleJis')}</option><option value="west">${t('styleWest')}</option>`
      : `<option value="x">${t('scX')}</option><option value="+">${t('scPlus')}</option>`;
    $('#selStyle').value = isKnit() ? cfg.knit : cfg.sc;
    buildPalette();
  }
  $('#lib').addEventListener('click', e => {
    const item = e.target.closest('.lib-item'); if (!item) return;
    const d = lib.load(item.dataset.id);
    if (e.target.dataset.del) { if (confirm(t('confirmDel', d ? d.title : ''))) { lib.remove(item.dataset.id); if (doc && doc.id === item.dataset.id) doc = null; chrome(); } return; }
    if (valid(d)) openDoc(d);
  });
  document.querySelectorAll('.modes form').forEach(form => form.addEventListener('submit', e => {
    e.preventDefault();
    const m = form.dataset.mode, v = k => +form.elements[k].value, many = (n, k) => Array.from({ length: Math.max(0, n) }, () => ({ t: k }));
    const turn = form.elements.turn && form.elements.turn.checked;
    if (m === 'knit') return openDoc(Knit.newDoc(clamp(v('w') || 20, 1, 120), clamp(v('h') || 20, 1, 200), form.elements.flat.value === '1'));
    const d = { type: 'crochet', shape: m, title: t('untitledC'), guides: true, rows: [{ ops: [] }] };
    if (m === 'round') { // first round in the chosen stitch, with the turning chain that stitch needs
      const n = clamp(v('n') || 0, 0, 60), k = form.elements.st.value;
      d.rows[0].ops = !n ? [] : !turn ? many(n, k) : k === 'sc' ? [{ t: 'tch', n: 1 }, ...many(n, 'sc'), { t: 'join' }]
        : [{ t: 'sch', n: k === 'hdc' ? 2 : 3 }, ...many(n - 1, k), { t: 'join' }];
    } else d.chain = clamp(v('n') || 10, m === 'oval' ? 3 : 1, 200);
    if (m === 'oval') { // sc along the top, 3 into the far end, back along the bottom, 2 more into the first chain
      const N = d.chain, g = n => ({ g: many(n, 'sc') });
      d.rows[0].ops = [...(turn ? [{ t: 'tch', n: 1 }] : []), ...many(N - 1, 'sc'), g(3), ...many(N - 2, 'sc'), g(2), ...(turn ? [{ t: 'join' }] : [])];
    }
    openDoc(d);
  }));
  function showStart() { chrome(); $('#start').hidden = false; }
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
  $('#btnSave').onclick = () => download(fileName('json'), new Blob([JSON.stringify({ app: 'pattern-maker', v: 2, doc }, null, 1)], { type: 'application/json' }));
  $('#btnOpen').onclick = $('#btnOpen2').onclick = () => $('#fileOpen').click();
  $('#fileOpen').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try { const d = JSON.parse(await file.text()).doc; if (!valid(d)) throw 0; delete d.id; openDoc(d); } // opens as a new copy
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
    return Crochet.usedTypes(doc).map(k => { const d = Crochet.ST[k]; return `<div>${Crochet.preview(k, { plus: cfg.sc === '+' })}<span><b>${esc(d.out || k)}</b> ${esc(nm(d))}</span></div>`; }).join('');
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
  function icon(id, d, texts) {
    texts.forEach((txt, i) => { d.rows.push({ ops: [] }); d.rows[i].ops = Crochet.parse(txt, Crochet.layout(d).rows[i].pc); });
    const l = Crochet.layout(d), b = l.bounds, el = $(id);
    el.setAttribute('viewBox', `${b.x + 16} ${b.y + 16} ${b.w - 32} ${b.h - 32}`);
    el.innerHTML = Crochet.render(d, l, { exporting: true }).replace(/<text[^>]*>[^<]*<\/text>/g, '');
  }
  icon('#icoRound', { shape: 'round', guides: false, rows: [] }, ['sc 6', 'inc 6', '(dc, ch) x']);
  icon('#icoRows', { shape: 'rows', chain: 7, guides: false, rows: [] }, ['tch 1, sc 7', 'sch 3, dc 6', 'tch 1, sc 7']);
  icon('#icoOval', { shape: 'oval', chain: 5, guides: false, rows: [] }, ['sc 4, [sc 3], sc 3, [sc 2]', 'inc, sc 3, inc 3, sc 3, inc 2']);
  (() => {
    const d = Knit.newDoc(5, 5, true);
    [[0, 1, 'yo'], [0, 2, 'k2tog'], [1, 3, 'p'], [2, 1, 'p'], [2, 3, 'ssk'], [2, 4, 'yo'], [3, 0, 'c1l'], [4, 2, 'yo'], [4, 3, 'cdd']].forEach(([r, c, s]) => Knit.paint(d, r, c, { mode: 'sym', s }));
    [[1, 0], [1, 1], [3, 3], [3, 4]].forEach(([r, c]) => Knit.paint(d, r, c, { mode: 'color', color: '#e8b4a0' }));
    const el = $('#icoKnit'); el.setAttribute('viewBox', `-4 -4 ${5 * Knit.S + 8} ${5 * Knit.S + 8}`);
    el.innerHTML = Knit.render(d, {}).svg.replace(/<text[^>]*>[^<]*<\/text>/g, '');
  })();

  // charts saved by the earlier single-slot version move into the library
  const old = store.get('pm.doc', null);
  if (valid(old)) lib.save(old);
  store.del('pm.doc');

  showStart();
  window.addEventListener('resize', () => { if (doc) applyView(); });
})();
