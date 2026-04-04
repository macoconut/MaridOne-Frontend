import { apiFetchRaw } from './api';

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
    `/api/LOCAL/document/${pathId}/view`,
    `/api/document/${pathId}/view`,
  ];

  let documentBlob: Blob | null = null;

  for (const path of documentViewPaths) {
    const response = await apiFetchRaw(path, { method: 'GET' });

    if (response.ok) {
      documentBlob = await response.blob();
      break;
    }

    if (response.status !== 404) {
      throw new Error(`Failed to open the attachment (${response.status}).`);
    }
  }

  if (!documentBlob) {
    throw new Error('The attachment could not be opened.');
  }

  const documentUrl = URL.createObjectURL(documentBlob);
  const anchor = document.createElement('a');
  anchor.href = documentUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.click();

  window.setTimeout(() => URL.revokeObjectURL(documentUrl), 60_000);
}
