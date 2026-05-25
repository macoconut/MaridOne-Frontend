import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { FiChevronDown, FiDownload, FiFileText, FiUpload } from 'react-icons/fi';
import ActionButton from '@/components/button/ActionButton';
import { useUiDialog } from '@/components/dialog/useUiDialog';
import PageHeader from '@/components/layout/PageHeader';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { ApiError } from '@/lib/api/api';
import {
  uploadPersonalDocuments,
  validateAndUploadPublicDocument,
} from '@/lib/api/endpoints/documents/document-upload';
import {
  downloadLibraryDocument,
  isDocumentsMockMode,
  loadDocumentLibrary,
  openLibraryDocument,
  type DocumentLibraryItem,
} from '@/lib/document/documentLibrary';
import { getFriendlyErrorMessage } from '@/lib/utils/uiErrors';
import { getAuthToken, getUserRole } from '@/lib/utils/session';
import './Training.css';

type DocumentSection = {
  id: 'public' | 'private';
  heading: string;
  documents: DocumentLibraryItem[];
};

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function formatDocumentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseJwtPayload(token: string | null): Record<string, unknown> | null {
  if (!token || token === 'authenticated-session') return null;

  const [, payload] = token.split('.');
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function tokenHasRole(token: string | null, role: string) {
  const payload = parseJwtPayload(token);
  const roles = payload?.roles;
  return Array.isArray(roles) && roles.includes(role);
}

function getDocumentUploadErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403) {
    return error.rawMessage
      ? `You do not have permission to perform this action. Server said: ${error.rawMessage}`
      : 'You do not have permission to perform this action. Please sign out and sign in again with an HR account.';
  }

  return getFriendlyErrorMessage(error, 'generic');
}

export default function Documents() {
  const { showSuccess } = useUiDialog();
  const personalFileInputRef = useRef<HTMLInputElement | null>(null);
  const companyFileInputRef = useRef<HTMLInputElement | null>(null);
  const canUploadCompanyDocuments = getUserRole() === 'hr' && tokenHasRole(getAuthToken(), 'ROLE_HR');
  const [openSections, setOpenSections] = useState<Record<DocumentSection['id'], boolean>>({
    public: true,
    private: true,
  });
  const [sections, setSections] = useState<DocumentSection[]>([
    {
      id: 'public',
      heading: 'Company Documents',
      documents: [],
    },
    {
      id: 'private',
      heading: 'My Documents',
      documents: [],
    },
  ]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingCompanyDocument, setIsUploadingCompanyDocument] = useState(false);

  useErrorDialogEffect(loadError, 'Documents could not be loaded');
  useErrorDialogEffect(actionError, 'Document action unavailable');

  async function refreshDocuments() {
    setLoading(true);
    setLoadError('');

    try {
      const library = await loadDocumentLibrary();
      setSections([
        {
          id: 'public',
          heading: 'Company Documents',
          documents: library.publicDocuments,
        },
        {
          id: 'private',
          heading: 'My Documents',
          documents: library.privateDocuments,
        },
      ]);
    } catch (error) {
      setSections((current) => current.map((section) => ({ ...section, documents: [] })));
      setLoadError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshDocuments();
  }, []);

  useAutoRefreshingPage(refreshDocuments, { enabled: false });

  function toggleSection(id: DocumentSection['id']) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDocumentAction(action: 'view' | 'download', document: DocumentLibraryItem) {
    const actionKey = `${action}-${document.scope}-${document.pathId}`;
    setActiveActionKey(actionKey);
    setActionError('');

    try {
      if (action === 'view') {
        await openLibraryDocument(document);
      } else {
        await downloadLibraryDocument(document);
      }
    } catch (error) {
      setActionError(getDocumentUploadErrorMessage(error));
    } finally {
      setActiveActionKey(null);
    }
  }

  function handleUploadButtonClick() {
    if (isDocumentsMockMode() || isUploading) return;
    personalFileInputRef.current?.click();
  }

  function handleCompanyUploadButtonClick() {
    if (isDocumentsMockMode() || isUploadingCompanyDocument) return;
    companyFileInputRef.current?.click();
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;

    setIsUploading(true);
    setActionError('');

    try {
      await uploadPersonalDocuments(files);
      await refreshDocuments();
      showSuccess(
        files.length === 1
          ? 'Your document was uploaded to My Documents.'
          : `${files.length} documents were uploaded to My Documents.`,
        'Upload Complete'
      );
      setOpenSections((prev) => ({ ...prev, private: true }));
    } catch (error) {
      setActionError(getDocumentUploadErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function handleCompanyFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';
    if (!file) return;

    setIsUploadingCompanyDocument(true);
    setActionError('');

    try {
      await validateAndUploadPublicDocument(file);
      await refreshDocuments();
      showSuccess('The company document was uploaded.', 'Upload Complete');
      setOpenSections((prev) => ({ ...prev, public: true }));
    } catch (error) {
      setActionError(getDocumentUploadErrorMessage(error));
    } finally {
      setIsUploadingCompanyDocument(false);
    }
  }

  return (
    <div className="trainingPage">
      <div className="trainingPage__head">
        <PageHeader
          title="Documents"
          description="Open shared company files and documents assigned to you from one workspace."
        />
        <div className="trainingPage__actions">
          <input
            ref={personalFileInputRef}
            className="trainingPage__fileInput"
            type="file"
            multiple
            onChange={(event) => void handleFileSelection(event)}
            disabled={isUploading || isDocumentsMockMode()}
          />
          {canUploadCompanyDocuments ? (
            <input
              ref={companyFileInputRef}
              className="trainingPage__fileInput"
              type="file"
              onChange={(event) => void handleCompanyFileSelection(event)}
              disabled={isUploadingCompanyDocument || isDocumentsMockMode()}
            />
          ) : null}
          {canUploadCompanyDocuments ? (
            <ActionButton
              type="button"
              icon={<FiUpload />}
              onClick={handleCompanyUploadButtonClick}
              disabled={isUploadingCompanyDocument || isDocumentsMockMode()}
            >
              {isUploadingCompanyDocument ? 'Uploading...' : 'Upload Company Document'}
            </ActionButton>
          ) : null}
          <ActionButton
            type="button"
            icon={<FiUpload />}
            onClick={handleUploadButtonClick}
            disabled={isUploading || isDocumentsMockMode()}
          >
            {isUploading ? 'Uploading...' : 'Upload to My Documents'}
          </ActionButton>
        </div>
      </div>

      {isDocumentsMockMode() ? (
        <p className="trainingPage__status">
          Mock documents are enabled for frontend testing. Real view and download URLs will be used
          when mock mode is disabled.
        </p>
      ) : null}

      <div className="trainingPage__stack">
        {sections.map((section) => {
          const isOpen = !!openSections[section.id];

          return (
            <section key={section.id} className="tmCard">
              <button
                type="button"
                className="tmCard__header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={isOpen}
                aria-controls={`documents-content-${section.id}`}
              >
                <span className="tmCard__headingGroup">
                  <span className="tmCard__title">{section.heading}</span>
                </span>
                <span className="tmCard__headerMeta">
                  <span className="tmCard__count">
                    {section.documents.length} {section.documents.length === 1 ? 'file' : 'files'}
                  </span>
                  <span className={`tmCard__chevron ${isOpen ? 'is-open' : ''}`}>
                    <FiChevronDown />
                  </span>
                </span>
              </button>

              {isOpen ? (
                <div id={`documents-content-${section.id}`} className="tmCard__content">
                  {section.documents.length > 0 ? (
                    section.documents.map((document) => {
                      const viewActionKey = `view-${document.scope}-${document.pathId}`;
                      const downloadActionKey = `download-${document.scope}-${document.pathId}`;

                      return (
                        <div key={`${document.scope}-${document.pathId}`} className="tmRow">
                          <button
                            type="button"
                            className="tmRow__main"
                            onClick={() => void handleDocumentAction('view', document)}
                            disabled={activeActionKey !== null}
                          >
                            <FiFileText className="tmRow__icon" />
                            <span className="tmRow__details">
                              <span className="tmRow__titleLine">
                                <span className="tmRow__name">
                                  {activeActionKey === viewActionKey
                                    ? 'Opening document...'
                                    : document.title}
                                </span>
                                <span className="tmRow__badge">{document.category}</span>
                              </span>
                              <span className="tmRow__meta">
                                <span>{formatFileSize(document.fileSizeBytes)}</span>
                                <span>Added {formatDocumentDate(document.createdAt)}</span>
                              </span>
                            </span>
                          </button>

                          <ActionButton
                            type="button"
                            className="tmRow__download"
                            size="sm"
                            icon={<FiDownload />}
                            onClick={() => void handleDocumentAction('download', document)}
                            disabled={activeActionKey !== null}
                          >
                            {activeActionKey === downloadActionKey ? 'Preparing...' : 'Download'}
                          </ActionButton>
                        </div>
                      );
                    })
                  ) : (
                    <div className="tmRow tmRow--empty">
                      <FiFileText className="tmRow__icon" />
                      <span className="tmRow__label">
                        {loading ? 'Loading documents...' : 'No documents available yet.'}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
