'use strict';
/* Crochet engine: stitch table, written-text <-> stitches, automatic chart layout, symbol drawing.
   A chart is a list of rows (rounds). Each row is a list of ops worked in order:
     {t:'sc'}            a stitch worked into the next stitch(es) of the previous row
     {g:[{t},{t}]}       several stitches worked into the same stitch (increase, shell, V-stitch)
     {t:'ch'} {t:'sk'}   chain (uses no stitch) / skip one stitch
     {t:'tch',n} {t:'sch',n} {t:'join'}   turning chain, chain counted as a stitch, slip-stitch join
   Positions are never stored: layout() derives them, so charts are always tidy. */
const Crochet = (() => {
  const T = I18N.t;
  const GAP = 3, MINW = 13, ROWW = 15, TAU = Math.PI * 2;
  const COLORS = ['#2b2b2b', '#b5542d', '#2f6f9f', '#3b8a4f', '#8a4f9e', '#c2842a', '#1f8a8a', '#b23a5a'];

  // Symbols follow the JIS / international chart convention (hdc = T, dc = T + 1 slash, tr = T + 2 slashes).
  const ST = {
    ch:     { h: 8,  par: 0, en: 'Chain', ja: 'くさり編み', zh: '鎖針' },
    sl:     { h: 7,  out: 'sl st', en: 'Slip stitch', ja: '引き抜き編み', zh: '引拔針' },
    sc:     { h: 15, en: 'Single crochet', ja: 'こま編み', zh: '短針' },
    hdc:    { h: 21, en: 'Half double crochet', ja: '中長編み', zh: '中長針' },
    dc:     { h: 29, en: 'Double crochet', ja: '長編み', zh: '長針' },
    tr:     { h: 39, en: 'Treble crochet', ja: '長々編み', zh: '長長針' },
    dtr:    { h: 49, en: 'Double treble', ja: '三つ巻き長編み', zh: '三捲長針' },
    scblo:  { h: 15, out: 'sc-blo', en: 'Single crochet in back loop', ja: 'こま編みのすじ編み', zh: '短針筋編' },
    fpdc:   { h: 29, en: 'Front post double crochet', ja: '長編みの表引き上げ編み', zh: '外鉤長針' },
    bpdc:   { h: 29, en: 'Back post double crochet', ja: '長編みの裏引き上げ編み', zh: '內鉤長針' },
    cl:     { h: 29, en: '3-dc cluster (bobble)', ja: '長編み3目の玉編み', zh: '長針3針玉編' },
    puff:   { h: 21, en: 'Puff stitch (3 hdc)', ja: '中長編み3目の玉編み', zh: '中長針3針玉編（泡芙針）' },
    pc:     { h: 29, en: 'Popcorn (5 dc)', ja: '長編み5目のパプコーン編み', zh: '爆米花針' },
    picot:  { h: 11, par: 0, en: 'Picot (ch 3)', ja: 'くさり3目のピコット', zh: '結粒針（狗牙針）' },
    sc2tog: { h: 15, par: 2, base: 'sc', en: 'Sc 2 together (decrease)', ja: 'こま編み2目一度', zh: '短針2併針' },
    sc3tog: { h: 15, par: 3, base: 'sc', en: 'Sc 3 together', ja: 'こま編み3目一度', zh: '短針3併針' },
    hdc2tog:{ h: 21, par: 2, base: 'hdc', en: 'Hdc 2 together', ja: '中長編み2目一度', zh: '中長針2併針' },
    dc2tog: { h: 29, par: 2, base: 'dc', en: 'Dc 2 together', ja: '長編み2目一度', zh: '長針2併針' },
    dc3tog: { h: 29, par: 3, base: 'dc', en: 'Dc 3 together', ja: '長編み3目一度', zh: '長針3併針' },
    tr2tog: { h: 39, par: 2, base: 'tr', en: 'Tr 2 together', ja: '長々編み2目一度', zh: '長長針2併針' },
    sk:     { h: 0, en: 'Skip a stitch', ja: '目をとばす', zh: '跳過一針' },
    tch:    { h: 0, en: 'Turning chain (not counted)', ja: '立ち上がりのくさり', zh: '立起鎖針（不算針數）' },
    sch:    { h: 0, en: 'Chain counted as a stitch', ja: '立ち上がりのくさり（1目に数える）', zh: '立起鎖針（算一針）' },
    join:   { h: 0, en: 'Join with slip stitch', ja: '引き抜いて輪にする', zh: '引拔接合' },
  };
  const ALIAS = { slst: 'sl', ss: 'sl', dec: 'sc2tog', 'sc-blo': 'scblo', blo: 'scblo', bob: 'cl', bobble: 'cl',
    cluster: 'cl', popcorn: 'pc', p: 'picot', skip: 'sk', turn: 'tch' };
  const MACRO = { inc: ['sc', 'sc'], scinc: ['sc', 'sc'], hdcinc: ['hdc', 'hdc'], dcinc: ['dc', 'dc'], trinc: ['tr', 'tr'],
    vst: ['dc', 'ch', 'dc'], shell: ['dc', 'dc', 'dc', 'dc', 'dc'] };

  const name = t => ST[t].out || t;
  /** How many stitches of the previous row an op uses up. */
  const parOf = op => op.g ? 1 : (op.t === 'sk' || op.t === 'sch') ? 1 : (op.t === 'tch' || op.t === 'join') ? 0 : (ST[op.t].par ?? 1);
  const isPlain = op => !op.g && !['sk', 'tch', 'sch', 'join'].includes(op.t) && (ST[op.t].par ?? 1) <= 1;

  // ---------- ops -> written instructions ----------
  function tok(op) {
    if (op.g) {
      const ts = op.g.map(m => m.t);
      if (ts.length === 2 && ts.every(t => t === 'sc')) return 'inc';
      return '[' + rle(ts.map(name)) + ']';
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
        if (inG) throw Error(T('eNotInGroup', w));
        return [{ op: { t, n: given ? cnt : (t === 'sch' ? 3 : 1) } }];
      }
      if (t === 'join') return [{ op: { t } }];
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

  // ---------- layout ----------
  function layout(doc) {
    const round = doc.shape === 'round';
    const pos = round ? (u, L) => ({ x: -L * Math.sin(u), y: -L * Math.cos(u) }) : (u, L) => ({ x: u, y: -L });
    const upAt = round ? u => ({ x: -Math.sin(u), y: -Math.cos(u) }) : () => ({ x: 0, y: -1 });
    const out = { round, rows: [], items: [], ringR: 8, chain: null, maxTop: 20, minX: 0, maxX: 0 };
    let prev = null; // { anchors:[u...], top, w } of the last non-empty row, in working order
    if (!round) {
      const n = Math.max(1, doc.chain || 10);
      prev = { anchors: Array.from({ length: n }, (_, i) => i * ROWW), top: 4, w: ROWW };
      out.chain = prev.anchors.map(u => pos(u, 0));
      out.maxX = (n - 1) * ROWW;
    }
    doc.rows.forEach((row, r) => {
      const ring = !prev;
      const P = ring ? null : (round ? prev.anchors : prev.anchors.slice().reverse());
      const pc = ring ? Infinity : P.length;
      const sign = round ? 1 : (r % 2 ? 1 : -1);
      const pu = k => round ? P[k % pc] + TAU * Math.floor(k / pc) : P[Math.min(k, pc - 1)];
      const color = row.color || COLORS[r % COLORS.length];
      const slots = [], decor = []; let k = 0;
      row.ops.forEach((op, i) => {
        if (op.g) {
          const par = k++;
          op.g.forEach((m, j) => slots.push({ path: [r, i, j], t: m.t, c: m.c, pars: [par], gi: j, gn: op.g.length }));
        } else if (op.t === 'sk') k++;
        else if (op.t === 'tch') decor.push({ kind: 'tch', n: op.n, c: op.c, path: [r, i], at: slots.length });
        else if (op.t === 'join') decor.push({ kind: 'join', c: op.c, path: [r, i] });
        else if (op.t === 'sch') slots.push({ path: [r, i], t: 'sch', n: op.n, c: op.c, pars: [k++], gn: 1 });
        else {
          const par = ST[op.t].par ?? 1, pars = [];
          for (let q = 0; q < par; q++) pars.push(k++);
          slots.push({ path: [r, i], t: op.t, c: op.c, pars, gn: 1 });
        }
      });
      const n = slots.length, used = k;
      let hRow = 12;
      slots.forEach(s => { hRow = Math.max(hRow, s.t === 'sch' ? s.n * 7.5 : ST[s.t].h); });

      // slot positions along the row: blend "evenly spaced" with "directly above its parent"
      let wSlot, even;
      if (ring) { wSlot = TAU / Math.max(n, 1); even = i => (i + .5) * wSlot; }
      else if (round) {
        const span = used ? Math.min(used, pc) / pc * TAU : n * prev.w;
        wSlot = span / Math.max(n, 1); even = i => (i + .5) * wSlot;
      } else {
        wSlot = ROWW;
        if (used >= pc) { const c = (P[0] + P[pc - 1]) / 2; even = i => c + sign * (i - (n - 1) / 2) * ROWW; }
        else even = i => P[0] + sign * i * ROWW;
      }
      slots.forEach((s, i) => {
        s.e = even(i);
        if (ring) { s.u = s.e; return; }
        if (!s.pars.length) { s.u = null; return; }
        let ideal = s.pars.reduce((a, x) => a + pu(x), 0) / s.pars.length;
        if (s.gn > 1) ideal += sign * (s.gi - (s.gn - 1) / 2) * wSlot * .9;
        s.u = (s.e + ideal) / 2;
      });
      for (let i = 0; i < n; i++) {
        if (slots[i].u !== null) continue;
        let j = i; while (j < n && slots[j].u === null) j++;
        const a = i > 0 ? slots[i - 1].u : null, b = j < n ? slots[j].u : null, m = j - i;
        for (let q = i; q < j; q++) {
          const t = q - i + 1;
          slots[q].u = a !== null && b !== null ? a + (b - a) * t / (m + 1)
            : a !== null ? a + sign * wSlot * t : b !== null ? b - sign * wSlot * (m + 1 - t) : slots[q].e;
        }
        i = j;
      }

      // radial / vertical level; rounds grow so stitches never crowd
      let Lin;
      if (round) {
        const nEst = (ring || used >= pc || !used) ? n : n * pc / used;
        Lin = Math.max(ring ? 10 : prev.top + GAP, nEst * MINW / TAU - hRow);
        if (ring) out.ringR = Lin - 2.5;
      } else Lin = prev.top + GAP;
      const top = Lin + hRow;

      slots.forEach(s => {
        const free = s.t === 'ch' || s.t === 'picot';
        out.items.push({
          path: s.path, t: s.t, n: s.n, r, T: pos(s.u, top), up: upAt(s.u), grp: s.gn > 1,
          bases: free ? [] : ring ? [pos(s.u, Lin)] : s.pars.map(x => pos(pu(x), Lin)), color: s.c || color,
        });
      });
      decor.forEach(d => {
        if (d.kind === 'tch') {
          const ref = slots[d.at] ? slots[d.at].u : n ? slots[n - 1].u + sign * wSlot : ring ? 0 : pu(0);
          const u = ref - sign * wSlot * .55;
          out.items.push({ path: d.path, t: 'tch', n: d.n, r, bases: [pos(u, Lin)], T: pos(u, top), up: upAt(u), color: d.c || color });
        } else {
          const u = n ? slots[n - 1].u + sign * wSlot * .5 : 0;
          out.items.push({ path: d.path, t: 'join', r, bases: [], T: pos(u, top - 3), up: upAt(u), color: d.c || color });
        }
      });
      const labelU = round ? 0 : (n ? slots[0].u : P[0]) - sign * ROWW * 1.5;
      out.rows.push({
        r, pc, used, n, count: slots.filter(s => s.t !== 'ch' && s.t !== 'picot').length, top, color,
        label: pos(labelU, Lin + hRow / 2), next: !ring && used < pc ? pos(pu(used), Lin) : null,
      });
      if (n) {
        prev = { anchors: slots.map(s => s.u), top, w: wSlot };
        out.maxTop = Math.max(out.maxTop, top);
        if (!round) slots.forEach(s => { out.minX = Math.min(out.minX, s.u); out.maxX = Math.max(out.maxX, s.u); });
      }
    });
    const pad = 26;
    out.bounds = round
      ? { x: -out.maxTop - pad, y: -out.maxTop - pad, w: 2 * (out.maxTop + pad), h: 2 * (out.maxTop + pad) }
      : { x: out.minX - pad - 22, y: -out.maxTop - pad, w: out.maxX - out.minX + 2 * pad + 44, h: out.maxTop + 2 * pad };
    return out;
  }

  // ---------- symbol drawing ----------
  const f = n => Math.round(n * 100) / 100;
  const mv = (p, d, a, n, b) => ({ x: p.x + d.x * a + (n ? n.x * b : 0), y: p.y + d.y * a + (n ? n.y * b : 0) });
  const perp = d => ({ x: -d.y, y: d.x });
  const dirTo = (a, b, fb) => { const x = b.x - a.x, y = b.y - a.y, l = Math.hypot(x, y); return l < .5 ? fb : { x: x / l, y: y / l }; };
  const seg = (a, b) => `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`;
  const mid = (a, b, t = .5) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const slash = (p, d) => { const n = perp(d); return seg(mv(p, d, -1.9, n, -3.2), mv(p, d, 1.9, n, 3.2)); };
  const SLASH = { dc: [.5], fpdc: [.5], bpdc: [.5], tr: [.4, .6], dtr: [.34, .5, .66], hdc: [] };

  /** Returns { d: stroke path, x: extra shapes, hit: [a,b] } for one chart item. */
  function drawSt(it, o = {}) {
    const { t, bases: Bs, T, up } = it; const tan = perp(up);
    let d = '', x = '';
    const ell = (c, rx, ry, dir, fill) => `<ellipse cx="${f(c.x)}" cy="${f(c.y)}" rx="${f(rx)}" ry="${f(ry)}" transform="rotate(${f(Math.atan2(dir.y, dir.x) * 180 / Math.PI)} ${f(c.x)} ${f(c.y)})"${fill ? ` class="f" fill="${it.color}"` : ''}/>`;
    if (t === 'ch') { const c = mv(T, up, -4); return { d, x: ell(c, 4.6, 2.7, tan), hit: [mv(c, tan, -5), mv(c, tan, 5)] }; }
    if (t === 'join') return { d, x: ell(T, 2.3, 2.3, tan, true), hit: [mv(T, tan, -3), mv(T, tan, 3)] };
    if (t === 'picot') {
      const q = mv(T, up, -10);
      x = ell(q, 1.6, 1.6, tan, true) + ell(mv(q, up, 8), 2.7, 1.5, tan)
        + ell(mv(q, up, 4, tan, -3.3), 2.7, 1.5, mv({ x: 0, y: 0 }, up, 1, tan, -.6))
        + ell(mv(q, up, 4, tan, 3.3), 2.7, 1.5, mv({ x: 0, y: 0 }, up, 1, tan, .6));
      return { d, x, hit: [q, mv(q, up, 9)] };
    }
    if (ST[t].par > 1) { // decrease: legs from each stitch below meet at one top
      const c = Bs.reduce((a, b) => ({ x: a.x + b.x / Bs.length, y: a.y + b.y / Bs.length }), { x: 0, y: 0 });
      const dir = dirTo(c, T, up), n = perp(dir), A = mv(c, dir, ST[t].h), base = ST[t].base;
      Bs.forEach(B => {
        const ld = dirTo(B, A, dir), S = mv(B, ld, 1);
        d += seg(S, A);
        (SLASH[base] || []).forEach(fr => { d += slash(mid(S, A, fr * .9), ld); });
      });
      if (base === 'sc') { const a = mid(Bs[0], A, .5), b = mid(Bs[Bs.length - 1], A, .5); d += seg(mid(b, a, 1.3), mid(a, b, 1.3)); }
      else d += seg(mv(A, n, -4), mv(A, n, 4));
      return { d, x, hit: [c, A] };
    }
    const B = Bs[0], dir = dirTo(B, T, up), n = perp(dir);
    if (t === 'tch' || t === 'sch') {
      const len = Math.hypot(T.x - B.x, T.y - B.y), step = Math.min(8, Math.max(4.5, len / it.n));
      for (let k = 0; k < it.n; k++) x += ell(mv(B, dir, (k + .5) * step), step / 2 - .3, 2.4, dir);
      return { d, x, hit: [B, mv(B, dir, it.n * step)] };
    }
    if (t === 'sl') { const c = mv(B, dir, 3.5); return { d, x: ell(c, 3.2, 2, n, true), hit: [mv(c, n, -4), mv(c, n, 4)] }; }
    const H = ST[t].h, S = mv(B, dir, 1), E = mv(B, dir, H), M = mid(S, E);
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
      const post = t === 'fpdc' ? -1 : t === 'bpdc' ? 1 : 0;
      d = seg(post ? mv(B, dir, 3) : S, E) + seg(mv(E, n, -4), mv(E, n, 4));
      SLASH[t].forEach(fr => { d += slash(mid(S, E, fr), dir); });
      if (post) {
        const p0 = mv(B, dir, 3), c1 = mv(B, dir, -2.5), p1 = mv(B, dir, -1.5, n, post * 4), p2 = mv(B, dir, 2.2, n, post * 4.6);
        d += `M${f(p0.x)} ${f(p0.y)}Q${f(c1.x)} ${f(c1.y)} ${f(p1.x)} ${f(p1.y)}L${f(p2.x)} ${f(p2.y)}`;
      }
    }
    return { d, x, hit: [S, E] };
  }

  const ATTR = 'fill="none" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"';
  function render(doc, L, o = {}) {
    let s = '';
    const lab = (p, txt, col) => `<text x="${f(p.x)}" y="${f(p.y + 2.6)}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="7.5" font-weight="700" fill="${col}" stroke="#fff" stroke-width="2.4" paint-order="stroke">${txt}</text>`;
    if (L.round) {
      if (doc.guides !== false) L.rows.forEach(R => { if (R.n) s += `<circle r="${f(R.top + GAP / 2)}" fill="none" stroke="#d8d2c6" stroke-width=".6" stroke-dasharray="2 3"/>`; });
      s += `<circle r="${f(L.ringR)}" fill="none" stroke="#8d877c" stroke-width="1.1"/>`;
      if (o.lang === 'ja') s += `<text y="3" text-anchor="middle" font-size="8" fill="#8d877c" font-family="sans-serif">わ</text>`;
    } else {
      s += `<g ${ATTR} stroke="#555">` + L.chain.map(p => `<ellipse cx="${f(p.x)}" cy="${f(p.y)}" rx="5.6" ry="3"/>`).join('') + '</g>';
    }
    L.rows.forEach(R => { if (R.n) s += lab(R.label, R.r + 1, R.color); });
    L.items.forEach(it => {
      const g = drawSt(it, o), p = it.path;
      const isSel = o.sel && o.sel.r === p[0] && o.sel.i === p[1] && (o.sel.j == null || o.sel.j === p[2]);
      s += `<g class="st${isSel ? ' sel' : ''}" data-p="${p.join(',')}" ${ATTR} stroke="${it.color}">`
        + (o.exporting ? '' : `<path class="hit" d="${seg(g.hit[0], g.hit[1])}" stroke="transparent" stroke-width="11"/>`)
        + (g.d ? `<path d="${g.d}"/>` : '') + g.x + '</g>';
    });
    if (!o.exporting) {
      const R = L.rows[o.active];
      if (R && R.next) s += `<circle class="next" cx="${f(R.next.x)}" cy="${f(R.next.y)}" r="4.5"/>`;
    }
    return s;
  }

  /** Small standalone icon for palette / legend. spec = stitch id or array of ids (same-stitch group). */
  function preview(spec, o = {}) {
    const col = o.color || '#2b2b2b', up = { x: 0, y: -1 };
    let items = [], H = 16;
    if (spec === 'sk') return `<svg viewBox="-14 -14 28 28"><path d="M-8 3Q0 -9 8 3" fill="none" stroke="${col}" stroke-width="1.3" stroke-dasharray="2 2.5"/></svg>`;
    if (Array.isArray(spec)) {
      H = Math.max(...spec.map(t => ST[t].h)); const m = spec.length;
      items = spec.map((t, j) => ({ t, T: { x: (j - (m - 1) / 2) * 9.5, y: -H / 2 }, up, grp: true, color: col,
        bases: (t === 'ch' || t === 'picot') ? [] : [{ x: 0, y: H / 2 }] }));
    } else if (spec === 'tch' || spec === 'sch') {
      const n = spec === 'sch' ? 3 : 1; H = n * 8;
      items = [{ t: spec, n, T: { x: 0, y: -H / 2 }, up, bases: [{ x: 0, y: H / 2 }], color: col }];
    } else if (spec === 'ch' || spec === 'join') items = [{ t: spec, T: { x: 0, y: spec === 'ch' ? -4 : 0 }, up, bases: [], color: col }];
    else if (spec === 'picot') items = [{ t: spec, T: { x: 0, y: -6 }, up, bases: [], color: col }];
    else {
      H = ST[spec].h; const k = ST[spec].par ?? 1;
      items = [{ t: spec, T: { x: 0, y: -H / 2 }, up, color: col,
        bases: Array.from({ length: k }, (_, j) => ({ x: (j - (k - 1) / 2) * 11, y: H / 2 })) }];
    }
    const size = Math.max(H, 20) + 10;
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
      if (row.ops.length) lines.push(`${T(doc.shape === 'round' ? 'wRnd' : 'wRow', r + 1)}: ${toText(row.ops)}  ${T('wSts', L.rows[r].count)}`);
    });
    return lines;
  }

  return { ST, COLORS, parOf, isPlain, toText, parse, layout, render, preview, usedTypes, written };
})();
