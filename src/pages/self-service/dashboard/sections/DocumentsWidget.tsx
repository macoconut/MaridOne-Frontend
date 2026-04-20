import { FiDownload, FiFileText } from 'react-icons/fi';

import ActionButton from '../../../../components/button/ActionButton';
import MaterialArt from '../../../../components/document/MaterialArt';
import { handbookLibraryCard } from '../../../../lib/materialLibrary';

type DocumentsWidgetProps = {
  onDownload: () => void;
  onOpen: () => void;
};

export default function DocumentsWidget({ onDownload, onOpen }: DocumentsWidgetProps) {
  return (
    <div className="cardX">
      <div className="cardX__title">Company Handbook</div>

      <div className="handbookRow">
        <div className="handbookRow__main">
          <div className="handbookRow__artWrap" aria-hidden="true">
            <MaterialArt kind={handbookLibraryCard.artKind} className="handbookRow__art" />
          </div>
          <div className="handbookRow__text">
            <div className="handbookRow__name">{handbookLibraryCard.heading}</div>
            <p className="handbookRow__intro u-line-clamp-2">{handbookLibraryCard.introduction}</p>
          </div>
        </div>
        <div className="handbookRow__actions">
          <ActionButton className="handbookBtn" size="sm" icon={<FiFileText />} type="button" onClick={onOpen}>
            {handbookLibraryCard.viewLabel}
          </ActionButton>
          <ActionButton className="handbookBtn" size="sm" icon={<FiDownload />} type="button" onClick={onDownload}>
            {handbookLibraryCard.downloadLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
