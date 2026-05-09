import { FiDownload, FiFileText } from 'react-icons/fi';

import ActionButton from '@/components/button/ActionButton';
import MaterialArt from '@/components/document/MaterialArt';
import { canUseLibraryDocument, type DocumentLibraryItem } from '@/lib/document/documentLibrary';

type HandbookWidgetProps = {
  document: DocumentLibraryItem | null;
  loading: boolean;
  activeActionKey: string | null;
  onDownload: (document: DocumentLibraryItem) => void;
  onOpen: (document: DocumentLibraryItem) => void;
};

export default function HandbookWidget({
  document,
  loading,
  activeActionKey,
  onDownload,
  onOpen,
}: HandbookWidgetProps) {
  const hasActionableDocument = canUseLibraryDocument(document);
  const viewActionKey = document ? `view-${document.scope}-${document.pathId}` : '';
  const downloadActionKey = document ? `download-${document.scope}-${document.pathId}` : '';
  const title = document?.title ?? 'Employee Handbook';
  const description = document
    ? document.source === 'mock'
      ? 'Temporary placeholder until handbook is uploaded to cloud storage.'
      : document.description
    : 'Employee handbook does not exist in the document library.';
  const actionsDisabled = activeActionKey !== null || loading || !hasActionableDocument;

  return (
    <div className="cardX">
      <div className="cardX__title">Employee Handbook</div>

      <div className="handbookRow">
        <div className="handbookRow__main">
          <span className="handbookRow__artWrap" aria-hidden="true">
            <MaterialArt kind="public" className="handbookRow__art" />
          </span>
          <div className="handbookRow__text">
            <div className="handbookRow__name">
              {loading ? 'Checking handbook...' : title}
            </div>
            <p className="handbookRow__intro">{description}</p>
          </div>
        </div>

        <div className="handbookRow__actions">
          <ActionButton
            className="handbookBtn"
            size="sm"
            icon={<FiFileText />}
            type="button"
            onClick={() => {
              if (document) onOpen(document);
            }}
            disabled={actionsDisabled}
          >
            {activeActionKey === viewActionKey ? 'Opening...' : 'View'}
          </ActionButton>
          <ActionButton
            className="handbookBtn"
            size="sm"
            icon={<FiDownload />}
            type="button"
            onClick={() => {
              if (document) onDownload(document);
            }}
            disabled={actionsDisabled}
          >
            {activeActionKey === downloadActionKey ? 'Preparing...' : 'Download'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
