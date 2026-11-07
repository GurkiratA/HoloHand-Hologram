import { labelLayout } from '@/components/Hologram/labels';
import { holo } from '@/state/store';

/** Composites camera feed + hologram + hand overlay + labels into a PNG download. */
export function captureScreenshot(video: HTMLVideoElement | null, webgl: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);
  const s = holo();
  if (video && video.videoWidth && s.showFeed && s.cameraStatus === 'live') {
    const k = Math.max(W / video.videoWidth, H / video.videoHeight);
    const dw = video.videoWidth * k;
    const dh = video.videoHeight * k;
    ctx.save();
    if (s.settings.mirror) {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
    ctx.restore();
  }
  if (webgl) ctx.drawImage(webgl, 0, 0, W, H);
  if (overlay) ctx.drawImage(overlay, 0, 0, W, H);
  // labels
  ctx.font = '500 11px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  for (const [id, l] of labelLayout) {
    if (!l.visible) continue;
    const name = s.model?.parts.find((p) => p.meta.id === id)?.meta.name ?? id;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(l.ax, l.ay);
    ctx.lineTo(l.x, l.y);
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.textAlign = l.side === 'r' ? 'left' : 'right';
    ctx.fillText(name, l.side === 'r' ? l.x + 6 : l.x - 6, l.y);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'right';
  ctx.fillText(`HoloHand · ${s.descriptor?.name ?? ''}`, W - 12, H - 12);
  const a = document.createElement('a');
  a.download = `holohand-${Date.now()}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}
