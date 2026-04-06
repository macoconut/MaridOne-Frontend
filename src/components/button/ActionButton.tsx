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
  title,
  ...buttonProps
}: ActionButtonProps) {
  const resolvedTitle =
    title ??
    (typeof children === 'string' || typeof children === 'number'
      ? String(children)
      : undefined);

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
    <button className={resolvedClassName} title={resolvedTitle} {...buttonProps}>
      {icon ? <span className="uiActionBtn__icon" aria-hidden="true">{icon}</span> : null}
      <span className="uiActionBtn__label">{children}</span>
      {trailingIcon ? <span className="uiActionBtn__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
}
