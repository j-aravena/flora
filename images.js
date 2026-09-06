// Compresión de fotos con canvas. WebP calidad 0,8; JPEG 0,85 si el navegador no codifica WebP.

function escalar(bitmap, ladoMax) {
  const factor = Math.min(1, ladoMax / Math.max(bitmap.width, bitmap.height));
  return { ancho: Math.max(1, Math.round(bitmap.width * factor)), alto: Math.max(1, Math.round(bitmap.height * factor)) };
}

function aBlob(canvas, tipo, calidad) {
  return new Promise(resolver => canvas.toBlob(resolver, tipo, calidad));
}

async function codificar(bitmap, ancho, alto) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, ancho, alto);
  let blob = await aBlob(canvas, 'image/webp', 0.8);
  if (!blob || blob.type !== 'image/webp') blob = await aBlob(canvas, 'image/jpeg', 0.85);
  return blob;
}

export async function procesarImagen(archivo, ladoMax = 1200, ladoMini = 200) {
  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  const grande = escalar(bitmap, ladoMax);
  const chica = escalar(bitmap, ladoMini);
  const blob = await codificar(bitmap, grande.ancho, grande.alto);
  const miniatura = await codificar(bitmap, chica.ancho, chica.alto);
  bitmap.close();
  return { blob, miniatura, ancho: grande.ancho, alto: grande.alto };
}
