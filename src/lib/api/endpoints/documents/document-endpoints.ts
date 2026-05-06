const BASE = '/api/document';

export const DOCUMENT_ENDPOINTS = {
  uploadPublic: `${BASE}/public/upload`,
  viewPublic: (pathId: number) => `${BASE}/public/view/${pathId}`,
  downloadPublic:(pathId: number) => `${BASE}/public/download/${pathId}`,
  listPublic: `${BASE}/public/view/list`,
  deletePublic:  (pathId: number) => `${BASE}/public/delete/${pathId}`,

  listPrivate: `${BASE}/private/view/list`,
  viewPrivate:(pathId: number) => `${BASE}/private/view/${pathId}`,
  downloadPrivate:(pathId: number) => `${BASE}/private/download/${pathId}`,
  uploadPrivate: `${BASE}/private/upload`,
  batchUploadPrivate: `${BASE}/private/upload/batch`,
  deletePrivate: (pathId: number) => `${BASE}/private/delete/${pathId}`,
} as const;