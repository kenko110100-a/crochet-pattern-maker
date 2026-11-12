// Main app entry point for pattern.html

let crochetCanvas;
let interactionManager;

document.addEventListener('DOMContentLoaded', () => {
  const svgEl = document.getElementById('mainSvg');
  const params = new URLSearchParams(window.location.search);
  const initialCount = Math.max(3, Math.min(32, parseInt(params.get('stitches')) || 6));
  crochetCanvas = new CrochetCanvas(svgEl, { initialCount });
  interactionManager = new InteractionManager(crochetCanvas);

  buildPalettePreviews();
  readURLParams();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
    if (isInput) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault(); crochetCanvas.undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault(); crochetCanvas.redo();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      const id = crochetCanvas._selectedId;
      if (id != null) crochetCanvas.deleteStitch(id);
    } else if (e.key === 'Escape') {
      crochetCanvas.deselect();
    }
  });

  // Toolbar buttons
  document.getElementById('btnUndo').addEventListener('click', () => crochetCanvas.undo());
  document.getElementById('btnRedo').addEventListener('click', () => crochetCanvas.redo());
  document.getElementById('btnZoomIn').addEventListener('click', () => crochetCanvas.zoom(1.25));
  document.getElementById('btnZoomOut').addEventListener('click', () => crochetCanvas.zoom(1 / 1.25));
  document.getElementById('btnZoomReset').addEventListener('click', () => crochetCanvas.resetZoom());

  document.getElementById('btnClear').addEventListener('click', () => {
    if (!crochetCanvas.stitches.length || confirm('Clear the entire pattern?')) {
      crochetCanvas.clear();
    }
  });

  document.getElementById('btnExportPNG').addEventListener('click', () => exportAsPNG(svgEl));
  document.getElementById('btnExportPDF').addEventListener('click', () => exportAsPDF(svgEl));
});

function buildPalettePreviews() {
  document.querySelectorAll('.palette-item').forEach(item => {
    const type = item.dataset.stitch;
    const stDef = STITCH_TYPES[type];
    if (!stDef) return;
    const svg = item.querySelector('svg');
    if (!svg) return;
    svg.appendChild(stDef.drawSymbol(svg, 0, 0, 0, 1));
  });
}

function readURLParams() {
  const params = new URLSearchParams(window.location.search);
  const initialStitches = parseInt(params.get('stitches')) || 0;
  if (initialStitches >= 3) {
    setTimeout(() => placeInitialRound(initialStitches), 50);
  }
}

function placeInitialRound(count) {
  // Distribute stitches evenly around the ring using ringSlots spacing
  const slots = crochetCanvas.ringSlots;
  for (let i = 0; i < count; i++) {
    const slotIndex = Math.round(i * slots / count) % slots;
    const snap = crochetCanvas.snapPoints.find(p => p.stitchId === `ring-${slotIndex}`);
    if (snap) crochetCanvas.placeStitch('singleCrochet', snap.x, snap.y, snap);
  }
  crochetCanvas.undoStack = [];
  crochetCanvas.updateUndoRedoBtns();
}
