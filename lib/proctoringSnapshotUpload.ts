import { v2 as cloudinary } from 'cloudinary';

function configureIfPossible(): boolean {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
  return true;
}

/**
 * Upload ảnh JPEG base64 (không có prefix data URL) lên Cloudinary. Trả về secure_url hoặc null.
 */
export async function uploadProctoringViolationSnapshot(
  jpegBase64Raw: string,
  context: { sessionId: number; examineeId: number; violationIdHint?: string }
): Promise<string | null> {
  const trimmed = jpegBase64Raw.trim();
  if (!trimmed || !configureIfPossible()) return null;

  const dataUri = trimmed.startsWith('data:') ? trimmed : `data:image/jpeg;base64,${trimmed}`;
  const safeHint = (context.violationIdHint ?? `${Date.now()}`).replace(/[^\w-]/g, '_').slice(0, 80);
  const publicId = `s${context.sessionId}_e${context.examineeId}_${safeHint}`;

  try {
    const res = await new Promise<{ secure_url?: string } | null>((resolve, reject) => {
      cloudinary.uploader.upload(
        dataUri,
        {
          folder: 'proctoring/violations',
          public_id: publicId,
          overwrite: false,
          resource_type: 'image',
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result ?? null);
        }
      );
    });
    return typeof res?.secure_url === 'string' ? res.secure_url : null;
  } catch {
    return null;
  }
}
