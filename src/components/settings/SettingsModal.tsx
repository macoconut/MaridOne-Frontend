import { useEffect } from 'react';
import LargePopup from '../dialog/LargePopup';
import SettingsPanel from './SettingsPanel';

type SettingsModalProps = {
  onClose: () => void;
  open: boolean;
};

export default function SettingsModal({ onClose, open }: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;

    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  return (
    <LargePopup
      open={open}
      ariaLabel="Settings"
      title="Settings"
      subtitle="Adjust the workspace without leaving the page."
      size="xl"
      onClose={onClose}
      dismissOnBackdrop
    >
      <SettingsPanel />
    </LargePopup>
  );
}
