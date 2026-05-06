import { useMemo, useState } from 'react';
import { FiChevronDown, FiDownload, FiFileText } from 'react-icons/fi';
import ActionButton from '@/components/button/ActionButton';
import PageHeader from '@/components/layout/PageHeader';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import {
  downloadLibraryDocument,
  materialLibrarySections,
  openLibraryDocument,
  type LibraryDocument,
} from '@/lib/document/publicLibrary';
import { getFriendlyErrorMessage } from '@/lib/utils/uiErrors';
import './Training.css';

export default function Training() {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    onboarding: true,
    training: true,
  });
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useErrorDialogEffect(actionError, 'Training document action failed');

  const isEmpty = useMemo(
    () =>
      materialLibrarySections.length === 0 ||
      materialLibrarySections.every((section) => section.documents.length === 0),
    []
  );

  function toggleSection(id: string) {
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function handleDocumentAction(action: 'view' | 'download', document: LibraryDocument) {
    const actionKey = `${action}-${document.id}`;
    setActiveActionKey(actionKey);
    setActionError('');

    try {
      if (action === 'view') {
        await openLibraryDocument(document);
      } else {
        await downloadLibraryDocument(document);
      }
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'generic'));
    } finally {
      setActiveActionKey(null);
    }
  }

  return (
    <div className="trainingPage">
      <div className="trainingPage__head">
        <PageHeader
          title="Training Materials"
          description="Open onboarding guides, policy references, and training documents assigned to employees."
        />
      </div>

      <div className="trainingPage__stack">
        {!isEmpty ? (
          materialLibrarySections.map((section) => {
            const isOpen = !!openSections[section.id];

            return (
              <section key={section.id} className="tmCard">
                <button
                  type="button"
                  className="tmCard__header"
                  onClick={() => toggleSection(section.id)}
                  aria-expanded={isOpen}
                  aria-controls={`tm-content-${section.id}`}
                >
                  <span className="tmCard__title">{section.heading}</span>
                  <span className={`tmCard__chevron ${isOpen ? 'is-open' : ''}`}>
                    <FiChevronDown />
                  </span>
                </button>

                {isOpen ? (
                  <div id={`tm-content-${section.id}`} className="tmCard__content">
                    {section.documents.map((document) => {
                      const viewActionKey = `view-${document.id}`;
                      const downloadActionKey = `download-${document.id}`;

                      return (
                        <div key={document.id} className="tmRow">
                          <button
                            type="button"
                            className="tmRow__main"
                            onClick={() => void handleDocumentAction('view', document)}
                            disabled={activeActionKey !== null}
                          >
                            <FiFileText className="tmRow__icon" />
                            <span className="tmRow__label">
                              {activeActionKey === viewActionKey
                                ? 'Opening document...'
                                : document.title}
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
                    })}
                  </div>
                ) : null}
              </section>
            );
          })
        ) : (
          <section className="tmCard">
            <div className="tmCard__header">
              <span className="tmCard__title">No training materials yet.</span>
            </div>
            <div className="tmCard__content">
              <div className="tmRow tmRow--empty">
                <FiFileText className="tmRow__icon" />
                <span className="tmRow__label">Waiting for backend data.</span>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
