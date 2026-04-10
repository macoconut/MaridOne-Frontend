import { useEffect } from 'react';
import ModalCloseButton from '../dialog/ModalCloseButton';
import useAnimatedPresence from '../../hooks/useAnimatedPresence';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';
import SettingsPanel from './SettingsPanel';

type SettingsModalProps = {
  onClose: () => void;
  open: boolean;
};

export default function SettingsModal({ onClose, open }: SettingsModalProps) {
  const modalPresence = useAnimatedPresence(open, 220);

  useEscapeDismiss(modalPresence.isMounted, onClose, 30);

  useEffect(() => {
    if (!modalPresence.isMounted) return;

    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [modalPresence.isMounted]);

  if (!modalPresence.isMounted) {
    return null;
  }

  return (
    <div
      className={`settingsModalBackdrop${modalPresence.isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onClose}
    >
      <div
        className={`settingsModal${modalPresence.isClosing ? ' is-closing' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="settingsModal__top">
          <div className="settingsModal__copy">
            <div className="settingsModal__eyebrow">Quick Settings</div>
            <div className="settingsModal__title">Adjust the workspace without leaving the page</div>
          </div>
          <ModalCloseButton className="settingsModal__close" onClick={onClose} />
        </div>

        <div className="settingsModal__rule" />

        <SettingsPanel />
      </div>
    </div>
  );
}
