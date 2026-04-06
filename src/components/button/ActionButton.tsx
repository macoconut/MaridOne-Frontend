import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './ActionButton.css';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  trailingIcon?: ReactNode;
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
};

export default function ActionButton({
  icon,
  trailingIcon,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
  children,
  ...buttonProps
}: ActionButtonProps) {
  const resolvedClassName = [
    'uiActionBtn',
    `uiActionBtn--${variant}`,
    `uiActionBtn--${size}`,
    fullWidth ? 'uiActionBtn--fullWidth' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={resolvedClassName} {...buttonProps}>
      {icon ? <span className="uiActionBtn__icon" aria-hidden="true">{icon}</span> : null}
      <span className="uiActionBtn__label">{children}</span>
      {trailingIcon ? <span className="uiActionBtn__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}
