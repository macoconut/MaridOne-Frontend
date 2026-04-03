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
  section: NavSection;
  isOpen: boolean;
  onToggle: (sectionId: string) => void;
};

export default function SidebarNavSection({
  section,
  isOpen,
  onToggle,
}: SidebarNavSectionProps) {
  return (
    <div className={`eSide__navSection ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="eSide__sectionToggle"
        onClick={() => onToggle(section.id)}
        aria-expanded={isOpen}
      >
        <span className="eSide__navLabel">{section.label}</span>
        <FiChevronDown className="eSide__sectionChevron" />
      </button>

      {isOpen && (
        <nav className="eSide__nav eSide__navPanel" aria-label={`${section.label} navigation`}>
          {section.items.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `eSide__item ${isActive ? 'is-active' : ''}`}
              >
                <Icon className="eSide__icon" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
