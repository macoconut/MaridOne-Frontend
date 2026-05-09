import type { DocumentResponseDto } from './types/document-types';
import {
  getPublicDocumentViewUrl,
  getPublicDocumentDownloadUrl,
  getPrivateDocumentViewUrl,
  getPrivateDocumentDownloadUrl,
  getPublicDocuments,
  getPrivateDocuments,
  getPrivateDocumentByEntity,
} from './document-api';
import type { DocumentFilter } from './document-api';


export async function openDocumentAttachment(document: Pick<DocumentResponseDto, 'isPublic' | 'pathId'>): Promise<void> {
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

export async function openDocumentUsingEntityFilter(connectedEntity: string, connectedId: number): Promise<void> {
  const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;
  
  try {
    const url = await getPrivateDocumentByEntity({ connectedEntity, connectedId });
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

export async function downloadDocumentAttachment(document: Pick<DocumentResponseDto, 'isPublic' | 'pathId'>): Promise<void> {
  const url = document.isPublic
    ? await fetchPublicDocumentDownloadUrl(document.pathId)
    : await fetchPrivateDocumentDownloadUrl(document.pathId);
  window.location.href = url;
}


export async function fetchPublicDocumentList(): Promise<DocumentResponseDto[]> {
  return getPublicDocuments();
}

export async function fetchPublicDocumentViewUrl(pathId: number) {
  return getPublicDocumentViewUrl(pathId);
}

export async function fetchPublicDocumentDownloadUrl(pathId: number): Promise<string> {
  return getPublicDocumentDownloadUrl(pathId);
}

export async function fetchPrivateDocumentViewUrl(pathId: number): Promise<string> {
  return getPrivateDocumentViewUrl(pathId);
}

export async function fetchPrivateDocumentDownloadUrl(pathId: number): Promise<string> {
  return getPrivateDocumentDownloadUrl(pathId);
}

export async function fetchPrivateDocumentList(filter?: DocumentFilter): Promise<DocumentResponseDto[]> {
  return getPrivateDocuments(filter);
}