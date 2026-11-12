'use strict';
/* Crochet engine: stitch table, written-text <-> stitches, automatic chart layout, symbol drawing.
   A chart is a list of rows (rounds). Each row is a list of ops worked in order:
     {t:'sc'}            a stitch worked into the next stitch(es) of the previous row
     {g:[{t},{t}]}       several stitches worked into the same stitch (increase, shell, V-stitch)
     {t:'ch'} {t:'sk'}   chain (uses no stitch, but counts as one for the next row) / skip one stitch
     {t:'tch',n}         turning chain that is not counted (drawn beside the first stitch)
     {t:'sch',n}         turning chain that counts as a stitch (2 ch = hdc, 3 ch = dc, 4 ch = tr)
     {t:'join'}          small slip stitch that closes a round or ends a motif
   Any stitch may carry c (colour) and adj {a,l,x,y} (manual tilt, length, sideways, in/out).
   Positions are never stored: layout() derives them. Every stitch gets an even share of the round and
   stands exactly radial (or upright in rows), so charts stay tidy however they are edited. */
const Crochet = (() => {
  const T = I18N.t;
  const GAP = 4, MINW = 12, ROWW = 15, TAU = Math.PI * 2;
  const CHW = .62, ARCW = .42;          // share of a stitch slot taken by one chain (in a line / in an arc)
  const COLORS = ['#2b2b2b', '#b5542d', '#2f6f9f', '#3b8a4f', '#8a4f9e', '#c2842a', '#1f8a8a', '#b23a5a'];
  // A turning chain is as tall as the stitch it stands for: 1 ch = sc, 2 = hdc, 3 = dc, 4 = tr, 5 = dtr.
  const CHAIN_H = [0, 14, 21, 28, 36, 44];
  const chainH = n => CHAIN_H[n] || n * 9;

  // Symbols follow the JIS / international chart convention (hdc = T, dc = T + 1 slash, tr = T + 2 slashes).
  const ST = {
    ch:     { h: 8,  par: 0, en: 'Chain', ja: 'くさり編み', zh: '鎖針' },
    sl:     { h: 7,  out: 'sl st', en: 'Slip stitch', ja: '引き抜き編み', zh: '引拔針' },
    sc:     { h: 14, en: 'Single crochet', ja: 'こま編み', zh: '短針' },
    hdc:    { h: 21, en: 'Half double crochet', ja: '中長編み', zh: '中長針' },
    dc:     { h: 28, en: 'Double crochet', ja: '長編み', zh: '長針' },
    tr:     { h: 36, en: 'Treble crochet', ja: '長々編み', zh: '長長針' },
    dtr:    { h: 44, en: 'Double treble', ja: '三つ巻き長編み', zh: '三捲長針' },
    scblo:  { h: 14, out: 'sc-blo', en: 'Single crochet in back loop', ja: 'こま編みのすじ編み', zh: '短針筋編' },
    fpdc:   { h: 28, post: -1, en: 'Front post double crochet', ja: '長編みの表引き上げ編み', zh: '外鉤長針' },
    bpdc:   { h: 28, post: 1, en: 'Back post double crochet', ja: '長編みの裏引き上げ編み', zh: '內鉤長針' },
    cl:     { h: 28, en: '3-dc cluster (bobble)', ja: '長編み3目の玉編み', zh: '長針3針玉編' },
    puff:   { h: 21, en: 'Puff stitch (3 hdc)', ja: '中長編み3目の玉編み', zh: '中長針3針玉編（泡芙針）' },
    pc:     { h: 28, en: 'Popcorn (5 dc)', ja: '長編み5目のパプコーン編み', zh: '爆米花針' },
    picot:  { h: 11, par: 0, en: 'Picot (ch 3)', ja: 'くさり3目のピコット', zh: '結粒針（狗牙針）' },
    sc2tog: { h: 14, par: 2, base: 'sc', en: 'Sc 2 together (decrease)', ja: 'こま編み2目一度', zh: '短針2併針' },
    sc3tog: { h: 14, par: 3, base: 'sc', en: 'Sc 3 together', ja: 'こま編み3目一度', zh: '短針3併針' },
    hdc2tog:{ h: 21, par: 2, base: 'hdc', en: 'Hdc 2 together', ja: '中長編み2目一度', zh: '中長針2併針' },
    dc2tog: { h: 28, par: 2, base: 'dc', en: 'Dc 2 together', ja: '長編み2目一度', zh: '長針2併針' },
    dc3tog: { h: 28, par: 3, base: 'dc', en: 'Dc 3 together', ja: '長編み3目一度', zh: '長針3併針' },
    tr2tog: { h: 36, par: 2, base: 'tr', en: 'Tr 2 together', ja: '長々編み2目一度', zh: '長長針2併針' },
    sk:     { h: 0, en: 'Skip a stitch', ja: '目をとばす', zh: '跳過一針' },
    tch:    { h: 0, en: 'Turning chain (not counted)', ja: '立ち上がりのくさり（数えない）', zh: '起立針（不算針數）' },
    sch:    { h: 0, en: 'Turning chain (counts as a stitch)', ja: '立ち上がりのくさり（1目に数える）', zh: '起立針（算一針）' },
    join:   { h: 0, en: 'Slip stitch, small (join)', ja: '引き抜き編み（小）', zh: '引拔針（小）' },
  };
  const ALIAS = { slst: 'sl', ss: 'sl', dec: 'sc2tog', 'sc-blo': 'scblo', blo: 'scblo', bob: 'cl', bobble: 'cl',
    cluster: 'cl', popcorn: 'pc', p: 'picot', skip: 'sk', turn: 'tch' };
  const MACRO = { inc: ['sc', 'sc'], scinc: ['sc', 'sc'], hdcinc: ['hdc', 'hdc'], dcinc: ['dc', 'dc'], trinc: ['tr', 'tr'],
    vst: ['dc', 'ch', 'dc'], shell: ['dc', 'dc', 'dc', 'dc', 'dc'] };

  const name = t => ST[t].out || t;
  /** How many stitches of the previous row an op uses up. */
  const parOf = op => op.g ? 1 : (op.t === 'sk' || op.t === 'sch') ? 1 : (op.t === 'tch' || op.t === 'join') ? 0 : (ST[op.t].par ?? 1);
  /** True for ops that can share a stitch with others inside [ ]. */
  const isPlain = op => !op.g && !['sk', 'tch', 'join'].includes(op.t) && (ST[op.t].par ?? 1) <= 1;
  const ownH = m => (m.t === 'sch' || m.t === 'tch') ? chainH(m.n) : ST[m.t].h;

  // ---------- ops -> written instructions ----------
  const mtok = m => m.t === 'sch' ? 'sch ' + m.n : name(m.t);
  function tok(op) {
    if (op.g) {
      if (op.g.length === 2 && op.g.every(m => m.t === 'sc')) return 'inc';
      return '[' + rle(op.g.map(mtok)) + ']';
    }
    if (op.t === 'tch' || op.t === 'sch') return op.t + ' ' + op.n;
    return name(op.t);
  }
  function rle(toks) {
    const out = [];
    for (let i = 0; i < toks.length;) {
      let j = i; while (j < toks.length && toks[j] === toks[i]) j++;
      const n = j - i, t = toks[i];
      if (n === 1) out.push(t);
      else if (t[0] === '[') out.push(t + ' x' + n);
      else if (/^(tch|sch) |^join$/.test(t)) for (let k = 0; k < n; k++) out.push(t);
      else out.push(t + ' ' + n);
      i = j;
    }
    return out.join(', ');
  }
  function toText(ops) {
    const toks = ops.map(tok); let a = 0, b = toks.length;
    while (a < b && /^(tch|sch) /.test(toks[a])) a++;
    while (b > a && toks[b - 1] === 'join') b--;
    const body = fold(toks.slice(a, b));
    return [...toks.slice(0, a), ...(body ? [body] : []), ...toks.slice(b)].join(', ');
  }
  /** Finds the longest repeated sequence and writes it as "(unit) xN"; the rest is run-length encoded. */
  function fold(t) {
    let best = null;
    for (let s = 0; s < t.length; s++) for (let p = 2; s + 2 * p <= t.length; p++) {
      let k = 1; while (s + (k + 1) * p <= t.length && t.slice(s + k * p, s + (k + 1) * p).every((x, i) => x === t[s + i])) k++;
      if (k > 1 && !t.slice(s, s + p).every(x => x === t[s]) && (!best || p * k > best.p * best.k)) best = { s, p, k };
    }
    if (!best) return rle(t);
    const { s, p, k } = best;
    return [rle(t.slice(0, s)), '(' + rle(t.slice(s, s + p)) + ') x' + k, fold(t.slice(s + p * k))].filter(Boolean).join(', ');
  }

  // ---------- written instructions -> ops ----------
  /** Parses e.g. "(sc 2, inc) x6", "[dc 2, ch 2, dc 2]", "sch 3, dc 11, join". pc = stitches available below. */
  function parse(text, pc) {
    const s = text.toLowerCase().replace(/sl\s*st/g, 'sl').replace(/[×✕]/g, 'x').replace(/[，、]/g, ',');
    let i = 0;
    const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const int = () => { ws(); const m = /^\d+/.exec(s.slice(i)); if (!m) return null; i += m[0].length; return +m[0]; };
    const mult = () => { ws(); if (s[i] === 'x' || s[i] === '*') { i++; const n = int(); return n === null ? 0 : n; } return null; };
    const times = (n, fn) => Array.from({ length: n }, fn);
    const known = w => ST[w] || ALIAS[w] || MACRO[w];
    function seq(close, inG) {
      const out = [];
      for (;;) {
        ws();
        if (i >= s.length) { if (close) throw Error(T('eMissing', close)); break; }
        if (s[i] === close) { i++; break; }
        if (s[i] === ',' || s[i] === ';') { i++; continue; }
        out.push(...item(inG));
      }
      return out;
    }
    function item(inG) {
      if (s[i] === '(') {
        if (inG) throw Error(T('eParenInGroup'));
        i++; const body = seq(')'); const m = mult();
        return [{ rep: body, n: m === null ? 1 : m }];
      }
      if (s[i] === '[') {
        if (inG) throw Error(T('eNested'));
        i++; const body = seq(']', true);
        if (!body.length) throw Error(T('eEmpty'));
        const m = mult(); if (m === 0) throw Error(T('eGroupCount'));
        return times(m === null ? 1 : m, () => ({ op: { g: body.map(b => ({ ...b.op })) } }));
      }
      const a = int(); ws();
      const m = /^[a-z][a-z0-9-]*/.exec(s.slice(i));
      if (!m) throw Error(T('eUnexpected', s[i]));
      let w = m[0], extra = null;
      if (!known(w)) {
        const mm = /^(.*?)(\d+)$/.exec(w);
        if (mm && known(mm[1])) { w = mm[1]; extra = +mm[2]; } else throw Error(T('eUnknown', w));
      }
      i += m[0].length;
      let cnt = a ?? extra ?? int();
      const given = cnt !== null;
      let open = false; // "inc x" with no number = repeat to the end of the row
      if (!given) { const mu = mult(); if (mu === 0) open = true; cnt = mu || 1; }
      const t = ALIAS[w] || w;
      const wrap = nodes => open && !inG ? [{ rep: nodes, n: 0 }] : nodes;
      if (MACRO[t]) {
        if (inG) throw Error(T('ePlain'));
        return wrap(times(cnt, () => ({ op: { g: MACRO[t].map(x => ({ t: x })) } })));
      }
      if (t === 'tch' || t === 'sch') {
        if (inG && t === 'tch') throw Error(T('eNotInGroup', w));
        return [{ op: { t, n: Math.max(1, Math.min(9, given ? cnt : (t === 'sch' ? 3 : 1))) } }];
      }
      if (t === 'join') { if (inG) throw Error(T('eNotInGroup', w)); return [{ op: { t } }]; }
      if (inG && (t === 'sk' || (ST[t].par ?? 1) > 1)) throw Error(T('eNotInGroup', w));
      return wrap(times(cnt, () => ({ op: { t } })));
    }
    const nodes = seq();
    const cons = n => n.rep ? n.rep.reduce((a, x) => a + cons(x), 0) * n.n : parOf(n.op);
    const chk = n => { if (n.rep) n.rep.forEach(x => { if (x.rep && x.n === 0) throw Error(T('eInner')); chk(x); }); };
    nodes.forEach(chk);
    const open = nodes.filter(n => n.rep && n.n === 0);
    if (open.length > 1) throw Error(T('eOneOpen'));
    if (open.length) {
      if (!isFinite(pc)) throw Error(T('eNeedCount'));
      const unit = open[0].rep.reduce((a, x) => a + cons(x), 0);
      if (!unit) throw Error(T('eNoUse'));
      const fixed = nodes.reduce((a, n) => a + (n === open[0] ? 0 : cons(n)), 0);
      const k = Math.floor((pc - fixed) / unit);
      if (k < 1) throw Error(T('eNoFit'));
      open[0].n = k;
    }
    const out = [];
    const emit = n => { if (n.rep) { for (let k = 0; k < n.n; k++) n.rep.forEach(emit); } else out.push(JSON.parse(JSON.stringify(n.op))); };
    nodes.forEach(emit);
    return out;
  }

  // ---------- small vector helpers ----------
  const f = n => Math.round(n * 100) / 100;
  const mv = (p, d, a, n, b) => ({ x: p.x + d.x * a + (n ? n.x * b : 0), y: p.y + d.y * a + (n ? n.y * b : 0) });
  const perp = d => ({ x: -d.y, y: d.x });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const dirTo = (a, b, fb) => { const x = b.x - a.x, y = b.y - a.y, l = Math.hypot(x, y); return l < .5 ? fb : { x: x / l, y: y / l }; };
  const mid = (a, b, t = .5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const rot = (v, deg) => { const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r); return { x: v.x * c - v.y * s, y: v.x * s + v.y * c }; };
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  // ---------- layout ----------
  /* Coordinates along a row: an angle (round), an x position (rows), or for ovals {g, v} where g is the
     side — T/B straight top and bottom (v = x), L/R semicircular ends (v = angle). */
  function layout(doc) {
    const rows = doc.shape === 'rows', oval = doc.shape === 'oval';
    const N = Math.max(oval ? 2 : 1, doc.chain || 10), bx = (N - 1) * ROWW; // oval ends are centred on x = 0 and x = bx
    const P = rows ? (c, L) => ({ x: c, y: -L })
      : oval ? (c, L) => c.g === 'T' ? { x: c.v, y: -L } : c.g === 'B' ? { x: c.v, y: L }
        : { x: (c.g === 'L' ? 0 : bx) - L * Math.sin(c.v), y: -L * Math.cos(c.v) }
      : (c, L) => ({ x: -L * Math.sin(c), y: -L * Math.cos(c) });
    const U = rows ? () => ({ x: 0, y: -1 })
      : oval ? c => c.g === 'T' ? { x: 0, y: -1 } : c.g === 'B' ? { x: 0, y: 1 } : { x: -Math.sin(c.v), y: -Math.cos(c.v) }
      : c => ({ x: -Math.sin(c), y: -Math.cos(c) });
    const out = { shape: doc.shape, round: !rows, rows: [], items: [], ringR: 6, chain: null, bx, maxTop: 20, minX: 0, maxX: 0 };

    let prev = null; // { anchors:[coord], top, unit, h } of the last non-empty row, in working order
    if (rows) {
      prev = { anchors: Array.from({ length: N }, (_, i) => i * ROWW), top: 4.5, unit: ROWW, h: 6 };
      out.maxX = bx;
    } else if (oval) {
      // worked anticlockwise from the right-hand end: end chain, along the top, far end, back along the bottom, end chain again
      const a = [{ g: 'R', v: 1.75 * Math.PI }];
      for (let k = N - 2; k >= 1; k--) a.push({ g: 'T', v: k * ROWW });
      a.push({ g: 'L', v: Math.PI / 2 });
      for (let k = 1; k <= N - 2; k++) a.push({ g: 'B', v: k * ROWW });
      a.push({ g: 'R', v: 1.25 * Math.PI });
      prev = { anchors: a, top: 5, unit: ROWW, h: 6 };
    }
    if (!out.round || oval) out.chain = Array.from({ length: N }, (_, i) => ({ x: i * ROWW, y: 0 }));

    doc.rows.forEach((row, r) => {
      const ring = !prev;
      const PA = ring ? null : (rows ? prev.anchors.slice().reverse() : prev.anchors);
      const pc = ring ? Infinity : PA.length;
      const sign = rows ? (r % 2 ? 1 : -1) : 1;
      const pidx = k => rows ? Math.min(k, pc - 1) : k % pc;
      const tv = c => { if (rows) return { x: sign, y: 0 }; const u = U(c); return { x: u.y, y: -u.x }; }; // direction of work
      const color = row.color || COLORS[r % COLORS.length];

      // 1. slots: everything that takes room along the row
      const slots = [], joins = []; let k = 0, gid = 0;
      const mk = (m, path, pars, g, gi, gn) => ({ path, t: m.t, n: m.n, col: m.c, adj: m.adj, pars, g, gi, gn,
        free: m.t === 'ch' || m.t === 'picot', h: ownH(m),
        w: (gn > 2 ? .74 : 1) * (m.t === 'ch' ? (row.arc ? ARCW : CHW) : m.t === 'picot' ? .8 : m.t === 'tch' ? (rows ? 0 : .45) : 1) }); // fans pack a little tighter
      row.ops.forEach((op, i) => {
        if (op.g) { const par = k++; gid++; op.g.forEach((m, j) => slots.push(mk(m, [r, i, j], [par], gid, j, op.g.length))); }
        else if (op.t === 'sk') k++;
        else if (op.t === 'join') joins.push({ op, path: [r, i], at: slots.length });
        else if (op.t === 'tch') slots.push({ ...mk(op, [r, i], [], 0, 0, 1), tc: true });
        else if (op.t === 'sch') slots.push(mk(op, [r, i], [k++], 0, 0, 1));
        else { const par = ST[op.t].par ?? 1, pars = []; for (let q = 0; q < par; q++) pars.push(k++); slots.push(mk(op, [r, i], pars, 0, 0, 1)); }
      });
      const A = slots.filter(s => !s.tc), n = A.length, used = k, done = used >= pc;
      let hRow = 12; slots.forEach(s => { hRow = Math.max(hRow, s.h); });
      const tot = slots.reduce((a, s) => a + s.w, 0) || 1;
      const members = {}; slots.forEach(s => { if (s.g) (members[s.g] = members[s.g] || []).push(s); });

      // 2. coordinates
      let Lin, unit = ROWW;
      if (rows) {
        // rows are a grid: every stitch stands in the column of the stitch it is worked into, chains fill the gaps
        slots.forEach(s => {
          s.c = s.tc || !s.pars.length ? null
            : avg(s.pars.map(q => PA[pidx(q)])) + (s.gn > 1 ? sign * (s.gi - (s.gn - 1) / 2) * ROWW * .9 : 0);
        });
        const step = sign * ROWW * (row.arc ? ARCW : CHW);
        A.forEach((s, i) => {
          if (s.c != null) return;
          let a = i - 1, b = i + 1;
          while (a >= 0 && A[a].pars.length === 0) a--;
          while (b < n && A[b].pars.length === 0) b++;
          const va = a >= 0 ? A[a].c : null, vb = b < n ? A[b].c : null;
          s.c = va != null && vb != null ? va + (vb - va) * (i - a) / (b - a) : va != null ? va + step * (i - a)
            : vb != null ? vb - step * (b - i) : PA[0] + step * i;
        });
        const before = A.map(s => s.c); // increases must not crowd their neighbours: push apart, then re-centre
        for (let i = 1; i < n; i++) {
          const need = ROWW * (A[i - 1].w + A[i].w) / 2 * .82;
          if (sign * (A[i].c - A[i - 1].c) < need) A[i].c = A[i - 1].c + sign * need;
        }
        if (n) { const d = avg(before) - avg(A.map(s => s.c)); A.forEach(s => { s.c += d; }); }
        slots.forEach((s, i) => { if (s.tc) { const ref = slots.slice(i + 1).find(x => !x.tc) || A[n - 1]; s.c = ref ? ref.c : PA[0]; } });
        Lin = prev.top + GAP;
      } else if (!oval) {
        const fa = slots.findIndex(s => !s.tc);
        const base = slots.slice(0, Math.max(fa, 0)).reduce((a, s) => a + s.w, 0) + (fa >= 0 ? slots[fa].w / 2 : 0);
        let acc = 0; slots.forEach(s => { s.cc = acc + s.w / 2 - base; acc += s.w; });
        if (!rows) unit = (ring ? TAU : used ? Math.min(used, pc) / pc * TAU : tot * prev.unit) / tot;
        const origin = ring ? 0 : PA[0];
        slots.forEach(s => { s.c = origin + sign * s.cc * unit; });
        if (!ring) { // turn the whole row so that, on average, every stitch sits exactly over the stitch it is worked into
          const pu = q => rows ? PA[pidx(q)] : PA[q % pc] + TAU * Math.floor(q / pc);
          const offs = [], seen = {};
          slots.forEach(s => {
            if (s.tc || !s.pars.length) return;
            if (s.g) { if (seen[s.g]) return; seen[s.g] = 1; offs.push(pu(s.pars[0]) - avg(members[s.g].map(x => x.c))); }
            else offs.push(avg(s.pars.map(pu)) - s.c);
          });
          const phi = offs.length ? avg(offs) : 0;
          slots.forEach(s => { s.c += phi; });
        }
        if (rows) Lin = prev.top + GAP;
        else {
          const est = (ring || done || !used) ? tot : tot * pc / used;
          Lin = Math.max(ring ? 9 : prev.top + GAP, est * MINW / TAU - hRow);
          if (ring) out.ringR = Lin - 3;
        }
      } else {
        // each slot stays on the side of the oval its parent is on: straight sides keep their columns,
        // and the two ends share their stitches evenly round a semicircle
        slots.forEach(s => { s.reg = s.pars.length ? PA[pidx(s.pars[0])].g : null; });
        for (let i = 1; i < slots.length; i++) if (!slots[i].reg) slots[i].reg = slots[i - 1].reg;
        for (let i = slots.length - 2; i >= 0; i--) if (!slots[i].reg) slots[i].reg = slots[i + 1].reg;
        slots.forEach(s => { if (!s.reg) s.reg = 'R'; });
        const X = {};
        slots.forEach((s, i) => {
          if (s.reg !== 'T' && s.reg !== 'B') return;
          const dir = s.reg === 'T' ? -1 : 1;
          const ps = s.pars.map(q => PA[pidx(q)]).filter(a => a.g === s.reg);
          if (ps.length) X[i] = avg(ps.map(a => a.v)) + (s.gn > 1 ? dir * (s.gi - (s.gn - 1) / 2) * ROWW * .9 : 0);
        });
        slots.forEach((s, i) => { // chains on a straight side sit between their neighbours
          if ((s.reg !== 'T' && s.reg !== 'B') || X[i] != null) return;
          const dir = s.reg === 'T' ? -1 : 1;
          let a = i - 1, b = i + 1;
          while (a >= 0 && slots[a].reg === s.reg && X[a] == null) a--;
          while (b < slots.length && slots[b].reg === s.reg && X[b] == null) b++;
          const va = a >= 0 && slots[a].reg === s.reg ? X[a] : null, vb = b < slots.length && slots[b].reg === s.reg ? X[b] : null;
          s.xv = va != null && vb != null ? va + (vb - va) * (i - a) / (b - a) : va != null ? va + dir * ROWW * CHW * (i - a)
            : vb != null ? vb - dir * ROWW * CHW * (b - i) : (s.reg === 'T' ? bx : 0);
        });
        slots.forEach((s, i) => { if (s.reg === 'T' || s.reg === 'B') s.c = { g: s.reg, v: X[i] != null ? X[i] : s.xv }; });
        let need = 0;
        const firstNonR = slots.findIndex(s => s.reg !== 'R');
        ['L', 'R'].forEach(g => {
          const all = slots.map((s, i) => ({ s, i })).filter(o => o.s.reg === g);
          if (!all.length) return;
          const head = g === 'R' ? all.filter(o => firstNonR < 0 || o.i < firstNonR) : [];
          const body = all.filter(o => !head.includes(o));
          const W = all.reduce((a, o) => a + o.s.w, 0), Wh = head.reduce((a, o) => a + o.s.w, 0);
          const parentsTotal = prev.anchors.filter(a => a.g === g).length;
          const consumed = new Set(all.flatMap(o => o.s.pars.map(pidx))).size || 1;
          const est = done ? W : Math.max(W, W * parentsTotal / consumed);
          const th0 = g === 'L' ? 0 : Math.PI;
          let acc = 0; body.forEach(o => { o.s.c = { g, v: th0 + (acc + o.s.w / 2) / est * Math.PI }; acc += o.s.w; });
          acc = est - Wh; head.forEach(o => { o.s.c = { g, v: th0 + (acc + o.s.w / 2) / est * Math.PI }; acc += o.s.w; });
          need = Math.max(need, est * MINW / Math.PI - hRow);
        });
        Lin = Math.max(prev.top + GAP, need);
      }
      const pcoord = q => oval ? PA[pidx(q)] : rows ? PA[pidx(q)] : PA[q % pc] + TAU * Math.floor(q / pc);
      const gcen = {};
      Object.keys(members).forEach(g => { const m = members[g]; gcen[g] = oval ? { g: m[0].c.g, v: avg(m.map(x => x.c.v)) } : avg(m.map(x => x.c)); });

      // 3. chain arcs: a run of chains between two stitches bows outward when it is longer than the gap
      const baseH = Math.min(...A.filter(s => !s.free).map(s => s.h), hRow);
      if (row.arc) {
        for (let i = 0; i < slots.length; i++) {
          if (slots[i].t !== 'ch' || slots[i].gn > 1) continue;
          let j = i; while (j < slots.length && slots[j].t === 'ch' && slots[j].gn === 1) j++;
          const a = i > 0 && !slots[i - 1].tc ? slots[i - 1] : null;
          const b = j < slots.length ? slots[j] : (done && !rows && A[0] && A[0].t !== 'ch' ? A[0] : null);
          const ha = a && !a.free ? a.h : baseH, hb = b && !b.free ? b.h : baseH;
          const pa = P(a ? a.c : slots[i].c, Lin + ha), pb = P(b ? b.c : slots[j - 1].c, Lin + hb), m = j - i;
          const d = Math.max(dist(pa, pb), .01), e = dirTo(pa, pb, { x: 1, y: 0 });
          let o = perp(e); const um = U(slots[i + (m >> 1)].c); if (o.x * um.x + o.y * um.y < 0) o = { x: -o.x, y: -o.y };
          const len = m * 8.6 + 2, sag = len > d * 1.02 ? Math.min(Math.sqrt(3 * d * (len - d) / 8), len / 2) : 0;
          for (let q = 0; q < m; q++) {
            const s = slots[i + q], t = (q + .5) / m;
            if (sag < .5) { s.pt = mid(pa, pb, t); s.dv = e; s.rx = Math.min(4.8, d / m / 2 - .3); continue; }
            const rho = (d * d / 4 + sag * sag) / (2 * sag), al = 2 * Math.atan(2 * sag / d), ph = -al + t * 2 * al;
            const cen = mv(mid(pa, pb), o, sag - rho);
            s.pt = mv(cen, o, rho * Math.cos(ph), e, rho * Math.sin(ph));
            s.dv = mv({ x: 0, y: 0 }, o, -Math.sin(ph), e, Math.cos(ph));
            s.rx = Math.min(4.8, rho * 2 * al / m / 2 - .3);
          }
          hRow = Math.max(hRow, (ha + hb) / 2 + sag + 3.5);
          i = j - 1;
        }
      }
      const top = Lin + hRow;

      // 4. chart items
      const tops = slots.map(s => P(s.c, top));
      const applyAdj = (it, adj, c) => {
        if (!adj) return;
        const up = U(c), t = tv(c), sh = p => mv(p, t, adj.x || 0, up, adj.y || 0);
        it.bases = it.bases.map(sh); it.T = sh(it.T); if (it.pt) it.pt = sh(it.pt);
        if (adj.a) {
          if (it.bases.length === 1) { const v = rot({ x: it.T.x - it.bases[0].x, y: it.T.y - it.bases[0].y }, adj.a); it.T = mv(it.bases[0], v, 1); }
          it.turn = adj.a;
        }
        if (adj.l) it.scale = adj.l;
      };
      slots.forEach((s, i) => {
        let it;
        if (s.tc) { // thin chain hugging the stitch it stands beside
          const ref = slots.slice(i + 1).find(x => !x.tc) || slots.slice(0, i).reverse().find(x => !x.tc);
          const c = ref ? ref.c : s.c, back = slots.indexOf(ref) > i || !ref ? -7.6 : 7.6, t = tv(c);
          it = { t: 'tch', n: s.n, bases: [mv(P(c, Lin), t, back)], T: mv(P(c, Lin + s.h), t, back), up: U(c), len: s.h };
          applyAdj(it, s.adj, c);
        } else if (s.free) {
          let rx = s.rx;
          if (rx == null && s.t === 'ch') {
            const ds = [tops[i - 1], tops[i + 1]].filter(Boolean).map(p => dist(p, tops[i]));
            rx = ds.length ? Math.max(2, Math.min(4.8, Math.min(...ds) / 2 - .4)) : 4.6;
          }
          it = { t: s.t, bases: [], T: tops[i], up: U(s.c), pt: s.pt, dv: s.dv, rx };
          applyAdj(it, s.adj, s.c);
        } else {
          const st = ST[s.t] || {}, dec = (st.par || 1) > 1 && !ring;
          const bc = ring || s.gn === 1 ? s.c : gcen[s.g];
          it = { t: s.t, n: s.n, T: tops[i], up: U(s.c), grp: s.gn > 1 && !ring, len: s.t === 'sch' ? s.h : undefined,
            bases: dec ? s.pars.map(q => P(pcoord(q), Lin)) : [P(bc, Lin)],
            ext: st.post && prev ? Math.min(prev.h * .5, 13) : 0 }; // post stitches reach down round the stitch below
          applyAdj(it, s.adj, s.c);
        }
        it.path = s.path; it.r = r; it.color = s.col || color;
        out.items.push(it);
      });
      const first = A[0], hasT = slots.length && slots[0].tc;
      joins.forEach(j => {
        let pt, c = first ? first.c : (ring ? 0 : PA[0]);
        if (!first) pt = P(c, top);
        else if (!rows && j.at >= slots.length) // closing a round: right against the first stitch / turning chain
          pt = hasT ? mv(P(c, Lin + first.h + 2.2), tv(c), -7.6) : mv(P(c, Lin + first.h - 2.5), tv(c), -5.4);
        else { const pv = slots.slice(0, j.at).reverse().find(x => !x.tc) || first; c = pv.c; pt = mv(P(c, Lin + pv.h - 2.5), tv(c), 5.4); }
        const it = { t: 'join', bases: [], T: pt, up: U(c), path: j.path, r, color: j.op.c || color };
        applyAdj(it, j.op.adj, c);
        out.items.push(it);
      });

      const R = { r, pc, used, n, count: n, top, base: Lin - GAP / 2, color, sign,
        next: !ring && used < pc ? P(pcoord(used), Lin) : null };
      if (first) {
        const c = first.c, t = tv(c);
        if (rows) { const p = mv(P(c, Lin + Math.min(hRow, 28) / 2), t, hasT ? -25 : -17); R.label = mv(p, t, -11); R.arrow = [mv(p, t, -4), mv(p, t, 4)]; }
        else R.label = mv(P(c, Lin + first.h / 2), t, hasT ? -15 : -8);
      }
      out.rows.push(R);
      if (n) {
        prev = { anchors: A.map(s => s.c), top, unit, h: hRow };
        out.maxTop = Math.max(out.maxTop, top);
        if (rows) A.forEach(s => { out.minX = Math.min(out.minX, s.c); out.maxX = Math.max(out.maxX, s.c); });
      }
    });
    const pad = 26, m = out.maxTop + pad;
    out.bounds = rows ? { x: out.minX - pad - 34, y: -m, w: out.maxX - out.minX + 2 * pad + 68, h: m + pad }
      : oval ? { x: -m, y: -m, w: bx + 2 * m, h: 2 * m } : { x: -m, y: -m, w: 2 * m, h: 2 * m };
    return out;
  }

  // ---------- symbol drawing ----------
  const seg = (a, b) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
  const slash = (p, d) => { const n = perp(d); return seg(mv(p, d, -1.9, n, -3.2), mv(p, d, 1.9, n, 3.2)); };
  const SLASH = { dc: [.5], fpdc: [.5], bpdc: [.5], tr: [.4, .6], dtr: [.34, .5, .66], hdc: [] };

  /** Returns { d: stroke path, x: extra shapes, hit: [a,b] } for one chart item. */
  function drawSt(it, o = {}) {
    const { t, bases: Bs, T, up } = it; const tan = perp(up), k = it.scale || 1;
    let d = '', x = '';
    const ell = (c, rx, ry, dir, fill) => `<ellipse cx="${f(c.x)}" cy="${f(c.y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(Math.atan2(dir.y, dir.x) * 180 / Math.PI)} ${f(c.x)} ${f(c.y)})"${fill ? ` class="f" fill="${it.color}"` : ''}/>`;
    const turned = v => it.turn ? rot(v, it.turn) : v;
    if (t === 'ch') {
      const c = it.pt || mv(T, up, -3.2), rx = (it.rx || 4.6) * k, dv = turned(it.dv || tan);
      return { d, x: ell(c, rx, Math.min(2.7, Math.max(1.5, rx * .62)), dv), hit: [mv(c, dv, -5), mv(c, dv, 5)] };
    }
    if (t === 'join') return { d, x: ell(T, 2.1 * k, 1.6 * k, turned(tan), true), hit: [mv(T, tan, -3.5), mv(T, tan, 3.5)] };
    if (t === 'picot') {
      const q = mv(T, up, -10);
      x = ell(q, 1.6, 1.6, tan, true) + ell(mv(q, up, 8), 2.7, 1.5, tan)
        + ell(mv(q, up, 4, tan, -3.3), 2.7, 1.5, mv({ x: 0, y: 0 }, up, 1, tan, -.6))
        + ell(mv(q, up, 4, tan, 3.3), 2.7, 1.5, mv({ x: 0, y: 0 }, up, 1, tan, .6));
      return { d, x, hit: [q, mv(q, up, 9)] };
    }
    if (ST[t].par > 1) { // decrease: legs from each stitch below meet at one top
      const c = Bs.reduce((a, b) => ({ x: a.x + b.x / Bs.length, y: a.y + b.y / Bs.length }), { x: 0, y: 0 });
      const dir = dirTo(c, T, up), n = perp(dir), A = mv(c, dir, ST[t].h * k), base = ST[t].base;
      Bs.forEach(B => {
        const ld = dirTo(B, A, dir), S = mv(B, ld, 1);
        d += seg(S, A);
        (SLASH[base] || []).forEach(fr => { d += slash(mid(S, A, fr * .9), ld); });
      });
      if (base === 'sc') { const a = mid(Bs[0], A, .5), b = mid(Bs[Bs.length - 1], A, .5); d += Bs.length > 1 ? seg(mid(b, a, 1.3), mid(a, b, 1.3)) : seg(mv(a, n, -3.2), mv(a, n, 3.2)); }
      else d += seg(mv(A, n, -4), mv(A, n, 4));
      return { d, x, hit: [c, A] };
    }
    const B = Bs[0], dir = dirTo(B, T, up), n = perp(dir);
    if (t === 'tch' || t === 'sch') { // chains stacked to the full height of the stitch they replace
      const H = (it.len || chainH(it.n)) * k, step = H / it.n;
      for (let q = 0; q < it.n; q++) x += ell(mv(B, dir, (q + .5) * step), step / 2 - .35, t === 'tch' ? 1.8 : 2.5, dir);
      return { d, x, hit: [B, mv(B, dir, H)] };
    }
    if (t === 'sl') { const c = mv(B, dir, 3.4); return { d, x: ell(c, 4.2 * k, 2.4 * k, n, true), hit: [mv(c, n, -5), mv(c, n, 5)] }; }
    const H = ST[t].h * k, S = mv(B, dir, 1), E = mv(B, dir, H), M = mid(S, E);
    if (t === 'sc' || t === 'scblo') {
      if (it.grp) d = seg(S, E) + seg(mv(M, n, -3.2), mv(M, n, 3.2));
      else if (o.plus) d = seg(mv(M, dir, -5.5), mv(M, dir, 5.5)) + seg(mv(M, n, -5.5), mv(M, n, 5.5));
      else d = seg(mv(M, dir, -5, n, -4.2), mv(M, dir, 5, n, 4.2)) + seg(mv(M, dir, -5, n, 4.2), mv(M, dir, 5, n, -4.2));
      if (t === 'scblo') d += seg(mv(B, dir, .2, n, -5.5), mv(B, dir, .2, n, 5.5));
    } else if (t === 'cl' || t === 'puff' || t === 'pc') {
      [-1, 0, 1].forEach(sg => {
        const c = mv(M, n, sg * 9);
        d += `M${f(S.x)} ${f(S.y)}Q${f(c.x)} ${f(c.y)} ${f(E.x)} ${f(E.y)}`;
        if (t !== 'puff') d += slash(mv(M, n, sg * 4.5), dir);
      });
      if (t === 'pc') x = ell(mv(E, dir, 2), 4.6, 2.2, n); else d += seg(mv(E, n, -4.5), mv(E, n, 4.5));
    } else { // hdc, dc, tr, dtr, post stitches
      const post = ST[t].post || 0, foot = post ? mv(B, dir, -(it.ext || 0)) : S;
      d = seg(foot, E) + seg(mv(E, n, -4), mv(E, n, 4));
      SLASH[t].forEach(fr => { d += slash(mid(S, E, fr), dir); });
      if (post) { // hook that wraps the post of the stitch below
        const c1 = mv(foot, dir, -5), p1 = mv(foot, dir, -4.5, n, post * 4.2), p2 = mv(foot, dir, -.5, n, post * 4.8);
        d += `M${f(foot.x)} ${f(foot.y)}Q${f(c1.x)} ${f(c1.y)} ${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}`;
      }
    }
    return { d, x, hit: [S, E] };
  }

  const ATTR = 'fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"';
  function render(doc, L, o = {}) {
    let s = '';
    const lab = (p, txt, col) => `<text x="${f(p.x)}" y="${f(p.y + 2.5)}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="7" font-weight="700" fill="${col}" stroke="#fff" stroke-width="2.2" paint-order="stroke">${txt}</text>`;
    const G = 'fill="none" stroke="#d8d2c6" stroke-width=".6" stroke-dasharray="2 3"';
    if (doc.guides !== false) L.rows.forEach(R => {
      if (!R.n) return;
      const q = R.top + GAP / 2;
      if (L.shape === 'rows') s += `<path d="M${f(L.minX - 12)} ${f(-R.base)}H${f(L.maxX + 12)}" ${G}/>`;
      else if (L.shape === 'oval') s += `<path d="M${f(L.bx)} ${f(-q)}H0A${f(q)} ${f(q)} 0 0 0 0 ${f(q)}H${f(L.bx)}A${f(q)} ${f(q)} 0 0 0 ${f(L.bx)} ${f(-q)}Z" ${G}/>`;
      else s += `<circle r="${f(q)}" ${G}/>`;
    });
    if (L.shape === 'round') {
      s += `<circle r="${f(L.ringR)}" fill="none" stroke="#8d877c" stroke-width="1.1"/>`;
      if (o.lang === 'ja') s += `<text y="2.6" text-anchor="middle" font-size="7" fill="#8d877c" font-family="sans-serif">わ</text>`;
    } else s += `<g ${ATTR} stroke="#555">` + L.chain.map(p => `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="6.7" ry="3"/>`).join('') + '</g>';
    L.rows.forEach(R => {
      if (!R.label) return;
      s += lab(R.label, R.r + 1, R.color);
      if (R.arrow) { // rows: an arrow showing which way the row is worked
        const [a, b] = R.arrow, sg = R.sign;
        s += `<path d="M${f(a.x)} ${f(a.y)}H${f(b.x)}M${f(b.x - sg * 2.6)} ${f(b.y - 2.2)}L${f(b.x)} ${f(b.y)}L${f(b.x - sg * 2.6)} ${f(b.y + 2.2)}" fill="none" stroke="${R.color}" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>`;
      }
    });
    L.items.forEach(it => {
      const g = drawSt(it, o), p = it.path;
      const lo = o.sel ? Math.min(o.sel.i, o.sel.i2 ?? o.sel.i) : 0, hi = o.sel ? Math.max(o.sel.i, o.sel.i2 ?? o.sel.i) : -1;
      const sel = o.sel && o.sel.r === p[0] && p[1] >= lo && p[1] <= hi && (o.sel.j == null || o.sel.j === p[2]);
      s += `<g class="st${sel ? ' sel' : ''}" data-p="${p.join(',')}" ${ATTR} stroke="${it.color}">`
        + (o.exporting ? '' : `<path class="hit" d="${seg(g.hit[0], g.hit[1])}" stroke="transparent" stroke-width="11"/>`)
        + (g.d ? `<path d="${g.d}"/>` : '') + g.x + '</g>';
    });
    if (!o.exporting) {
      const R = L.rows[o.active];
      if (R && R.next) s += `<circle class="next" cx="${f(R.next.x)}" cy="${f(R.next.y)}" r="4.5"/>`;
    }
    return s;
  }

  /** Small standalone icon for palette / legend. spec = stitch id, 'tch1' / 'sch3', 'sctch', or an array (same-stitch group). */
  function preview(spec, o = {}) {
    const col = o.color || '#2b2b2b', up = { x: 0, y: -1 };
    let items = [], H = 16;
    const one = (t, x, h, extra) => ({ t, T: { x, y: -h / 2 }, up, bases: [{ x, y: h / 2 }], color: col, ...extra });
    const tc = /^(tch|sch)(\d)?$/.exec(typeof spec === 'string' ? spec : '');
    if (spec === 'sk') return `<svg viewBox="-14 -14 28 28"><path d="M-8 3Q0 -9 8 3" fill="none" stroke="${col}" stroke-width="1.3" stroke-dasharray="2 2.5"/></svg>`;
    if (Array.isArray(spec)) {
      H = Math.max(...spec.map(t => ST[t].h)); const m = spec.length;
      items = spec.map((t, j) => ({ t, T: { x: (j - (m - 1) / 2) * 9.5, y: -H / 2 }, up, grp: true, color: col,
        bases: (t === 'ch' || t === 'picot') ? [] : [{ x: 0, y: H / 2 }] }));
    } else if (spec === 'sctch') { H = 14; items = [one('sc', -3.5, H), one('tch', 4.5, H, { n: 1, len: H })]; }
    else if (tc) { const n = +(tc[2] || (tc[1] === 'sch' ? 3 : 1)); H = chainH(n); items = [one(tc[1], 0, H, { n, len: H })]; }
    else if (spec === 'ch' || spec === 'join') items = [{ t: spec, T: { x: 0, y: spec === 'ch' ? -3.2 : 0 }, up, bases: [], color: col }];
    else if (spec === 'picot') items = [{ t: spec, T: { x: 0, y: -6 }, up, bases: [], color: col }];
    else {
      H = ST[spec].h; const k = ST[spec].par ?? 1;
      items = [{ t: spec, T: { x: 0, y: -H / 2 }, up, color: col, ext: ST[spec].post ? 5 : 0,
        bases: Array.from({ length: k }, (_, j) => ({ x: (j - (k - 1) / 2) * 11, y: H / 2 })) }];
    }
    const size = Math.max(H, 20) + 12;
    return `<svg viewBox="${-size / 2} ${-size / 2} ${size} ${size}"><g ${ATTR} stroke="${col}">`
      + items.map(it => { const g = drawSt(it, o); return (g.d ? `<path d="${g.d}"/>` : '') + g.x; }).join('') + '</g></svg>';
  }

  function usedTypes(doc) {
    const set = new Set();
    doc.rows.forEach(row => row.ops.forEach(op => (op.g || [op]).forEach(m => set.add(m.t))));
    if (doc.shape !== 'round') set.add('ch');
    return Object.keys(ST).filter(t => set.has(t));
  }
  function written(doc, L) {
    const lines = [doc.shape === 'round' ? T('startRing') : T('wFound', doc.chain)];
    doc.rows.forEach((row, r) => {
      if (row.ops.length) lines.push(`${T(doc.shape === 'rows' ? 'wRow' : 'wRnd', r + 1)}: ${toText(row.ops)}  ${T('wSts', L.rows[r].count)}`);
    });
    return lines;
  }

  return { ST, COLORS, parOf, isPlain, toText, parse, layout, render, preview, usedTypes, written };
})();
