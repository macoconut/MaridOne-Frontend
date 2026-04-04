import { ApiError, apiFetchRaw } from './api';

const DOCUMENT_UPLOAD_PATHS = ['/api/document/upload', '/api/LOCAL/document/upload'] as const;

function parseUploadPayload(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function uploadDocument(file: File, subDir: string): Promise<number> {
  for (const path of DOCUMENT_UPLOAD_PATHS) {
    const form = new FormData();
    form.append('file', file);
    form.append('subDir', subDir);

    const response = await apiFetchRaw(path, {
      method: 'POST',
      body: form,
    });

    const text = await response.text();
    if (response.ok) {
      const payload = parseUploadPayload(text);
      const pathId = typeof payload?.pathId === 'number' ? payload.pathId : null;
      if (pathId != null) {
        return pathId;
      }

      throw new Error('Document upload succeeded but no file reference was returned.');
    }

    if (response.status !== 404) {
      throw new ApiError(
        response.status,
        text || `Document upload failed (${response.status}).`,
        text || `Document upload failed (${response.status}).`
      );
    }
  }

  throw new Error('Document upload endpoint is not enabled in current backend profile.');
}
