type SidebarBrandProps = {
  label: string;
  onClick: () => void;
};

export default function SidebarBrand({ label, onClick }: SidebarBrandProps) {
  return (
    <button
      type="button"
      className="eSide__brand eSide__brand--link"
      onClick={onClick}
      aria-label={label}
    >
      <div className="eSide__logo" aria-hidden="true" />
      <div className="eSide__name">MaridOne</div>
    </button>
  );
}
