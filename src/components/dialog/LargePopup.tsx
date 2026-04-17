import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import ModalCloseButton from './ModalCloseButton';
import useAnimatedPresence from '../../hooks/useAnimatedPresence';
import { useEscapeDismiss } from '../../hooks/useEscapeDismiss';

type LargePopupProps = {
  open: boolean;
  ariaLabel: string;
  title: string;
  subtitle?: string;
  size: 'md' | 'lg' | 'xl';
  onClose: () => void;
  closeDisabled?: boolean;
  dismissOnBackdrop?: boolean;
  children: ReactNode;
  footer?: ReactNode;
};

export default function LargePopup({
  open,
  ariaLabel,
  title,
  subtitle,
  size,
  onClose,
  closeDisabled = false,
  dismissOnBackdrop = false,
  children,
  footer,
}: LargePopupProps) {
  const popupPresence = useAnimatedPresence(open, 220);
  const canDismiss = popupPresence.isMounted && !closeDisabled;

  useEscapeDismiss(canDismiss, onClose, 40);

  if (!popupPresence.isMounted) {
    return null;
  }

  function handleBackdropClick() {
    if (!dismissOnBackdrop || closeDisabled) return;
    onClose();
  }

  return createPortal(
    <div
      className={`largePopupBackdrop${popupPresence.isClosing ? ' is-closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={handleBackdropClick}
    >
      <section
        className={`largePopup largePopup--${size}${popupPresence.isClosing ? ' is-closing' : ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="largePopup__top">
          <div className="largePopup__copy">
            {title ? <h2 className="largePopup__title">{title}</h2> : null}
            {subtitle ? <p className="largePopup__subtitle">{subtitle}</p> : null}
          </div>
          <ModalCloseButton
            className="largePopup__close"
            onClick={onClose}
            disabled={closeDisabled}
          />
        </div>

        <div className="largePopup__rule" />

        <div className="largePopup__body">{children}</div>

        {footer ? <div className="largePopup__footer">{footer}</div> : null}
      </section>
    </div>,
    document.body
  );
}
