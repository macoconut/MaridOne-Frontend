import { apiFetchRaw, throwApiErrorIfNeeded } from '../api/api';
import type { DocumentResponseDto } from './types/documentResponse';

async function fetchPresignedUrl(endpoint: string): Promise<string> {
  const response = await apiFetchRaw(endpoint, { method: 'GET' });
  if (!response.ok) {
    const errorBody = await response.text();
    throwApiErrorIfNeeded(response, errorBody);
    throw new Error('Unreachable'); 
  }
  return response.text();
}

export async function openDocumentAttachment(document: DocumentResponseDto): Promise<void> {
  const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;

  try {
    const url = document.isPublic
      ? await fetchPublicDocumentViewUrl(document.pathId)
      : await fetchPrivateDocumentViewUrl(document.pathId);

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.href = url;
    } else {
      window.location.href = url;
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}

export async function downloadDocumentAttachment(document: DocumentResponseDto): Promise<void> {
  const url = document.isPublic
    ? await fetchPublicDocumentDownloadUrl(document.pathId)
    : await fetchPrivateDocumentDownloadUrl(document.pathId);
  window.location.href = url;
}




export async function fetchPublicDocumentList(): Promise<DocumentResponseDto[]> {
  const response = await apiFetchRaw('/api/document/public/view/list', { method: 'GET' });
  if (!response.ok) {
    const text = await response.text();
    throwApiErrorIfNeeded(response, text);
    throw new Error('Unreachable');
  }
  return response.json() as Promise<DocumentResponseDto[]>;
}

export async function fetchPublicDocumentViewUrl(pathId: number): Promise<string> {
  return fetchPresignedUrl(`/api/document/public/view/${pathId}`);
}

export async function fetchPublicDocumentDownloadUrl(pathId: number): Promise<string> {
  return fetchPresignedUrl(`/api/document/public/download/${pathId}`);
}

export async function fetchPrivateDocumentViewUrl(pathId: number): Promise<string> {
  return fetchPresignedUrl(`/api/document/private/view/${pathId}`);
}

export async function fetchPrivateDocumentDownloadUrl(pathId: number): Promise<string> {
  return fetchPresignedUrl(`/api/document/private/download/${pathId}`);
}