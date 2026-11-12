import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { put } from '@vercel/blob';
import { ApiError } from '@/server/entity-api';
import { errorResponse } from '@/server/http';
import { getSessionUser } from '@/server/session';

export const dynamic = 'force-dynamic';

// Vercel caps a Function's request body at 4.5MB, and the 413 is returned
// before this handler runs - so the app limit has to stay under that.
const MAX_BYTES = 4 * 1024 * 1024;

const NOT_CONFIGURED =
  'File uploads are not configured on this deployment. Connect a Vercel Blob store to the project so BLOB_READ_WRITE_TOKEN is set.';

// Dev-only fallback. Vercel ships the app as a read-only bundle (/var/task),
// so writing into public/ there fails with ENOENT/EROFS.
async function saveLocally(file, safeName) {
  if (process.env.VERCEL) throw new ApiError(503, NOT_CONFIGURED);

  const dir = path.join(process.cwd(), 'public', 'uploads');
  const filename = `${Date.now()}-${safeName}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), bytes);
  } catch (error) {
    if (['ENOENT', 'EROFS', 'EACCES', 'EPERM'].includes(error?.code)) {
      throw new ApiError(503, NOT_CONFIGURED);
    }
    throw error;
  }
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
      throw new ApiError(400, 'File is too large (4MB max).');
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
