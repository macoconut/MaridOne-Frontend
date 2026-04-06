import type { ButtonHTMLAttributes } from 'react';
import { FiX } from 'react-icons/fi';

type ModalCloseButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>;

export default function ModalCloseButton({
  className,
  type = 'button',
  'aria-label': ariaLabel = 'Close',
  title,
  ...props
}: ModalCloseButtonProps) {
  const resolvedClassName = ['uiCloseButton', className].filter(Boolean).join(' ');

  return (
    <button type={type} className={resolvedClassName} aria-label={ariaLabel} title={title ?? ariaLabel} {...props}>
      <FiX aria-hidden="true" />
    </button>
  );
}
