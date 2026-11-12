// Drag & drop: palette items AND existing placed stitches

class InteractionManager {
  constructor(crochetCanvas) {
    this.canvas = crochetCanvas;
    this.dragging = null;
    this.currentSnap = null;
    this.init();
  }

  init() {
    this.setupPaletteItems();
    this.setupStitchInteraction();
    this.setupSelectedPanel();
    // Deselect on bare canvas click
    document.getElementById('mainSvg').addEventListener('click', (e) => {
      if (!e.target.closest('.placed-stitch')) this.canvas.deselect();
    });
  }

  // ── Palette drag ─────────────────────────────────────────────

  setupPaletteItems() {
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('mousedown', (e) => this.startPaletteDrag(e, item.dataset.stitch));
      item.addEventListener('touchstart', (e) => this.startPaletteDrag(e, item.dataset.stitch), { passive: false });
    });
  }

  startPaletteDrag(e, stitchType) {
    e.preventDefault();
    const stDef = STITCH_TYPES[stitchType];
    if (!stDef) return;
    const ghost = this._makeGhost(stDef, null);
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    this._positionGhost(ghost, cx, cy);
    this.dragging = { type: stitchType, ghost };
    this.currentSnap = null;
    this.canvas.showSnapHints();

    const onMove = (ev) => {
      ev.preventDefault();
      const x = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
      this._positionGhost(ghost, x, y);
      this._updateSnap(x, y, ghost);
    };
    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);

      const x = ev.changedTouches ? ev.changedTouches[0].clientX : ev.clientX;
      const y = ev.changedTouches ? ev.changedTouches[0].clientY : ev.clientY;
      const svgRect = document.getElementById('mainSvg').getBoundingClientRect();
      if (this.currentSnap && x >= svgRect.left && x <= svgRect.right && y >= svgRect.top && y <= svgRect.bottom) {
        const pt = this.canvas.clientToPattern(x, y);
        this.canvas.placeStitch(stitchType, pt.x, pt.y, this.currentSnap);
      }
      ghost.remove();
      this.canvas.hideSnapIndicator();
      this.canvas.hideSnapHints();
      this.dragging = null;
      this.currentSnap = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }

  // ── Stitch click & drag ──────────────────────────────────────

  setupStitchInteraction() {
    // Event delegation — no preventDefault so mouseup always fires
    document.getElementById('mainSvg').addEventListener('mousedown', (e) => {
      const el = e.target.closest('.placed-stitch');
      if (!el || e.button !== 0) return;
      const id = parseInt(el.getAttribute('data-stitch-id'));
      this._startStitchInteraction(e, id);
    });
  }

  _startStitchInteraction(e, id) {
    const stitch = this.canvas.stitches.find(s => s.id === id);
    if (!stitch) return;

    const startX = e.clientX, startY = e.clientY;
    let moved = false;
    let ghost = null;

    const onMove = (ev) => {
      if (!moved) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
        moved = true;
        ghost = this._makeGhost(STITCH_TYPES[stitch.type], stitch.color);
        this.canvas.showSnapHints();
      }
      this._positionGhost(ghost, ev.clientX, ev.clientY);
      this._updateSnap(ev.clientX, ev.clientY, ghost);
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      if (!moved) {
        this.canvas.selectStitch(id);
        return;
      }

      ghost?.remove();
      this.canvas.hideSnapIndicator();
      this.canvas.hideSnapHints();

      if (this.currentSnap) {
        const pt = this.canvas.clientToPattern(ev.clientX, ev.clientY);
        this.canvas.moveStitch(id, pt.x, pt.y, this.currentSnap);
      }
      this.currentSnap = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Selected-stitch panel ────────────────────────────────────

  setupSelectedPanel() {
    document.getElementById('selected-apply-level')?.addEventListener('click', () => {
      const id = this.canvas._selectedId;
      if (id == null) return;
      const lv = this.canvas.getStitchLevel(id);
      const color = document.getElementById('selected-color').value;
      if (lv) this.canvas.updateLevelColor(lv, color);
    });

    document.getElementById('selected-delete')?.addEventListener('click', () => {
      const id = this.canvas._selectedId;
      if (id != null) this.canvas.deleteStitch(id);
    });
  }

  // ── Helpers ──────────────────────────────────────────────────

  _makeGhost(stDef, color) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = `<svg width="40" height="40" viewBox="-20 -20 40 40" xmlns="http://www.w3.org/2000/svg"></svg>`;
    document.body.appendChild(ghost);
    ghost.querySelector('svg').appendChild(stDef.drawSymbol(null, 0, 0, 0, 1.2, color));
    return ghost;
  }

  _positionGhost(ghost, cx, cy) {
    ghost.style.left = (cx - 20) + 'px';
    ghost.style.top = (cy - 20) + 'px';
  }

  _updateSnap(cx, cy, ghost) {
    const svgEl = document.getElementById('mainSvg');
    const rect = svgEl.getBoundingClientRect();
    if (cx >= rect.left && cx <= rect.right && cy >= rect.top && cy <= rect.bottom) {
      const pt = this.canvas.clientToPattern(cx, cy);
      const snap = this.canvas.findSnap(pt.x, pt.y);
      this.currentSnap = snap;
      this.canvas.highlightSnapHint(snap);
      if (snap) { this.canvas.showSnapIndicator(snap); ghost.style.opacity = '0.5'; }
      else { this.canvas.hideSnapIndicator(); ghost.style.opacity = '0.75'; }
    } else {
      this.canvas.hideSnapIndicator();
      this.canvas.highlightSnapHint(null);
      this.currentSnap = null;
      if (ghost) ghost.style.opacity = '0.4';
    }
  }
}
