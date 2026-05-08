import { FiDownload, FiFileText } from 'react-icons/fi';

import ActionButton from '@/components/button/ActionButton';
import MaterialArt from '@/components/document/MaterialArt';
import type { DocumentLibraryItem } from '@/lib/document/documentLibrary';

type DocumentsWidgetProps = {
  documents: DocumentLibraryItem[];
  loading: boolean;
  activeActionKey: string | null;
  onDownload: (document: DocumentLibraryItem) => void;
  onOpen: (document: DocumentLibraryItem) => void;
  onViewAll: () => void;
};

export default function DocumentsWidget({
  documents,
  loading,
  activeActionKey,
  onDownload,
  onOpen,
  onViewAll,
}: DocumentsWidgetProps) {
  return (
    <div className="cardX documentsWidget">
      <div className="cardX__titleBar">
        <div className="cardX__title">Documents</div>
        <button type="button" className="cardX__manageBtn" onClick={onViewAll}>
          View all
        </button>
      </div>

      <div className="documentsWidget__list">
        {documents.length > 0 ? (
          documents.map((document) => {
            const viewActionKey = `view-${document.scope}-${document.pathId}`;
            const downloadActionKey = `download-${document.scope}-${document.pathId}`;

            return (
              <div key={`${document.scope}-${document.pathId}`} className="documentsWidget__row">
                <button
                  type="button"
                  className="documentsWidget__main"
                  onClick={() => onOpen(document)}
                  disabled={activeActionKey !== null}
                >
                  <span className="documentsWidget__artWrap" aria-hidden="true">
                    <MaterialArt kind={document.scope} className="documentsWidget__art" />
                  </span>
                  <span className="documentsWidget__text">
                    <span className="documentsWidget__name">
                      {activeActionKey === viewActionKey ? 'Opening document...' : document.title}
                    </span>
                    <span className="documentsWidget__intro u-line-clamp-2">
                      {document.category} - {document.description}
                    </span>
                  </span>
                </button>
                <div className="documentsWidget__actions">
                  <ActionButton
                    className="documentsWidget__btn"
                    size="sm"
                    icon={<FiFileText />}
                    type="button"
                    onClick={() => onOpen(document)}
                    disabled={activeActionKey !== null}
                  >
                    {activeActionKey === viewActionKey ? 'Opening...' : 'View'}
                  </ActionButton>
                  <ActionButton
                    className="documentsWidget__btn"
                    size="sm"
                    icon={<FiDownload />}
                    type="button"
                    onClick={() => onDownload(document)}
                    disabled={activeActionKey !== null}
                  >
                    {activeActionKey === downloadActionKey ? 'Preparing...' : 'Download'}
                  </ActionButton>
                </div>
              </div>
            );
          })
        ) : (
          <div className="documentsWidget__empty">
            {loading ? 'Loading recent documents...' : 'No documents available yet.'}
          </div>
        )}
      </div>
    </div>
  );
}
