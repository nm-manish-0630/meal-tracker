const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;

function getCanvasDimensions(orientation: number, width: number, height: number) {
  return orientation >= 5 && orientation <= 8 ? { width: height, height: width } : { width, height };
}

function applyOrientationTransform(ctx: CanvasRenderingContext2D, orientation: number, width: number, height: number) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, height, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, height, width);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, width);
      break;
    default:
      break;
  }
}

export async function compressImage(file: File, orientation: number): Promise<Blob> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(imageBitmap.width, imageBitmap.height));
  const width = Math.round(imageBitmap.width * scale);
  const height = Math.round(imageBitmap.height * scale);

  const canvasDimensions = getCanvasDimensions(orientation, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = canvasDimensions.width;
  canvas.height = canvasDimensions.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not supported');

  applyOrientationTransform(ctx, orientation, width, height);
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}
