// document.api.ts
import { DOCUMENT_ENDPOINTS } from './document-endpoints';
import { buildUrl } from '@/lib/api/utils/build-url';
import { apiFetchJson, apiFetchRaw } from '../../api';
import type { Directory } from '@/enum/directories';
import type { DocumentResponseDto } from './types/document-types';

export type DocumentFilter = {
  username?: string;
};


export type EntityFilter = {
  connectedEntity: string;
  connectedId: number;
};



export function getPublicDocuments() {
  return apiFetchJson<DocumentResponseDto[]>(DOCUMENT_ENDPOINTS.listPublic);
}

export function getPublicDocumentViewUrl(pathId: number) {
  return apiFetchJson<string>(DOCUMENT_ENDPOINTS.viewPublic(pathId));
}

export function getPublicDocumentDownloadUrl(pathId: number) {
  return apiFetchJson<string>(DOCUMENT_ENDPOINTS.downloadPublic(pathId));
}

export function deletePublicDocument(pathId: number) {
  return apiFetchRaw(DOCUMENT_ENDPOINTS.deletePublic(pathId), { method: 'DELETE' });
}

export function uploadPublicDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiFetchRaw(DOCUMENT_ENDPOINTS.uploadPublic, { method: 'POST', body: formData });
}

export function existsByEntity(filter: EntityFilter) {
  return apiFetchJson<boolean>(buildUrl(DOCUMENT_ENDPOINTS.existsByEntity, filter));
}



// PRIVATE
export function getPrivateDocuments(filter?: DocumentFilter) {
  return apiFetchJson<DocumentResponseDto[]>(
    buildUrl(DOCUMENT_ENDPOINTS.listPrivate, filter)
  );
}

export function getPrivateDocumentByEntity(filter: EntityFilter) {
  return apiFetchJson<string>(
    buildUrl(DOCUMENT_ENDPOINTS.viewPrivateByEntity, filter)
  );
}

export function getPrivateDocumentViewUrl(pathId: number) {
  return apiFetchJson<string>(DOCUMENT_ENDPOINTS.viewPrivate(pathId));
}

export function getPrivateDocumentDownloadUrl(pathId: number) {
  return apiFetchJson<string>(DOCUMENT_ENDPOINTS.downloadPrivate(pathId));
}



export function batchUploadPrivateDocuments(files: File[], subDir: Directory, connectedId?: number) {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  formData.append('subDir', subDir);
  if (connectedId != null) formData.append('connectedId', String(connectedId));
  return apiFetchRaw(DOCUMENT_ENDPOINTS.batchUploadPrivate, { method: 'POST', body: formData });
}

export function deletePrivateDocument(pathId: number) {
  return apiFetchRaw(DOCUMENT_ENDPOINTS.deletePrivate(pathId), { method: 'DELETE' });
}