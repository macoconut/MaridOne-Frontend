import { NavLink } from 'react-router-dom';
import type { IconType } from 'react-icons';

type SidebarFooterActionProps = {
  collapsed?: boolean;
  icon: IconType;
  label: string;
  onClick?: () => void;
  to?: string;
  tone?: 'default' | 'danger';
};

export default function SidebarFooterAction({
  collapsed = false,
  icon: Icon,
  label,
  onClick,
  to,
  tone = 'default',
}: SidebarFooterActionProps) {
  const className = `eSide__footerAction${collapsed ? ' is-collapsed' : ''}${tone === 'danger' ? ' eSide__footerAction--danger' : ''}`;
  const content = (
    <>
      <span className="eSide__iconWrap" aria-hidden="true">
        <Icon className="eSide__icon" />
      </span>
      <span className="eSide__actionLabel">{label}</span>
    </>
  );

  if (to) {
    return (
      <NavLink
        end
        to={to}
        title={collapsed ? label : undefined}
        className={({ isActive }) => `${className}${isActive ? ' is-active' : ''}`}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} title={collapsed ? label : undefined}>
      {content}
    </button>
  );
}
