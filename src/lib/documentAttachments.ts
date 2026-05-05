import { apiFetchText, ApiError } from './api';

const ATTACHMENT_ID_PATTERN = /\(Attachment ID:\s*(\d+)\)/gi;

export function extractAttachmentReference(value?: string) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return {
      attachmentPathId: null as number | null,
      cleanText: '',
    };
  }

  let attachmentPathId: number | null = null;
  const cleanText = value
    .replace(ATTACHMENT_ID_PATTERN, (_match, idText: string) => {
      const parsed = Number.parseInt(idText, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        attachmentPathId = parsed;
      }
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    attachmentPathId,
    cleanText,
  };
}

export async function openDocumentAttachment(pathId: number) {
  const documentViewPaths = [
    `/api/document/private/view/${pathId}`,
    `/api/document/public/view/${pathId}`,
  ];

  let presignedUrl: string | null = null;

  for (const path of documentViewPaths) {
    try {
      // Use apiFetchText to directly resolve the string payload and handle non-OK statuses
      const url = await apiFetchText(path, { method: 'GET' });
      if (url) {
        presignedUrl = url;
        break;
      }
    } catch (error: unknown) {
      // Safely check against the custom ApiError provided by the context
      const status = error instanceof ApiError ? error.status : undefined;
      
      // If it's a 404, we want the loop to continue to the next path.
      if (status !== 404) {
        throw new Error(`Failed to open the attachment (${status ?? 'unknown'}).`);
      }
    }
  }

  if (!presignedUrl) {
    throw new Error('The attachment could not be opened.');
  }

  const anchor = document.createElement('a');
  anchor.href = presignedUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.click();
}