// =====================================================
// Tactile Forge — Wind Rose HUD widget
// =====================================================

export class WindRose {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._resize();
  }

  _resize() {
    const w = this.canvas.clientWidth || 160;
    const h = this.canvas.clientHeight || 160;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.W = w; this.H = h;
  }

  draw(windAngleDeg, windStrength, headingDeg, pointOfSail) {
    this._resize();
    const ctx = this.ctx;
    const W = this.W, H = this.H;
    const cx = W / 2, cy = H / 2;
    // k scales the fixed offsets for the small rose in the phone strip (k = 1 at 160px).
    const k = Math.min(1, Math.min(W, H) / 160);
    const R = Math.min(W, H) / 2 - 8 * k;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, W, H);

    // Compass face
    const face = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    face.addColorStop(0, 'rgba(20, 48, 73, .9)');
    face.addColorStop(1, 'rgba(6, 18, 31, .95)');
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // Inner ring
    ctx.strokeStyle = 'rgba(245, 212, 134, .35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R - 6 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 12 * k, 0, Math.PI * 2); ctx.stroke();

    // Tick marks
    ctx.strokeStyle = 'rgba(245, 212, 134, .6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 360; i += 15) {
      const a = (i - 90) * Math.PI / 180;
      const major = i % 45 === 0;
      const len = (major ? 10 : 5) * k;
      const x1 = cx + Math.cos(a) * (R - 12 * k);
      const y1 = cy + Math.sin(a) * (R - 12 * k);
      const x2 = cx + Math.cos(a) * (R - 12 * k - len);
      const y2 = cy + Math.sin(a) * (R - 12 * k - len);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }

    // Cardinal letters
    ctx.fillStyle = '#d6e6f2';
    ctx.font = `600 ${Math.max(7, Math.round(11 * k))}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cards = [['N', 0],['E', 90],['S', 180],['W', 270]];
    for (const [ch, deg] of cards) {
      const a = (deg - 90) * Math.PI / 180;
      const r = R - 24 * k;
      ctx.fillStyle = ch === 'N' ? '#f5d486' : '#d6e6f2';
      ctx.fillText(ch, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }

    // Heading sector (where the boat currently points)
    if (headingDeg !== undefined && headingDeg !== null) {
      const a = (headingDeg - 90) * Math.PI / 180;
      ctx.strokeStyle = pointOfSail?.color || '#5fd3c4';
      ctx.fillStyle = (pointOfSail?.color || '#5fd3c4') + '33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R - 18 * k, a - 0.18, a + 0.18);
      ctx.closePath();
      ctx.fill();
      // shaft
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * (R - 18 * k), cy + Math.sin(a) * (R - 18 * k));
      ctx.stroke();
    }

    // Wind arrow (points the way the wind is BLOWING TOWARD)
    const wAngle = (windAngleDeg + 180 - 90) * Math.PI / 180;
    const arrowLen = R - 30 * k;
    const tipX = cx + Math.cos(wAngle) * arrowLen;
    const tipY = cy + Math.sin(wAngle) * arrowLen;
    const tailX = cx - Math.cos(wAngle) * arrowLen * 0.65;
    const tailY = cy - Math.sin(wAngle) * arrowLen * 0.65;
    // Tail
    ctx.strokeStyle = '#f5d486';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, 3 * k);
    ctx.beginPath();
    ctx.moveTo(tailX, tailY); ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // Tip arrow
    const ax = Math.cos(wAngle), ay = Math.sin(wAngle);
    const px = -ay, py = ax;
    const tipBack = 12 * k;
    const tipSide = 7 * k;
    ctx.fillStyle = '#f5d486';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - ax * tipBack + px * tipSide, tipY - ay * tipBack + py * tipSide);
    ctx.lineTo(tipX - ax * tipBack - px * tipSide, tipY - ay * tipBack - py * tipSide);
    ctx.closePath();
    ctx.fill();

    // Center hub
    ctx.fillStyle = '#06121f';
    ctx.strokeStyle = '#f5d486';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 5 * Math.max(k, .6), 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    ctx.restore();
  }
}
