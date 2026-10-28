// ==========================================================================
// النسخة التجريبية: بصمة مبسّطة للصورة (بلا نموذج ذكاء اصطناعي).
// الصفحة الأونلاين ما تقدرش تحمّل نموذج CLIP، فهنا كنستعملو صورة صغيرة أبيض وأسود (16×32 = 512 رقم).
// النظام الحقيقي (assets/vision.js) كيستعمل CLIP عبر transformers.js — شوف «كود السيرفر».
// ==========================================================================
export const MODEL_TAG = 'demo-gray-v1';

export async function embed(blob) {
  const bmp = await createImageBitmap(blob);
  const W = 16, H = 32, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  const k = Math.min(W / bmp.width, H / bmp.height), w = bmp.width * k, h = bmp.height * k;
  g.filter = 'grayscale(1)';
  g.drawImage(bmp, (W - w) / 2, (H - h) / 2, w, h);
  const px = g.getImageData(0, 0, W, H).data, v = new Float32Array(W * H);
  let mean = 0;
  for (let i = 0; i < v.length; i++) { v[i] = px[i * 4] / 255; mean += v[i]; }
  mean /= v.length;
  let n = 0;
  for (let i = 0; i < v.length; i++) { v[i] -= mean; n += v[i] * v[i]; }
  n = Math.sqrt(n) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  const bytes = new Uint8Array(v.buffer); let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function isLoaded() { return true; }
