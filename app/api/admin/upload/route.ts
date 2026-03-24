import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/auth';
import { v2 as cloudinary } from 'cloudinary';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: 'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET)' },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file || !file.size) {
      return NextResponse.json(
        { error: 'Vui lòng chọn file ảnh' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = `data:${file.type};base64,${buffer.toString('base64')}`;

    const result = await new Promise<{ secure_url?: string; error?: { message?: string } }>(
      (resolve, reject) => {
        cloudinary.uploader.upload(base64, { folder: 'dickson' }, (err, res) => {
          if (err) reject(err);
          else resolve(res || {});
        });
      }
    );

    if (result.error) {
      return NextResponse.json(
        { error: result.error.message || 'Upload thất bại' },
        { status: 400 }
      );
    }

    if (!result.secure_url) {
      return NextResponse.json({ error: 'Upload thất bại' }, { status: 500 });
    }

    return NextResponse.json({ url: result.secure_url });
  } catch (e) {
    console.error('Upload error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Lỗi upload' },
      { status: 500 }
    );
  }
}
