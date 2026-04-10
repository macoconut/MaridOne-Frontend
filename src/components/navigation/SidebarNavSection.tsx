import { NavLink } from 'react-router-dom';
import type { IconType } from 'react-icons';
import { FiChevronDown } from 'react-icons/fi';

export type NavSection = {
  id: string;
  label: string;
  defaultOpen: boolean;
  items: Array<{
    to: string;
    label: string;
    icon: IconType;
  }>;
};

type SidebarNavSectionProps = {
  collapsed?: boolean;
  section: NavSection;
  isOpen: boolean;
  onToggle: (sectionId: string) => void;
};

export default function SidebarNavSection({
  collapsed = false,
  section,
  isOpen,
  onToggle,
}: SidebarNavSectionProps) {
  const sectionIsOpen = collapsed || isOpen;

  return (
    <div className={`eSide__navSection ${sectionIsOpen ? 'is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      {!collapsed && (
        <button
          type="button"
          className="eSide__sectionToggle"
          onClick={() => onToggle(section.id)}
          aria-expanded={sectionIsOpen}
        >
          <span className="eSide__navLabel">{section.label}</span>
          <FiChevronDown className="eSide__sectionChevron" />
        </button>
      )}

      {sectionIsOpen && (
        <nav className="eSide__nav eSide__navPanel" aria-label={`${section.label} navigation`}>
          {section.items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
              >
                <span className="eSide__iconWrap" aria-hidden="true">
                  <Icon className="eSide__icon" />
                </span>
                <span className="eSide__itemLabel">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
