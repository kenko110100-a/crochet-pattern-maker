// Export functionality: PNG and PDF

async function exportAsPNG(svgEl, filename = 'crochet-pattern.png') {
  const svgRect = svgEl.getBoundingClientRect();
  const width = svgRect.width || 800;
  const height = svgRect.height || 700;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; // 2x for retina
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = url;
}

async function exportAsPDF(svgEl, filename = 'crochet-pattern.pdf') {
  if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
    alert('PDF library not loaded. Please check your internet connection.');
    return;
  }

  const { jsPDF } = window.jspdf || window;
  const svgRect = svgEl.getBoundingClientRect();
  const width = svgRect.width || 800;
  const height = svgRect.height || 700;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.fillStyle = '#faf9f6';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    const imgData = canvas.toDataURL('image/png');
    // A4 landscape in mm: 297 x 210
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210;
    const margin = 15;
    const maxW = pageW - margin * 2;
    const maxH = pageH - margin * 2 - 10;
    const ratio = Math.min(maxW / width, maxH / height);
    const imgW = width * ratio;
    const imgH = height * ratio;
    const imgX = (pageW - imgW) / 2;
    const imgY = margin + 8;

    pdf.setFontSize(14);
    pdf.setTextColor(80, 60, 40);
    pdf.text('Crochet Pattern', pageW / 2, margin, { align: 'center' });
    pdf.addImage(imgData, 'PNG', imgX, imgY, imgW, imgH);
    pdf.save(filename);
  };
  img.src = url;
}
