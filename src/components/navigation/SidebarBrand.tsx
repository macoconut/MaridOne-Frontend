type SidebarBrandProps = {
  collapsed?: boolean;
  label: string;
  onClick: () => void;
};

export default function SidebarBrand({ collapsed = false, label, onClick }: SidebarBrandProps) {
  return (
    <button
      type="button"
      className={`eSide__brand eSide__brand--link${collapsed ? ' is-collapsed' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <div className="eSide__logo" aria-hidden="true" />
      <div className="eSide__name">MaridOne</div>
    </button>
  );
}
