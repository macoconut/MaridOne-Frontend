import { DOCUMENTS_MOCK_MODE } from '@/config/flags';
import {
  downloadDocumentAttachment,
  fetchPrivateDocumentList,
  fetchPublicDocumentList,
  openDocumentAttachment,
} from '@/lib/api/endpoints/documents/document-fetch';
import type { DocumentResponseDto } from '@/lib/api/endpoints/documents/types/document-types';

export type DocumentScope = 'public' | 'private';

export type DocumentLibraryItem = DocumentResponseDto & {
  scope: DocumentScope;
  title: string;
  category: string;
  description: string;
  source: 'api' | 'mock';
};

export type DocumentLibrary = {
  publicDocuments: DocumentLibraryItem[];
  privateDocuments: DocumentLibraryItem[];
};

const MOCK_PUBLIC_DOCUMENTS: DocumentLibraryItem[] = [
  {
    pathId: -1001,
    fileName: 'Employee Handbook.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 1_420_000,
    createdAt: '2026-04-15T08:00:00+08:00',
    updatedAt: null,
    isPublic: true,
    scope: 'public',
    title: 'Employee Handbook',
    category: 'Handbook',
    description: 'Company-wide handbook and day-to-day HR reference.',
    source: 'mock',
  },
  {
    pathId: -1002,
    fileName: 'Workplace Policies.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 960_000,
    createdAt: '2026-04-19T09:30:00+08:00',
    updatedAt: '2026-04-22T10:15:00+08:00',
    isPublic: true,
    scope: 'public',
    title: 'Workplace Policies',
    category: 'Policy',
    description: 'Core company policies, employee conduct, and workplace guidance.',
    source: 'mock',
  },
  {
    pathId: -1003,
    fileName: 'Onboarding Training Materials.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 1_110_000,
    createdAt: '2026-04-25T13:45:00+08:00',
    updatedAt: null,
    isPublic: true,
    scope: 'public',
    title: 'Onboarding Training Materials',
    category: 'Training',
    description: 'Starter training material for new hires and role transitions.',
    source: 'mock',
  },
];

const MOCK_PRIVATE_DOCUMENTS: DocumentLibraryItem[] = [
  {
    pathId: -2001,
    fileName: 'April 2026 Payslip.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 240_000,
    createdAt: '2026-05-01T08:00:00+08:00',
    updatedAt: null,
    isPublic: false,
    scope: 'private',
    title: 'April 2026 Payslip',
    category: 'Payslip',
    description: 'Private payroll document sample for frontend verification.',
    source: 'mock',
  },
  {
    pathId: -2002,
    fileName: 'Leave Attachment - Medical Certificate.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 510_000,
    createdAt: '2026-04-27T16:20:00+08:00',
    updatedAt: null,
    isPublic: false,
    scope: 'private',
    title: 'Leave Attachment - Medical Certificate',
    category: 'Leave',
    description: 'Example private leave attachment while cloud URLs are unavailable.',
    source: 'mock',
  },
  {
    pathId: -2003,
    fileName: 'Overtime Approval Attachment.pdf',
    fileType: 'application/pdf',
    fileSizeBytes: 390_000,
    createdAt: '2026-04-24T18:10:00+08:00',
    updatedAt: null,
    isPublic: false,
    scope: 'private',
    title: 'Overtime Approval Attachment',
    category: 'Overtime',
    description: 'Example overtime support file for local UI checks.',
    source: 'mock',
  },
];

function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || fileName;
}

function categoryFromDocument(document: DocumentResponseDto, scope: DocumentScope) {
  const name = document.fileName.toLowerCase();

  if (name.includes('handbook')) return 'Handbook';
  if (name.includes('policy') || name.includes('policies')) return 'Policy';
  if (name.includes('training') || name.includes('onboarding')) return 'Training';
  if (name.includes('payslip')) return 'Payslip';
  if (name.includes('leave')) return 'Leave';
  if (name.includes('overtime')) return 'Overtime';

  return scope === 'public' ? 'Company' : 'Personal';
}

function mapApiDocument(document: DocumentResponseDto, scope: DocumentScope): DocumentLibraryItem {
  const category = categoryFromDocument(document, scope);

  return {
    ...document,
    scope,
    title: titleFromFileName(document.fileName),
    category,
    description:
      scope === 'public'
        ? `${category} document from the company library.`
        : `${category} document available in your private document library.`,
    source: 'api',
  };
}

export function isDocumentsMockMode() {
  return DOCUMENTS_MOCK_MODE;
}

export async function loadDocumentLibrary(): Promise<DocumentLibrary> {
  if (DOCUMENTS_MOCK_MODE) {
    return {
      publicDocuments: MOCK_PUBLIC_DOCUMENTS,
      privateDocuments: MOCK_PRIVATE_DOCUMENTS,
    };
  }

  const [publicDocuments, privateDocuments] = await Promise.all([
    fetchPublicDocumentList(),
    fetchPrivateDocumentList(),
  ]);

  return {
    publicDocuments: publicDocuments.map((document) => mapApiDocument(document, 'public')),
    privateDocuments: privateDocuments.map((document) => mapApiDocument(document, 'private')),
  };
}

export function getRecentDocuments(
  publicDocuments: DocumentLibraryItem[],
  privateDocuments: DocumentLibraryItem[],
  limit = 3
) {
  return [...publicDocuments, ...privateDocuments]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

export function getEmployeeHandbookDocument(publicDocuments: DocumentLibraryItem[]) {
  const handbookDocuments = publicDocuments.filter((document) => {
    const searchableText = [
      document.title,
      document.fileName,
      document.category,
      document.description,
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes('handbook');
  });

  return handbookDocuments
    .sort((left, right) => {
      const leftScore = `${left.title} ${left.fileName}`.toLowerCase().includes('employee handbook') ? 1 : 0;
      const rightScore = `${right.title} ${right.fileName}`.toLowerCase().includes('employee handbook') ? 1 : 0;

      if (leftScore !== rightScore) return rightScore - leftScore;

      const leftDate = new Date(left.updatedAt ?? left.createdAt).getTime();
      const rightDate = new Date(right.updatedAt ?? right.createdAt).getTime();
      return rightDate - leftDate;
    })[0] ?? null;
}

export function canUseLibraryDocument(document: DocumentLibraryItem | null) {
  return Boolean(document && document.source === 'api' && !DOCUMENTS_MOCK_MODE);
}

export async function openLibraryDocument(document: DocumentLibraryItem) {
  if (document.source === 'mock' || DOCUMENTS_MOCK_MODE) {
    throw new Error('Document preview is unavailable while mock documents are enabled.');
  }

  await openDocumentAttachment(document);
}

export async function downloadLibraryDocument(document: DocumentLibraryItem) {
  if (document.source === 'mock' || DOCUMENTS_MOCK_MODE) {
    throw new Error('Document download is unavailable while mock documents are enabled.');
  }

  await downloadDocumentAttachment(document);
}
