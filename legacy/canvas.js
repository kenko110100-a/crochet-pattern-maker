// Canvas / SVG rendering, zoom/pan, undo/redo, level detection

const SNAP_RADIUS = 26;
const SCALE = 1;
const LEVEL_GAP = 10; // extra spacing between level separator circle and next round's snap point

class CrochetCanvas {
  constructor(svgEl, options = {}) {
    this.svg = svgEl;
    this.stitches = [];
    this.nextId = 1;
    this.snapPoints = [];

    // Ring geometry (scales with initial stitch count)
    const count = options.initialCount || 6;
    this.ringSlots = count;
    this.magicRingRadius = Math.max(18, Math.ceil(count * 14 / (2 * Math.PI)));

    // View transform (zoom/pan)
    this.tx = 0; this.ty = 0; this.scale = 1;

    // Undo/redo
    this.undoStack = [];
    this.redoStack = [];

    // Level colors: { 1: '#hex', 2: '#hex', ... }
    this.levelColorMap = {};

    // Groups
    this.patternGroup = null;
    this.levelCirclesGroup = null;
    this.stitchGroup = null;
    this.snapIndicator = null;

    // Center (fixed in pattern space)
    this._cx = null; this._cy = null;

    this.init();
  }

  init() {
    const ns = 'http://www.w3.org/2000/svg';
    this.svg.innerHTML = '';

    // Background rect for pan
    const bg = document.createElementNS(ns, 'rect');
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#faf9f6'); bg.setAttribute('id', 'svgBg');
    this.svg.appendChild(bg);

    // Root transform group
    this.patternGroup = document.createElementNS(ns, 'g');
    this.patternGroup.setAttribute('id', 'patternGroup');
    this.svg.appendChild(this.patternGroup);

    // Sub-groups inside patternGroup
    this.ringGroup = document.createElementNS(ns, 'g');
    this.ringGroup.setAttribute('id', 'ringGroup');
    this.patternGroup.appendChild(this.ringGroup);

    this.levelCirclesGroup = document.createElementNS(ns, 'g');
    this.levelCirclesGroup.setAttribute('id', 'levelCirclesGroup');
    this.patternGroup.appendChild(this.levelCirclesGroup);

    this.connectorGroup = document.createElementNS(ns, 'g');
    this.connectorGroup.setAttribute('id', 'connectorGroup');
    this.patternGroup.appendChild(this.connectorGroup);

    this.stitchGroup = document.createElementNS(ns, 'g');
    this.stitchGroup.setAttribute('id', 'stitchGroup');
    this.patternGroup.appendChild(this.stitchGroup);

    // Snap hints layer (shown during drag)
    this.snapHintsGroup = document.createElementNS(ns, 'g');
    this.snapHintsGroup.setAttribute('id', 'snapHintsGroup');
    this.snapHintsGroup.setAttribute('pointer-events', 'none');
    this.patternGroup.appendChild(this.snapHintsGroup);

    // Snap indicator (on top)
    this.snapIndicator = document.createElementNS(ns, 'circle');
    this.snapIndicator.setAttribute('r', '8');
    this.snapIndicator.setAttribute('fill', 'none');
    this.snapIndicator.setAttribute('stroke', '#4caf50');
    this.snapIndicator.setAttribute('stroke-width', '2');
    this.snapIndicator.setAttribute('stroke-dasharray', '4 2');
    this.snapIndicator.setAttribute('opacity', '0');
    this.snapIndicator.setAttribute('pointer-events', 'none');
    this.patternGroup.appendChild(this.snapIndicator);

    this.drawMagicRing();
    this.applyTransform();
    this.updateSnapPoints();
    this.setupZoomPan();
  }

  centerX() {
    if (!this._cx) this._cx = (this.svg.clientWidth || 800) / 2;
    return this._cx;
  }
  centerY() {
    if (!this._cy) this._cy = (this.svg.clientHeight || 700) / 2;
    return this._cy;
  }

  drawMagicRing() {
    const ns = 'http://www.w3.org/2000/svg';
    const cx = this.centerX(), cy = this.centerY();
    this.ringGroup.innerHTML = '';

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
    circle.setAttribute('r', this.magicRingRadius);
    circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', '#aaa');
    circle.setAttribute('stroke-width', '2'); circle.setAttribute('stroke-dasharray', '5 3');
    this.ringGroup.appendChild(circle);

    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy);
    dot.setAttribute('r', '3'); dot.setAttribute('fill', '#aaa');
    this.ringGroup.appendChild(dot);
  }

  applyTransform() {
    this.patternGroup.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.scale})`);
    const btn = document.getElementById('btnZoomReset');
    if (btn) btn.textContent = Math.round(this.scale * 100) + '%';
  }

  // Convert client coords → pattern (unscaled) coords
  clientToPattern(cx, cy) {
    const rect = this.svg.getBoundingClientRect();
    const svgX = cx - rect.left;
    const svgY = cy - rect.top;
    return { x: (svgX - this.tx) / this.scale, y: (svgY - this.ty) / this.scale };
  }

  setupZoomPan() {
    // Zoom with wheel
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const rect = this.svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const newScale = Math.min(8, Math.max(0.2, this.scale * factor));
      this.tx = mx - (mx - this.tx) * newScale / this.scale;
      this.ty = my - (my - this.ty) * newScale / this.scale;
      this.scale = newScale;
      this.applyTransform();
    }, { passive: false });

    // Pan with drag on background
    let panActive = false, panStart = null;
    this.svg.addEventListener('mousedown', (e) => {
      const target = e.target;
      const isPannable = target.id === 'svgBg' || target.id === 'mainSvg' ||
        target.id === 'ringGroup' || target.id === 'levelCirclesGroup' ||
        target.closest?.('#ringGroup') || target.closest?.('#levelCirclesGroup');
      if (isPannable && !e.target.closest?.('.placed-stitch') && e.button === 0) {
        panActive = true;
        panStart = { x: e.clientX - this.tx, y: e.clientY - this.ty };
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    document.addEventListener('mousemove', (e) => {
      if (!panActive) return;
      this.tx = e.clientX - panStart.x;
      this.ty = e.clientY - panStart.y;
      this.applyTransform();
    });
    document.addEventListener('mouseup', () => {
      panActive = false;
      this.svg.style.cursor = '';
    });
  }

  zoom(factor) {
    const cx = this.svg.clientWidth / 2;
    const cy = this.svg.clientHeight / 2;
    const newScale = Math.min(8, Math.max(0.2, this.scale * factor));
    this.tx = cx - (cx - this.tx) * newScale / this.scale;
    this.ty = cy - (cy - this.ty) * newScale / this.scale;
    this.scale = newScale;
    this.applyTransform();
  }

  resetZoom() {
    this.tx = 0; this.ty = 0; this.scale = 1;
    this.applyTransform();
  }

  // ── Snap points ──────────────────────────────────────────────

  updateSnapPoints() {
    const cx = this.centerX(), cy = this.centerY();
    this.snapPoints = [];

    // Unoccupied ring positions
    const occupiedRingSlots = new Set(
      this.stitches.filter(s => typeof s.anchorId === 'string' && s.anchorId.startsWith('ring-'))
        .map(s => s.anchorId)
    );
    for (let i = 0; i < this.ringSlots; i++) {
      const slotId = `ring-${i}`;
      if (!occupiedRingSlots.has(slotId)) {
        const angle = (i / this.ringSlots) * Math.PI * 2 - Math.PI / 2;
        this.snapPoints.push({
          x: cx + Math.cos(angle) * this.magicRingRadius,
          y: cy + Math.sin(angle) * this.magicRingRadius,
          stitchId: slotId, role: 'ring',
          angle: (angle * 180 / Math.PI) + 90,
        });
      }
    }

    // Top anchors of stitches without children
    const occupiedParentIds = new Set(this.stitches.map(s => s.anchorId).filter(Boolean));
    this.stitches.forEach(s => {
      if (!occupiedParentIds.has(s.id)) {
        const rad = (s.angle - 90) * Math.PI / 180;
        const topDist = Math.abs(STITCH_TYPES[s.type].topOffset.y) + LEVEL_GAP;
        // Move outward (away from center) from stitch center to find top anchor
        const tx = s.x + Math.cos(rad) * topDist;
        const ty = s.y + Math.sin(rad) * topDist;
        this.snapPoints.push({ x: tx, y: ty, stitchId: s.id, role: 'top', angle: s.angle });
      }
    });
  }

  // Stitch tops always beat ring slots when both are in range
  findSnap(px, py) {
    let bestTop = null, bestTopDist = SNAP_RADIUS;
    let bestRing = null, bestRingDist = SNAP_RADIUS;
    this.snapPoints.forEach(pt => {
      const d = Math.hypot(pt.x - px, pt.y - py);
      if (pt.role === 'top' && d < bestTopDist) { bestTopDist = d; bestTop = pt; }
      else if (pt.role === 'ring' && d < bestRingDist) { bestRingDist = d; bestRing = pt; }
    });
    return bestTop || bestRing;
  }

  showSnapHints() {
    const ns = 'http://www.w3.org/2000/svg';
    this.snapHintsGroup.innerHTML = '';
    this.snapPoints.forEach(pt => {
      // Outer ring of hint
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('cx', pt.x); ring.setAttribute('cy', pt.y);
      ring.setAttribute('r', pt.role === 'top' ? '10' : '7');
      ring.setAttribute('fill', 'rgba(76,175,80,0.08)');
      ring.setAttribute('stroke', '#4caf50');
      ring.setAttribute('stroke-width', '1.5');
      ring.setAttribute('stroke-dasharray', '4 3');
      ring.setAttribute('opacity', '0.55');
      ring.setAttribute('data-hint-id', pt.stitchId);
      this.snapHintsGroup.appendChild(ring);

      // Small center dot
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
      dot.setAttribute('r', '2');
      dot.setAttribute('fill', '#4caf50');
      dot.setAttribute('opacity', '0.4');
      dot.setAttribute('pointer-events', 'none');
      this.snapHintsGroup.appendChild(dot);
    });
  }

  hideSnapHints() {
    this.snapHintsGroup.innerHTML = '';
  }

  highlightSnapHint(activePt) {
    this.snapHintsGroup.querySelectorAll('circle[data-hint-id]').forEach(el => {
      el.setAttribute('opacity', '0.35');
      el.setAttribute('stroke-width', '1.5');
      el.setAttribute('fill', 'rgba(76,175,80,0.08)');
    });
    if (activePt) {
      const el = this.snapHintsGroup.querySelector(`[data-hint-id="${activePt.stitchId}"]`);
      if (el) {
        el.setAttribute('opacity', '1');
        el.setAttribute('stroke-width', '2.5');
        el.setAttribute('fill', 'rgba(76,175,80,0.22)');
      }
    }
  }

  showSnapIndicator(pt) {
    this.snapIndicator.setAttribute('cx', pt.x);
    this.snapIndicator.setAttribute('cy', pt.y);
    this.snapIndicator.setAttribute('opacity', '1');
  }
  hideSnapIndicator() { this.snapIndicator.setAttribute('opacity', '0'); }

  // ── Level detection ───────────────────────────────────────────

  computeLevels() {
    const map = {}; // id → level
    const queue = [];
    this.stitches.forEach(s => {
      if (typeof s.anchorId === 'string' && s.anchorId.startsWith('ring-')) {
        map[s.id] = 1; queue.push(s);
      }
    });
    while (queue.length) {
      const s = queue.shift();
      this.stitches.filter(c => c.anchorId === s.id).forEach(c => {
        map[c.id] = (map[s.id] || 0) + 1;
        queue.push(c);
      });
    }
    return map;
  }

  getLevelCount() {
    const levels = this.computeLevels();
    return Object.keys(levels).length ? Math.max(...Object.values(levels)) : 0;
  }

  getStitchLevel(id) {
    return this.computeLevels()[id] || null;
  }

  ensureLevelColor(level) {
    if (!this.levelColorMap[level]) {
      this.levelColorMap[level] = LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
    }
    return this.levelColorMap[level];
  }

  // ── Stitch placement ──────────────────────────────────────────

  placeStitch(type, px, py, snapPt) {
    this.pushHistory();
    const stDef = STITCH_TYPES[type];
    if (!stDef) return;

    let sx = px, sy = py, angle = 0, anchorId = null;
    if (snapPt) {
      anchorId = snapPt.stitchId;
      angle = snapPt.angle;
      const rad = (angle - 90) * Math.PI / 180;
      const baseDist = stDef.baseOffset.y;
      sx = snapPt.x + Math.cos(rad) * baseDist;
      sy = snapPt.y + Math.sin(rad) * baseDist;
    } else {
      const cx = this.centerX(), cy = this.centerY();
      angle = Math.atan2(sy - cy, sx - cx) * 180 / Math.PI + 90;
    }

    const id = this.nextId++;
    const levelMap = this.computeLevels();

    // Determine level of new stitch
    let newLevel = 1;
    if (anchorId && typeof anchorId === 'string' && anchorId.startsWith('ring-')) {
      newLevel = 1;
    } else if (anchorId) {
      const parentStitch = this.stitches.find(s => s.id === anchorId);
      if (parentStitch) newLevel = (levelMap[parentStitch.id] || 0) + 1;
    }

    const color = this.ensureLevelColor(newLevel);
    const stitch = { id, type, x: sx, y: sy, angle, anchorId, color, level: newLevel };
    this.stitches.push(stitch);

    this.renderStitch(stitch, snapPt);
    this.updateSnapPoints();
    this.updateLevelCircles();
    this.updateCounters();
    this.updateRoundsSidebar();
    this.updateUndoRedoBtns();

    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '0';

    return id;
  }

  renderStitch(stitch, snapPt) {
    const ns = 'http://www.w3.org/2000/svg';
    const stDef = STITCH_TYPES[stitch.type];
    const g = stDef.drawSymbol(this.svg, stitch.x, stitch.y, stitch.angle, SCALE, stitch.color);
    g.setAttribute('data-stitch-id', stitch.id);
    g.setAttribute('class', 'placed-stitch');
    g.style.cursor = 'grab';

    // Invisible hit area for easier clicking/dragging
    const hit = document.createElementNS(ns, 'circle');
    hit.setAttribute('r', '14');
    hit.setAttribute('fill', 'transparent');
    hit.setAttribute('pointer-events', 'all');
    g.insertBefore(hit, g.firstChild);

    this.stitchGroup.appendChild(g);

    if (snapPt) {
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', snapPt.x); line.setAttribute('y1', snapPt.y);
      line.setAttribute('x2', stitch.x); line.setAttribute('y2', stitch.y);
      line.setAttribute('stroke', '#ccc'); line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-dasharray', '2 2'); line.setAttribute('pointer-events', 'none');
      line.setAttribute('data-connector', stitch.id);
      this.connectorGroup.appendChild(line);
    }
  }

  rerenderAll() {
    this.stitchGroup.innerHTML = '';
    this.connectorGroup.innerHTML = '';
    this.stitches.forEach(s => {
      // Rebuild snapPt approximation for connectors
      let snapPt = null;
      if (s.anchorId) {
        if (typeof s.anchorId === 'string' && s.anchorId.startsWith('ring-')) {
          const cx = this.centerX(), cy = this.centerY();
          const i = parseInt(s.anchorId.split('-')[1]);
          const angle = (i / this.ringSlots) * Math.PI * 2 - Math.PI / 2;
          snapPt = { x: cx + Math.cos(angle) * this.magicRingRadius, y: cy + Math.sin(angle) * this.magicRingRadius };
        } else {
          const parent = this.stitches.find(p => p.id === s.anchorId);
          if (parent) {
            const rad = (parent.angle - 90) * Math.PI / 180;
            const topDist = STITCH_TYPES[parent.type].topOffset.y;
            snapPt = {
              x: parent.x + Math.cos(rad) * (Math.abs(topDist) + LEVEL_GAP),
              y: parent.y + Math.sin(rad) * (Math.abs(topDist) + LEVEL_GAP),
            };
          }
        }
      }
      this.renderStitch(s, snapPt);
    });
    this.updateSnapPoints();
    this.updateLevelCircles();
    this.updateCounters();
    this.updateRoundsSidebar();
    this.updateUndoRedoBtns();
  }

  // ── Move existing stitch ─────────────────────────────────────

  getDescendants(id) {
    const result = [];
    const queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      const children = this.stitches.filter(s => s.anchorId === cur).map(s => s.id);
      result.push(...children);
      queue.push(...children);
    }
    return result;
  }

  moveStitch(id, px, py, snapPt) {
    this.pushHistory();
    const s = this.stitches.find(s => s.id === id);
    if (!s) return;

    const oldX = s.x, oldY = s.y;

    if (snapPt) {
      const stDef = STITCH_TYPES[s.type];
      const rad = (snapPt.angle - 90) * Math.PI / 180;
      s.x = snapPt.x + Math.cos(rad) * stDef.baseOffset.y;
      s.y = snapPt.y + Math.sin(rad) * stDef.baseOffset.y;
      s.angle = snapPt.angle;
      s.anchorId = snapPt.stitchId;
      // Re-assign level
      const levelMap = this.computeLevels();
      if (typeof snapPt.stitchId === 'string' && snapPt.stitchId.startsWith('ring-')) {
        s.level = 1;
      } else {
        const parent = this.stitches.find(p => p.id === snapPt.stitchId);
        s.level = parent ? (levelMap[parent.id] || 0) + 1 : s.level;
      }
    } else {
      s.x = px; s.y = py;
      const cx = this.centerX(), cy = this.centerY();
      s.angle = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90;
      s.anchorId = null;
    }

    // Move all descendants by the same delta
    const dx = s.x - oldX, dy = s.y - oldY;
    this.getDescendants(id).forEach(descId => {
      const d = this.stitches.find(s => s.id === descId);
      if (d) { d.x += dx; d.y += dy; }
    });

    this.rerenderAll();
  }

  // ── Level separator circles ───────────────────────────────────

  updateLevelCircles() {
    const ns = 'http://www.w3.org/2000/svg';
    this.levelCirclesGroup.innerHTML = '';
    if (!this.stitches.length) return;

    const cx = this.centerX(), cy = this.centerY();
    const levelMap = this.computeLevels();

    // Group stitches by level, compute max radius per level
    const radByLevel = {};
    this.stitches.forEach(s => {
      const lv = levelMap[s.id] || 1;
      const r = Math.hypot(s.x - cx, s.y - cy) + STITCH_TYPES[s.type].unitHeight / 2;
      if (!radByLevel[lv] || r > radByLevel[lv]) radByLevel[lv] = r;
    });

    Object.entries(radByLevel).forEach(([lv, r]) => {
      const circle = document.createElementNS(ns, 'circle');
      circle.setAttribute('cx', cx); circle.setAttribute('cy', cy);
      circle.setAttribute('r', r + 4);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', this.levelColorMap[lv] || '#ccc');
      circle.setAttribute('stroke-width', '1');
      circle.setAttribute('stroke-dasharray', '6 4');
      circle.setAttribute('opacity', '0.4');
      circle.setAttribute('pointer-events', 'none');
      this.levelCirclesGroup.appendChild(circle);
    });
  }

  // ── Selection & color ────────────────────────────────────────

  _selectedId = null;

  selectStitch(id) {
    this._selectedId = id;
    this.svg.querySelectorAll('.placed-stitch').forEach(el => el.classList.remove('stitch-selected'));
    const el = this.svg.querySelector(`[data-stitch-id="${id}"]`);
    if (el) el.classList.add('stitch-selected');

    const stitch = this.stitches.find(s => s.id === id);
    if (!stitch) return;
    const lv = this.getStitchLevel(id);
    this._updateSelectedPanel(stitch, lv);
  }

  _updateSelectedPanel(stitch, lv) {
    const panel = document.getElementById('selected-section');
    if (!panel) return;
    const nameEl = document.getElementById('selected-name');
    const lvEl = document.getElementById('selected-level');
    const colorEl = document.getElementById('selected-color');
    if (nameEl) nameEl.textContent = STITCH_TYPES[stitch.type]?.name || 'Stitch';
    if (lvEl) lvEl.textContent = lv ? `Round ${lv}` : '';
    if (colorEl) {
      colorEl.value = stitch.color || '#333333';
      colorEl.onchange = () => this.updateStitchColor(stitch.id, colorEl.value);
    }
    panel.style.display = 'block';
  }

  deselect() {
    this._selectedId = null;
    this.svg.querySelectorAll('.placed-stitch').forEach(el => el.classList.remove('stitch-selected'));
    const panel = document.getElementById('selected-section');
    if (panel) panel.style.display = 'none';
  }

  updateStitchColor(id, color) {
    const s = this.stitches.find(s => s.id === id);
    if (!s) return;
    s.color = color;
    const old = this.svg.querySelector(`[data-stitch-id="${id}"]`);
    if (!old) return;
    const stDef = STITCH_TYPES[s.type];
    const newEl = stDef.drawSymbol(this.svg, s.x, s.y, s.angle, SCALE, s.color);
    newEl.setAttribute('data-stitch-id', id);
    newEl.setAttribute('class', 'placed-stitch stitch-selected');
    newEl.style.cursor = 'grab';
    // Add hit area
    const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    hit.setAttribute('r', '14'); hit.setAttribute('fill', 'transparent');
    hit.setAttribute('pointer-events', 'all');
    newEl.insertBefore(hit, newEl.firstChild);
    old.parentNode.replaceChild(newEl, old);
  }

  updateLevelColor(level, color) {
    this.levelColorMap[level] = color;
    this.stitches.filter(s => s.level === level).forEach(s => {
      s.color = color;
      const old = this.svg.querySelector(`[data-stitch-id="${s.id}"]`);
      if (!old) return;
      const stDef = STITCH_TYPES[s.type];
      const newEl = stDef.drawSymbol(this.svg, s.x, s.y, s.angle, SCALE, color);
      newEl.setAttribute('data-stitch-id', s.id);
      newEl.setAttribute('class', 'placed-stitch');
      newEl.style.cursor = 'grab';
      const hit = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      hit.setAttribute('r', '14'); hit.setAttribute('fill', 'transparent');
      hit.setAttribute('pointer-events', 'all');
      newEl.insertBefore(hit, newEl.firstChild);
      old.parentNode.replaceChild(newEl, old);
    });
    this.updateLevelCircles();
    this.updateRoundsSidebar();
    this.updateUndoRedoBtns();
  }

  // ── Delete ───────────────────────────────────────────────────

  deleteStitch(id) {
    this.pushHistory();
    this.stitches = this.stitches.filter(s => s.id !== id);
    this.svg.querySelector(`[data-stitch-id="${id}"]`)?.remove();
    this.svg.querySelector(`[data-connector="${id}"]`)?.remove();
    this.updateSnapPoints();
    this.updateLevelCircles();
    this.updateCounters();
    this.updateRoundsSidebar();
    this.updateUndoRedoBtns();
    this.deselect();
  }

  // ── Undo / Redo ──────────────────────────────────────────────

  snapshot() {
    return {
      stitches: JSON.parse(JSON.stringify(this.stitches)),
      levelColorMap: JSON.parse(JSON.stringify(this.levelColorMap)),
      nextId: this.nextId,
    };
  }

  pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
  }

  restore(snap) {
    this.stitches = snap.stitches;
    this.levelColorMap = snap.levelColorMap;
    this.nextId = snap.nextId;
    this.deselect();
    this.rerenderAll();
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.restore(this.redoStack.pop());
  }

  // ── UI updates ───────────────────────────────────────────────

  updateCounters() {
    const el = document.getElementById('stitchCount');
    if (el) el.textContent = this.stitches.length;
  }

  updateUndoRedoBtns() {
    const u = document.getElementById('btnUndo');
    const r = document.getElementById('btnRedo');
    if (u) u.disabled = !this.undoStack.length;
    if (r) r.disabled = !this.redoStack.length;
  }

  updateRoundsSidebar() {
    const container = document.getElementById('rounds-list');
    if (!container) return;
    const levelMap = this.computeLevels();
    const levels = new Set(Object.values(levelMap));
    const maxLevel = levels.size ? Math.max(...levels) : 0;

    container.innerHTML = '';
    if (!maxLevel) {
      container.innerHTML = '<div class="rounds-empty">No rounds yet</div>';
      return;
    }

    for (let lv = 1; lv <= maxLevel; lv++) {
      const color = this.ensureLevelColor(lv);
      const count = Object.values(levelMap).filter(v => v === lv).length;
      const row = document.createElement('div');
      row.className = 'round-row';
      row.innerHTML = `
        <label class="round-label">Round ${lv} <span class="round-count">(${count})</span></label>
        <input type="color" class="round-color-input" value="${color}" data-level="${lv}" title="Change color for Round ${lv}" />
      `;
      row.querySelector('input').addEventListener('input', (e) => {
        this.updateLevelColor(lv, e.target.value);
      });
      container.appendChild(row);
    }
  }

  // ── Clear ────────────────────────────────────────────────────

  clear() {
    this.pushHistory();
    this.stitches = [];
    this.nextId = 1;
    this.levelColorMap = {};
    this.deselect();
    this.rerenderAll();
  }
}
