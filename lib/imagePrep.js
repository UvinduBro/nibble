'use client';
// Shrink a picture in the browser before upload: max 1600 px on the long side, WebP (JPEG where WebP
// isn't supported), so most photos end up well under the 2 MB limit. Re-drawing also drops the
// photo's hidden metadata (EXIF: location, phone model).
export const MAX_UPLOAD = 2 * 1024 * 1024;
export async function prepImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Pick a picture (JPG, PNG or WebP).');
  if (file.size > 25 * 1024 * 1024) throw new Error('That picture is too big. Pick one under 25 MB.');
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Couldn’t open that picture. Try a JPG or PNG.');
  let side = 1600;
  for (let i = 0; i < 4; i++) {
    const k = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(bmp, 0, 0, w, h);
    for (const [type, q] of [['image/webp', 0.82], ['image/jpeg', 0.82], ['image/webp', 0.66]]) {
      const blob = await new Promise((res) => c.toBlob(res, type, q));
      if (blob && blob.type === type && blob.size <= MAX_UPLOAD) return { blob, type, w, h, ext: type === 'image/webp' ? 'webp' : 'jpg' };
    }
    side = Math.round(side * 0.75);
  }
  throw new Error('That picture is too big even after shrinking. Try a smaller one.');
}
