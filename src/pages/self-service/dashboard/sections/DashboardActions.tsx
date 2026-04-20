type DashboardAction = {
  label: string;
  path: string;
};

type DashboardActionsProps = {
  actions: DashboardAction[];
  onNavigate: (path: string) => void;
};

export default function DashboardActions({ actions, onNavigate }: DashboardActionsProps) {
  return (
    <section className="actionRowX">
      {actions.map((action) => (
        <button
          key={action.label}
          className="actionBtnX"
          type="button"
          onClick={() => onNavigate(action.path)}
        >
          <span>{action.label}</span>
          <span className="actionBtnX__arrow">→</span>
        </button>
      ))}
    </section>
  );
}
