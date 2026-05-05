import { throwApiErrorIfNeeded, apiFetchRaw, ApiError } from '../api/api';
import type { Directory } from '@/enum/directories';

const MAX_REQUEST_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_FILES = 5;
const REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE = 'Attachment is too large. Files for requests must be 10 MB or smaller.';

function validationError(message: string): ApiError {
  return new ApiError({ code: 'VALIDATION_ERROR', message, status: 400, timestamp: new Date().toISOString() });
}

function validateFiles(files: File[]): void {
  if (files.length === 0) throw validationError('No files provided for upload.');
  if (files.length > MAX_ATTACHMENT_FILES) throw validationError(`Too many files. A maximum of ${MAX_ATTACHMENT_FILES} files can be uploaded at once.`);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_REQUEST_ATTACHMENT_BYTES) throw validationError(REQUEST_ATTACHMENT_TOO_LARGE_MESSAGE);
}

export async function batchUploadPrivateDocuments(files: File[], subDir: Directory, connectedId?: number): Promise<void> {
  validateFiles(files);

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

  if (!response.ok) {
    const text = await response.text();
    throwApiErrorIfNeeded(response, text);
  }
}