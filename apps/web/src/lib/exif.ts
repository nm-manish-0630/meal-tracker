import piexif from 'piexifjs';

export interface ExifData {
  capturedAt: Date | null;
  orientation: number;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseExifDateTime(value: string): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
}

export async function readExif(file: File): Promise<ExifData> {
  try {
    const dataUrl = await fileToDataUrl(file);
    const exifObj = piexif.load(dataUrl);
    const dateTimeOriginal = exifObj.Exif?.[piexif.ExifIFD.DateTimeOriginal] as string | undefined;
    const orientation = (exifObj['0th']?.[piexif.ImageIFD.Orientation] as number | undefined) ?? 1;
    return {
      capturedAt: dateTimeOriginal ? parseExifDateTime(dateTimeOriginal) : null,
      orientation,
    };
  } catch {
    return { capturedAt: null, orientation: 1 };
  }
}
