import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import { ApiError } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

async function saveLocally(file, safeName) {
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), bytes);
  return `/uploads/${filename}`;
}

export async function POST(request) {
  try {
    const user = await getSessionUser(request);
    if (!user) {
      throw new ApiError(401, 'You must be signed in to upload files.');
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') {
      throw new ApiError(400, 'No file was provided.');
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError(400, 'File is too large (5MB max).');
    }

    const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

    let fileUrl;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(`uploads/${Date.now()}-${safeName}`, file, {
        access: 'public',
      });
      fileUrl = blob.url;
    } else {
      fileUrl = await saveLocally(file, safeName);
    }

    return NextResponse.json({ file_url: fileUrl });
  } catch (error) {
    return errorResponse(error);
  }
}
