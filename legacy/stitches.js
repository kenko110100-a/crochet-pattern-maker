// Standard crochet chart symbols and stitch definitions
// drawSymbol(svg, x, y, angle, scale, color) — color overrides the default

const STITCH_TYPES = {
  chain: {
    id: 'chain',
    name: 'Chain',
    abbr: 'ch',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ellipse.setAttribute('cx', '0'); ellipse.setAttribute('cy', '0');
      ellipse.setAttribute('rx', String(6 * scale)); ellipse.setAttribute('ry', String(4 * scale));
      ellipse.setAttribute('fill', 'none'); ellipse.setAttribute('stroke', c);
      ellipse.setAttribute('stroke-width', String(1.5 * scale));
      g.appendChild(ellipse);
      return g;
    },
    baseOffset: { y: 4 }, topOffset: { y: -4 }, unitHeight: 8,
  },

  slipStitch: {
    id: 'slipStitch',
    name: 'Slip Stitch',
    abbr: 'sl st',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0'); circle.setAttribute('cy', '0');
      circle.setAttribute('r', String(3 * scale)); circle.setAttribute('fill', c);
      g.appendChild(circle);
      return g;
    },
    baseOffset: { y: 3 }, topOffset: { y: -3 }, unitHeight: 6,
  },

  singleCrochet: {
    id: 'singleCrochet',
    name: 'Single Crochet',
    abbr: 'sc',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 7 * scale, w = 5 * scale;
      [[-w,-h,w,h],[w,-h,-w,h]].forEach(([x1,y1,x2,y2]) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1',x1); l.setAttribute('y1',y1);
        l.setAttribute('x2',x2); l.setAttribute('y2',y2);
        l.setAttribute('stroke', c); l.setAttribute('stroke-width', String(1.5 * scale));
        g.appendChild(l);
      });
      return g;
    },
    baseOffset: { y: 7 }, topOffset: { y: -7 }, unitHeight: 14,
  },

  halfDoubleCrochet: {
    id: 'halfDoubleCrochet',
    name: 'Half Double Crochet',
    abbr: 'hdc',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 10 * scale;
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1','0'); stem.setAttribute('y1', String(-h));
      stem.setAttribute('x2','0'); stem.setAttribute('y2', String(h));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5 * scale));
      g.appendChild(stem);
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      bar.setAttribute('x1', String(-4*scale)); bar.setAttribute('y1', String(-3*scale));
      bar.setAttribute('x2', String(4*scale));  bar.setAttribute('y2', String(-3*scale));
      bar.setAttribute('stroke', c); bar.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(bar);
      return g;
    },
    baseOffset: { y: 10 }, topOffset: { y: -10 }, unitHeight: 20,
  },

  doubleCrochet: {
    id: 'doubleCrochet',
    name: 'Double Crochet',
    abbr: 'dc',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 13 * scale;
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1','0'); stem.setAttribute('y1', String(-h));
      stem.setAttribute('x2','0'); stem.setAttribute('y2', String(h));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(stem);
      [-4, 2].forEach(oy => {
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bar.setAttribute('x1', String(-4*scale)); bar.setAttribute('y1', String(oy*scale));
        bar.setAttribute('x2', String(4*scale));  bar.setAttribute('y2', String(oy*scale));
        bar.setAttribute('stroke', c); bar.setAttribute('stroke-width', String(1.5*scale));
        g.appendChild(bar);
      });
      return g;
    },
    baseOffset: { y: 13 }, topOffset: { y: -13 }, unitHeight: 26,
  },

  trebleCrochet: {
    id: 'trebleCrochet',
    name: 'Treble Crochet',
    abbr: 'tr',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 17 * scale;
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1','0'); stem.setAttribute('y1', String(-h));
      stem.setAttribute('x2','0'); stem.setAttribute('y2', String(h));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(stem);
      [-7, -1, 5].forEach(oy => {
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bar.setAttribute('x1', String(-4*scale)); bar.setAttribute('y1', String(oy*scale));
        bar.setAttribute('x2', String(4*scale));  bar.setAttribute('y2', String(oy*scale));
        bar.setAttribute('stroke', c); bar.setAttribute('stroke-width', String(1.5*scale));
        g.appendChild(bar);
      });
      return g;
    },
    baseOffset: { y: 17 }, topOffset: { y: -17 }, unitHeight: 34,
  },

  increase: {
    id: 'increase',
    name: 'Increase',
    abbr: 'inc',
    color: '#e07b39',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      [-4, 4].forEach(ox => {
        const h = 6*scale, w = 4*scale;
        [[-w,-h,w,h],[w,-h,-w,h]].forEach(([x1,y1,x2,y2]) => {
          const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', String(ox*scale+x1)); l.setAttribute('y1',y1);
          l.setAttribute('x2', String(ox*scale+x2)); l.setAttribute('y2',y2);
          l.setAttribute('stroke', c); l.setAttribute('stroke-width', String(1.5*scale));
          g.appendChild(l);
        });
      });
      return g;
    },
    baseOffset: { y: 6 }, topOffset: { y: -6 }, unitHeight: 14,
  },

  decrease: {
    id: 'decrease',
    name: 'Decrease',
    abbr: 'dec',
    color: '#5b8dd9',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 8*scale, w = 6*scale;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${-w} ${-h} L 0 0 L ${w} ${-h}`);
      path.setAttribute('fill','none'); path.setAttribute('stroke', c);
      path.setAttribute('stroke-width', String(1.5*scale));
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1','0'); stem.setAttribute('y1','0');
      stem.setAttribute('x2','0'); stem.setAttribute('y2', String(h));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(path); g.appendChild(stem);
      return g;
    },
    baseOffset: { y: 8 }, topOffset: { y: -8 }, unitHeight: 16,
  },

  doubleTreble: {
    id: 'doubleTreble',
    name: 'Double Treble',
    abbr: 'dtr',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 21 * scale;
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1','0'); stem.setAttribute('y1', String(-h));
      stem.setAttribute('x2','0'); stem.setAttribute('y2', String(h));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(stem);
      [-10, -4, 2, 8].forEach(oy => {
        const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        bar.setAttribute('x1', String(-4*scale)); bar.setAttribute('y1', String(oy*scale));
        bar.setAttribute('x2', String(4*scale));  bar.setAttribute('y2', String(oy*scale));
        bar.setAttribute('stroke', c); bar.setAttribute('stroke-width', String(1.5*scale));
        g.appendChild(bar);
      });
      return g;
    },
    baseOffset: { y: 21 }, topOffset: { y: -21 }, unitHeight: 42,
  },

  bobble: {
    id: 'bobble',
    name: 'Bobble',
    abbr: 'bob',
    color: '#8e44ad',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const h = 10 * scale;
      // Teardrop: narrow at base, rounded at top
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M 0 ${h} C ${-6*scale} ${4*scale} ${-8*scale} ${-4*scale} 0 ${-h} C ${8*scale} ${-4*scale} ${6*scale} ${4*scale} 0 ${h} Z`);
      path.setAttribute('fill', c); path.setAttribute('fill-opacity', '0.2');
      path.setAttribute('stroke', c); path.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(path);
      // Bar at top indicating closed dc tops
      const bar = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      bar.setAttribute('x1', String(-4*scale)); bar.setAttribute('y1', String(-h + 2*scale));
      bar.setAttribute('x2', String(4*scale));  bar.setAttribute('y2', String(-h + 2*scale));
      bar.setAttribute('stroke', c); bar.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(bar);
      return g;
    },
    baseOffset: { y: 10 }, topOffset: { y: -10 }, unitHeight: 20,
  },

  shell: {
    id: 'shell',
    name: 'Shell',
    abbr: 'sh',
    color: '#16a085',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      const base = 7 * scale;
      const armLen = 14 * scale;
      // 5 arms radiating from base point
      const tipPoints = [];
      [-130, -110, -90, -70, -50].forEach(deg => {
        const a = deg * Math.PI / 180;
        const tx = armLen * Math.cos(a);
        const ty = base + armLen * Math.sin(a);
        tipPoints.push({ x: tx, y: ty });
        const arm = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        arm.setAttribute('x1', '0'); arm.setAttribute('y1', String(base));
        arm.setAttribute('x2', String(tx)); arm.setAttribute('y2', String(ty));
        arm.setAttribute('stroke', c); arm.setAttribute('stroke-width', String(1.5*scale));
        g.appendChild(arm);
      });
      // Arc connecting outermost tips
      const tl = tipPoints[0], tr2 = tipPoints[4];
      const arcPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arcPath.setAttribute('d', `M ${tl.x} ${tl.y} Q 0 ${base - armLen - 2*scale} ${tr2.x} ${tr2.y}`);
      arcPath.setAttribute('fill', 'none'); arcPath.setAttribute('stroke', c);
      arcPath.setAttribute('stroke-width', String(1.2*scale));
      g.appendChild(arcPath);
      return g;
    },
    baseOffset: { y: 7 }, topOffset: { y: -7 }, unitHeight: 16,
  },

  picot: {
    id: 'picot',
    name: 'Picot',
    abbr: 'p',
    color: '#333',
    drawSymbol(svg, x, y, angle, scale = 1, color = null) {
      const c = color || this.color;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', `translate(${x},${y}) rotate(${angle})`);
      // Short stem from base to loop
      const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      stem.setAttribute('x1', '0'); stem.setAttribute('y1', String(4*scale));
      stem.setAttribute('x2', '0'); stem.setAttribute('y2', String(0));
      stem.setAttribute('stroke', c); stem.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(stem);
      // Small circle loop at tip
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '0'); circle.setAttribute('cy', String(-3*scale));
      circle.setAttribute('r', String(3*scale));
      circle.setAttribute('fill', 'none'); circle.setAttribute('stroke', c);
      circle.setAttribute('stroke-width', String(1.5*scale));
      g.appendChild(circle);
      return g;
    },
    baseOffset: { y: 4 }, topOffset: { y: -6 }, unitHeight: 10,
  },
};

const STITCH_ORDER = ['chain','slipStitch','singleCrochet','halfDoubleCrochet','doubleCrochet','trebleCrochet','doubleTreble','increase','decrease','bobble','shell','picot'];

const LEVEL_COLORS = ['#2c2c2c','#c47c3b','#5b8dd9','#4caf50','#9b59b6','#e74c3c','#1abc9c','#e67e22','#3498db','#27ae60'];
