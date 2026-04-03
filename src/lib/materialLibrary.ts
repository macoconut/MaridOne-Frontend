import { apiFetchRaw } from './api';

export type LibraryDocument = {
  id: string;
  title: string;
  folder: string;
  fileName: string;
  downloadFileName: string;
};

export type MaterialLibrarySection = {
  id: 'training' | 'onboarding';
  heading: string;
  introduction: string;
  dashboardButtonLabel: string;
  artKind: 'training' | 'onboarding';
  documents: LibraryDocument[];
};

export type HandbookLibraryCard = {
  heading: string;
  introduction: string;
  viewLabel: string;
  downloadLabel: string;
  artKind: 'handbook';
  document: LibraryDocument;
};

const trainingDocuments: LibraryDocument[] = [
  {
    id: 'training-good-employee',
    title: 'Embracing the Marid Corporate Culture',
    folder: 'training-materials',
    fileName: 'embracing-the-marid-corporate-culture.pdf',
    downloadFileName: 'embracing-the-marid-corporate-culture.pdf',
  },
  {
    id: 'training-show-up-ready',
    title: 'Mastering Your Marid Work Schedule',
    folder: 'training-materials',
    fileName: 'mastering-your-marid-work-schedule.pdf',
    downloadFileName: 'mastering-your-marid-work-schedule.pdf',
  },
  {
    id: 'training-quiet-teamwork',
    title: 'Building Trust in the Manufacturing Workflow',
    folder: 'training-materials',
    fileName: 'building-trust-in-the-manufacturing-workflow.pdf',
    downloadFileName: 'building-trust-in-the-manufacturing-workflow.pdf',
  },
  {
    id: 'training-small-habits',
    title: 'Compliance and Accountability Practices',
    folder: 'training-materials',
    fileName: 'compliance-and-accountability-practices.pdf',
    downloadFileName: 'compliance-and-accountability-practices.pdf',
  },
  {
    id: 'training-stay-sharp',
    title: 'Sustaining High Performance at Marid',
    folder: 'training-materials',
    fileName: 'sustaining-high-performance-at-marid.pdf',
    downloadFileName: 'sustaining-high-performance-at-marid.pdf',
  },
];

const onboardingDocuments: LibraryDocument[] = [
  {
    id: 'onboarding-first-week',
    title: 'The Marid Industries Onboarding Roadmap',
    folder: 'onboarding-materials',
    fileName: 'the-marid-industries-onboarding-roadmap.pdf',
    downloadFileName: 'the-marid-industries-onboarding-roadmap.pdf',
  },
  {
    id: 'onboarding-day-one',
    title: 'Igniting Your Journey: Day One Guide',
    folder: 'onboarding-materials',
    fileName: 'igniting-your-journey-day-one-guide.pdf',
    downloadFileName: 'igniting-your-journey-day-one-guide.pdf',
  },
  {
    id: 'onboarding-systems',
    title: 'Accessing Your Employee Portals & Tools',
    folder: 'onboarding-materials',
    fileName: 'accessing-your-employee-portals-and-tools.pdf',
    downloadFileName: 'accessing-your-employee-portals-and-tools.pdf',
  },
  {
    id: 'onboarding-meet-people',
    title: 'Connecting with Your Department Teams',
    folder: 'onboarding-materials',
    fileName: 'connecting-with-your-department-teams.pdf',
    downloadFileName: 'connecting-with-your-department-teams.pdf',
  },
  {
    id: 'onboarding-checklist',
    title: 'Your Official 201 File & Document Checklist',
    folder: 'onboarding-materials',
    fileName: 'your-official-201-file-and-document-checklist.pdf',
    downloadFileName: 'your-official-201-file-and-document-checklist.pdf',
  },
];

export const handbookLibraryCard: HandbookLibraryCard = {
  heading: 'Policy and Support Guide',
  introduction:
    'Your official reference for life at Marid. Access complete guidelines on our Code of Ethics, attendance and timekeeping policies, compensation, benefits, and workplace standards.',
  viewLabel: 'View Handbook',
  downloadLabel: 'Download Handbook',
  artKind: 'handbook',
  document: {
    id: 'handbook',
    title: 'Employee handbook',
    folder: 'employee-handbook',
    fileName: 'MARID-EMPLOYEE-HANDBOOK-V.1-2025.pdf',
    downloadFileName: 'MARID-EMPLOYEE-HANDBOOK-V.1-2025.pdf',
  },
};

export const materialLibrarySections: MaterialLibrarySection[] = [
  {
    id: 'training',
    heading: 'Training Essentials',
    introduction:
      'These guides reinforce Marid\'s operational standards, safety compliance, and performance expectations.',
    dashboardButtonLabel: 'Open Training Materials',
    artKind: 'training',
    documents: trainingDocuments,
  },
  {
    id: 'onboarding',
    heading: 'Onboarding Starter Pack',
    introduction:
      'Find key introductions, a checklist for your pre-employment requirements, and immediate system access links.',
    dashboardButtonLabel: 'Open Onboarding Materials',
    artKind: 'onboarding',
    documents: onboardingDocuments,
  },
];

function buildLibraryDocumentPath(document: LibraryDocument) {
  return `/api/LOCAL/document/library/${encodeURIComponent(document.folder)}/${encodeURIComponent(document.fileName)}`;
}

async function fetchLibraryDocumentBlob(document: LibraryDocument) {
  const response = await apiFetchRaw(buildLibraryDocumentPath(document), { method: 'GET' });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message.trim().length > 0 ? message : `Unable to load ${document.title}.`);
  }

  return response.blob();
}

export async function openLibraryDocument(document: LibraryDocument) {
  const previewWindow = typeof window !== 'undefined' ? window.open('', '_blank') : null;

  try {
    const blob = await fetchLibraryDocumentBlob(document);
    const objectUrl = URL.createObjectURL(blob);

    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.location.href = objectUrl;
    } else {
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    }

    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    previewWindow?.close();
    throw error;
  }
}

export async function downloadLibraryDocument(document: LibraryDocument) {
  const blob = await fetchLibraryDocumentBlob(document);
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement('a');

  link.href = objectUrl;
  link.download = document.downloadFileName;
  window.document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
}
