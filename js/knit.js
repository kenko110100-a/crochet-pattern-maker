'use strict';
/* Knitting engine: grid chart of symbols + colours, written row instructions.
   cells[r][c]: r = 0 is the bottom row (row 1); c = 0 is the left column.
   A cell is {s:'k', c:null|'#hex'}; cells covered by a wide symbol (cable) are {s:'_', a:anchorCol}. */
const Knit = (() => {
  const S = 22;
  const SY = {
    k:     { w: 1, rs: 'k', ws: 'p', run: true, en: 'Knit', ja: '表目', zh: '下針' },
    p:     { w: 1, rs: 'p', ws: 'k', run: true, en: 'Purl', ja: '裏目', zh: '上針' },
    yo:    { w: 1, rs: 'yo', ws: 'yo', en: 'Yarn over', ja: 'かけ目', zh: '掛針（空針）' },
    k2tog: { w: 1, rs: 'k2tog', ws: 'p2tog', en: 'Knit 2 together (right-leaning)', ja: '左上2目一度', zh: '左上二併針' },
    ssk:   { w: 1, rs: 'ssk', ws: 'ssp', en: 'Slip, slip, knit (left-leaning)', ja: '右上2目一度', zh: '右上二併針' },
    cdd:   { w: 1, rs: 'cdd', ws: 'cdd', en: 'Centered double decrease', ja: '中上3目一度', zh: '中上三併針' },
    m1:    { w: 1, rs: 'm1', ws: 'm1p', en: 'Make 1', ja: 'ねじり増し目', zh: '扭加針' },
    kfb:   { w: 1, rs: 'kfb', ws: 'pfb', en: 'Knit front and back', ja: '2目の編み出し増し目', zh: '一針放兩針' },
    sl:    { w: 1, rs: 'sl1', ws: 'sl1', en: 'Slip stitch', ja: 'すべり目', zh: '滑針' },
    ktbl:  { w: 1, rs: 'ktbl', ws: 'ptbl', en: 'Knit through back loop', ja: 'ねじり目', zh: '扭針' },
    mb:    { w: 1, rs: 'mb', ws: 'mb', en: 'Bobble', ja: '玉編み（ボッブル）', zh: '玉編（球球針）' },
    bo:    { w: 1, rs: 'BO', ws: 'BO', run: true, en: 'Bind off', ja: '伏せ目', zh: '收針（伏針）' },
    ns:    { w: 1, rs: '', ws: '', en: 'No stitch', ja: '編み目なし', zh: '無針' },
    c1l:   { w: 2, n: 1, lc: true, rs: '1/1 LC', ws: '1/1 LC', en: '1/1 left cross', ja: '右上1目交差', zh: '右上1針交叉' },
    c1r:   { w: 2, n: 1, rs: '1/1 RC', ws: '1/1 RC', en: '1/1 right cross', ja: '左上1目交差', zh: '左上1針交叉' },
    c2l:   { w: 4, n: 2, lc: true, rs: '2/2 LC', ws: '2/2 LC', en: '2/2 left cross (cable)', ja: '右上2目交差', zh: '右上2針交叉' },
    c2r:   { w: 4, n: 2, rs: '2/2 RC', ws: '2/2 RC', en: '2/2 right cross (cable)', ja: '左上2目交差', zh: '左上2針交叉' },
    c3l:   { w: 6, n: 3, lc: true, rs: '3/3 LC', ws: '3/3 LC', en: '3/3 left cross (cable)', ja: '右上3目交差', zh: '右上3針交叉' },
    c3r:   { w: 6, n: 3, rs: '3/3 RC', ws: '3/3 RC', en: '3/3 right cross (cable)', ja: '左上3目交差', zh: '左上3針交叉' },
  };
  const PALETTE = ['#ffffff', '#f4e9d0', '#e8b4a0', '#c2513b', '#e0a43a', '#7fa66b', '#3f7d6e', '#5a86b8', '#34466e', '#8a5a94', '#6b4a3a', '#2b2b2b'];

  const blank = () => ({ s: 'k', c: null });
  function newDoc(w, h, flat) {
    return { type: 'knit', title: I18N.t('untitledK'), flat, w, h, cells: Array.from({ length: h }, () => Array.from({ length: w }, blank)) };
  }

  const ink = bg => { // readable symbol colour on a cell background
    if (!bg) return '#222';
    const n = parseInt(bg.slice(1), 16), l = (.299 * (n >> 16) + .587 * ((n >> 8) & 255) + .114 * (n & 255));
    return l < 120 ? '#fff' : '#222';
  };
  /** Symbol drawing inside a w*S by S box at the origin. style: 'jis' | 'west'. */
  function sym(id, style, col) {
    const L = d => `<path d="${d}" fill="none" stroke="${col}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`;
    const jis = style !== 'west';
    switch (id) {
      case 'k': return jis ? L('M11 5V17') : '';
      case 'p': return jis ? L('M5 11H17') : `<circle cx="11" cy="11" r="2.3" fill="${col}"/>`;
      case 'yo': return `<circle cx="11" cy="11" r="5.5" fill="none" stroke="${col}" stroke-width="1.4"/>`;
      case 'k2tog': return jis ? L('M14.5 4L5 18M10.5 10L17 18') : L('M5 18L17 4');
      case 'ssk': return jis ? L('M7.5 4L17 18M11.5 10L5 18') : L('M5 4L17 18');
      case 'cdd': return L('M11 4L5 18M11 4L17 18M11 4V18');
      case 'm1': return `<text x="11" y="15.2" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="12" font-weight="700" fill="${col}">M</text>`;
      case 'kfb': return L('M5 5L11 11L17 5M11 11V18');
      case 'sl': return L('M5 5L11 17L17 5');
      case 'ktbl': return L('M7 18C17 12 16 4 11 4C6 4 5 12 15 18');
      case 'mb': return `<circle cx="11" cy="11" r="5.2" fill="none" stroke="${col}" stroke-width="1.4"/><circle cx="11" cy="11" r="2" fill="${col}"/>`;
      case 'bo': return `<ellipse cx="11" cy="11" rx="6.5" ry="3.2" fill="${col}"/>`;
      case 'ns': return '';
    }
    const d = SY[id]; if (!d || !d.n) return '';
    const W = d.w * S, offs = d.n === 1 ? [0] : d.n === 2 ? [-2.2, 2.2] : [-3.6, 0, 3.6];
    let out = '';
    offs.forEach(o => {
      const a = [3, 5 + o], b = [W - 3, 17 + o];          // "\" strand
      const c = [3, 17 + o], e = [W - 3, 5 + o];          // "/" strand
      const [f1, f2, g1, g2] = d.lc ? [a, b, c, e] : [c, e, a, b]; // front strand is unbroken
      const at = (p, q, t) => `${(p[0] + (q[0] - p[0]) * t).toFixed(1)} ${(p[1] + (q[1] - p[1]) * t).toFixed(1)}`;
      out += L(`M${f1[0]} ${f1[1]}L${f2[0]} ${f2[1]}M${g1[0]} ${g1[1]}L${at(g1, g2, .36)}M${at(g1, g2, .64)}L${g2[0]} ${g2[1]}`);
    });
    return out;
  }

  function render(doc, o = {}) {
    const { w, h } = doc; let s = '';
    for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
      const cell = doc.cells[r][c]; if (cell.s === '_') continue;
      const d = SY[cell.s], bg = cell.s === 'ns' ? '#cfcac0' : (cell.c || '#fff');
      s += `<g transform="translate(${c * S} ${(h - 1 - r) * S})"><rect width="${d.w * S}" height="${S}" fill="${bg}" stroke="#b9b3a7" stroke-width=".5"/>${sym(cell.s, o.style, ink(cell.s === 'ns' ? null : cell.c))}</g>`;
    }
    let g = '';
    for (let c = 0; c <= w; c++) if ((w - c) % 5 === 0) g += `M${c * S} 0V${h * S}`;
    for (let r = 0; r <= h; r++) if (r % 5 === 0) g += `M0 ${(h - r) * S}H${w * S}`;
    s += `<path d="${g}" fill="none" stroke="#6f6a60" stroke-width="1"/><rect width="${w * S}" height="${h * S}" fill="none" stroke="#3a352e" stroke-width="1.4"/>`;
    const T = (x, y, t, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="Helvetica,Arial,sans-serif" font-size="9" fill="#6f6a60">${t}</text>`;
    for (let r = 0; r < h; r++) {
      const y = (h - 1 - r) * S + 14, right = !doc.flat || r % 2 === 0;
      s += right ? T(w * S + 6, y, r + 1, 'start') : T(-6, y, r + 1, 'end');
    }
    for (let c = 0; c < w; c++) { const n = w - c; if (w <= 30 || n % 5 === 0 || n === 1) s += T(c * S + S / 2, h * S + 12, n, 'middle'); }
    return { svg: s, bounds: { x: -30, y: -10, w: w * S + 60, h: h * S + 32 } };
  }

  function clear(doc, r, c) {
    const row = doc.cells[r], a = row[c].s === '_' ? row[c].a : c, w = SY[row[a].s].w;
    if (w > 1) for (let q = a; q < a + w; q++) row[q] = { s: 'k', c: row[q].c || null };
  }
  /** brush: {mode:'sym'|'color'|'erase', s, color}. Returns true if the chart changed. */
  function paint(doc, r, c, brush) {
    if (r < 0 || c < 0 || r >= doc.h || c >= doc.w) return false;
    const row = doc.cells[r], before = JSON.stringify(row);
    if (brush.mode === 'color') {
      const a = row[c].s === '_' ? row[c].a : c; row[a].c = brush.color === '#ffffff' ? null : brush.color;
    } else if (brush.mode === 'erase') { clear(doc, r, c); row[c] = blank(); }
    else {
      const w = SY[brush.s].w, c0 = Math.min(c, doc.w - w);
      if (c0 < 0) return false;
      if (row[c0].s === brush.s) return false;
      for (let q = c0; q < c0 + w; q++) clear(doc, r, q);
      row[c0].s = brush.s;
      for (let q = c0 + 1; q < c0 + w; q++) row[q] = { s: '_', a: c0, c: null };
    }
    return JSON.stringify(row) !== before;
  }
  /** Rows are added/removed at the top, columns at the left (so stitch numbers from the right stay put). */
  function resize(doc, w, h) {
    w = Math.max(1, Math.min(120, w | 0)); h = Math.max(1, Math.min(200, h | 0));
    const dw = w - doc.w;
    doc.cells = doc.cells.slice(0, h).map(row => {
      if (dw > 0) return [...Array.from({ length: dw }, blank), ...row.map(x => x.s === '_' ? { ...x, a: x.a + dw } : x)];
      if (dw < 0) return row.slice(-dw).map(x => x.s === '_' ? (x.a + dw < 0 ? blank() : { ...x, a: x.a + dw }) : x);
      return row;
    });
    while (doc.cells.length < h) doc.cells.push(Array.from({ length: w }, blank));
    doc.w = w; doc.h = h;
  }

  function colorNames(doc) {
    const map = new Map();
    doc.cells.forEach(row => row.forEach(x => { if (x.c && !map.has(x.c)) map.set(x.c, String.fromCharCode(65 + map.size)); }));
    return map;
  }
  function written(doc) {
    const names = colorNames(doc), lines = [];
    if (names.size) lines.push(I18N.t('kColours') + [...names].map(([c, n]) => `, ${n} = ${c}`).join(''));
    for (let r = 0; r < doc.h; r++) {
      const rs = !doc.flat || r % 2 === 0, row = doc.cells[r];
      const order = [...row.keys()]; if (rs) order.reverse();
      const multi = new Set(row.filter(x => x.s !== '_' && x.s !== 'ns').map(x => x.c || '')).size > 1;
      const toks = [];
      order.forEach(c => {
        const x = row[c]; if (x.s === '_' || x.s === 'ns') return;
        const d = SY[x.s], ab = rs ? d.rs : d.ws, col = multi ? (x.c ? names.get(x.c) : 'MC') : '';
        const last = toks[toks.length - 1];
        if (last && last.ab === ab && last.col === col) last.n++; else toks.push({ ab, col, n: 1, run: d.run });
      });
      const body = toks.map(t => (t.n === 1 ? (t.run ? t.ab + '1' : t.ab) : t.run ? t.ab + t.n : `(${t.ab}) x${t.n}`) + (t.col ? ` ${t.col}` : '')).join(', ');
      lines.push(`${I18N.t(doc.flat ? 'wRow' : 'wRnd', r + 1)}${doc.flat ? I18N.t(rs ? 'rs' : 'ws') : ''}: ${body}`);
    }
    return lines;
  }
  function usedTypes(doc) {
    const set = new Set(); doc.cells.forEach(row => row.forEach(x => set.add(x.s)));
    return Object.keys(SY).filter(k => set.has(k));
  }
  function preview(id, style) {
    const d = SY[id], W = d.w * S;
    return `<svg viewBox="-1 -1 ${W + 2} ${S + 2}"><rect width="${W}" height="${S}" fill="${id === 'ns' ? '#cfcac0' : '#fff'}" stroke="#b9b3a7" stroke-width=".7"/>${sym(id, style, '#222')}</svg>`;
  }
  return { S, SY, PALETTE, newDoc, render, paint, resize, written, usedTypes, preview };
})();
