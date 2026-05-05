import { ApiError, apiFetchRaw } from './api';
import type { Directory } from '../enum/directories';
const DOCUMENT_UPLOAD_PATHS = ['/api/document/upload', '/api/LOCAL/document/upload'] as const;
const MAX_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 5;
const REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE = 'Attachment is too large. Files for requests must be 10 MB or smaller.';

function parseUploadPayload(text: string) {
  if (!text) return null;

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractUploadErrorMessage(text: string, status: number) {
  const payload = parseUploadPayload(text);
  if (typeof payload?.error === 'string' && payload.error.trim().length > 0) {
    return payload.error.trim();
  }
  if (typeof payload?.message === 'string' && payload.message.trim().length > 0) {
    return payload.message.trim();
  }
  return text || `Document upload failed (${status}).`;
}

export async function uploadDocument(file: File, subDir: string): Promise<number> {
  if (file.size > MAX_REQUEST_ATTACHMENT_BYTES) {
    throw new ApiError(413, REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE, REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE);
  }

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
      const message =
        response.status === 413
          ? REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE
          : extractUploadErrorMessage(text, response.status);
      throw new ApiError(
        response.status,
        message,
        message
      );
    }
  }

  throw new Error('Document upload endpoint is not enabled in current backend profile.');
}

// will probably be used more in the future than single uploads
export async function batchUploadPrivateDocuments(files: File[], subDir: Directory, connectedId?: number): Promise<void> {
  if  (files.length === 0) {
    return;
  }
  if (files.length > MAX_ATTACHMENT_FILES) {
    throw new ApiError(400, `Too many files. A maximum of ${MAX_ATTACHMENT_FILES} files can be uploaded at once.`)
  }

  const form = new FormData();
  for (const file of files) {
    form.append('files', file);
  }
  form.append('subDir', subDir);
  if (connectedId != null) {
    form.append('connectedId', String(connectedId));
  }

  const response = await apiFetchRaw('/api/document/private/upload/batch', {
    method: 'POST',
    body: form,
  });

  if (response.ok) return;

  if (response.status !== 404) {
    const text = await response.text();
    const message = extractUploadErrorMessage(text, response.status);
    throw new ApiError(response.status, message, message);
  }

  throw new ApiError(500, "Unknown error during document upload. Please try again later.");
}

