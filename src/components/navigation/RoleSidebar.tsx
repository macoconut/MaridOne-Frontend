import { FiLogOut, FiMenu, FiSettings } from 'react-icons/fi';
import SidebarBrand from './SidebarBrand';
import SidebarFooterAction from './SidebarFooterAction';
import SidebarNavSection, { type NavSection } from './SidebarNavSection';

type RoleSidebarProps = {
  brandLabel: string;
  collapsed?: boolean;
  drawerOpen?: boolean;
  isMobileLayout?: boolean;
  navSections: NavSection[];
  onBrandClick: () => void;
  onLogout: () => void | Promise<void>;
  onOpenSettings: () => void;
  onToggleSection?: (sectionId: string) => void;
  onToggleSidebar: () => void;
  openSections?: Record<string, boolean>;
};

export default function RoleSidebar({
  brandLabel,
  collapsed = false,
  drawerOpen = false,
  isMobileLayout = false,
  navSections,
  onBrandClick,
  onLogout,
  onOpenSettings,
  onToggleSection,
  onToggleSidebar,
  openSections,
}: RoleSidebarProps) {
  const toggleLabel = isMobileLayout
    ? drawerOpen
      ? 'Close navigation menu'
      : 'Open navigation menu'
    : collapsed
      ? 'Expand sidebar'
      : 'Collapse sidebar';
  const showBrand = isMobileLayout || !collapsed;

  return (
    <aside className={`eSide${drawerOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
      <div className="eSide__top">
        {showBrand ? <SidebarBrand label={brandLabel} onClick={onBrandClick} collapsed={collapsed} /> : null}
        <button
          type="button"
          className="eSide__toggle"
          aria-label={toggleLabel}
          title={toggleLabel}
          onClick={onToggleSidebar}
        >
          <FiMenu />
        </button>
      </div>

      <div className="eSide__navWrap">
        {navSections.map((section) => (
          <SidebarNavSection
            key={section.id}
            section={section}
            collapsed={collapsed}
            isOpen={collapsed ? true : (openSections?.[section.id] ?? section.defaultOpen)}
            onToggle={onToggleSection ?? (() => undefined)}
          />
        ))}
      </div>

      <div className="eSide__footer">
        <div className="eSide__footerActions">
          <SidebarFooterAction collapsed={collapsed} icon={FiSettings} label="Settings" onClick={onOpenSettings} />
          <SidebarFooterAction collapsed={collapsed} icon={FiLogOut} label="Logout" onClick={onLogout} tone="danger" />
        </div>
      </div>
    </aside>
  );
}
