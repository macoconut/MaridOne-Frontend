import type { DocumentResponseDto } from './types/documentResponse';
import { fetchPublicDocumentViewUrl } from './documentFetch';
import { fetchPublicDocumentDownloadUrl } from './documentFetch';


export type MaterialLibrarySection = {
  id: 'training' | 'onboarding';
  heading: string;
  introduction: string;
  dashboardButtonLabel: string;
  artKind: 'training' | 'onboarding';
  documents: DocumentResponseDto[];
};

export type HandbookLibraryCard = {
  heading: string;
  introduction: string;
  viewLabel: string;
  downloadLabel: string;
  artKind: 'handbook';
  document: DocumentResponseDto | null;
};


//sorting
export function compareLibraryDocuments(left: DocumentResponseDto, right: DocumentResponseDto) {
  return left.fileName.localeCompare(right.fileName, undefined, {
    sensitivity: 'base',
    numeric: true,
  });
}

export function sortLibraryDocuments(documents: DocumentResponseDto[]) {
  return [...documents].sort(compareLibraryDocuments);
}


export async function openLibraryDocument(document: DocumentResponseDto) {
  const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;

  try {
    const documentUrl = await fetchPublicDocumentViewUrl(document.pathId);

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.href = documentUrl;
    } else {
      const link = window.document.createElement('a');
      link.href = documentUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    }
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}


export async function downloadLibraryDocument(document: DocumentResponseDto) {
  try {
    const documentUrl = await fetchPublicDocumentDownloadUrl(document.pathId);
    const link = window.document.createElement('a');
    link.href = documentUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (error) {
    console.error('Failed to download document', error);
    throw error;
  }
}

