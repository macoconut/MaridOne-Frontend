import type { ReactNode } from 'react';
import type { BackendTestAction } from '@/layouts/shared/useBackendTestRunner';

type BackendTestPanelProps = {
  actions: BackendTestAction[];
  ariaLabel: string;
  isLoading: boolean;
  lastAction: string;
  onRun: (action: BackendTestAction) => void;
  result: string;
  title: string;
  variant?: 'section' | 'details';
  summaryLabel?: string;
  children?: ReactNode;
};

function BackendTestPanelContent({
  actions,
  children,
  isLoading,
  lastAction,
  onRun,
  result,
  title,
}: Omit<BackendTestPanelProps, 'ariaLabel' | 'summaryLabel' | 'variant'>) {
  return (
    <>
      <div className="backendTest__head">
        <h2>{title}</h2>
        <span>Last action: {lastAction}</span>
      </div>

      <div className="backendTest__actions">
        {actions.map((action) => (
          <article key={`${action.method}-${action.path}`} className="backendTest__card">
            <button type="button" onClick={() => onRun(action)} disabled={isLoading}>
              {action.label}
            </button>
            {action.description ? <p>{action.description}</p> : null}
            <code>{action.method} {action.path}</code>
          </article>
        ))}
      </div>

      {children}
      {result ? <pre className="backendTest__result">{result}</pre> : null}
    </>
  );
}

export default function BackendTestPanel({
  actions,
  ariaLabel,
  children,
  isLoading,
  lastAction,
  onRun,
  result,
  summaryLabel,
  title,
  variant = 'section',
}: BackendTestPanelProps) {
  if (variant === 'details') {
    return (
      <details className="backendTest backendTest--collapsible" aria-label={ariaLabel}>
        <summary className="backendTest__summary">{summaryLabel ?? title}</summary>
        <div className="backendTest__body">
          <BackendTestPanelContent
            actions={actions}
            children={children}
            isLoading={isLoading}
            lastAction={lastAction}
            onRun={onRun}
            result={result}
            title={title}
          />
        </div>
      </details>
    );
  }

  return (
    <section className="backendTest" aria-label={ariaLabel}>
      <BackendTestPanelContent
        actions={actions}
        children={children}
        isLoading={isLoading}
        lastAction={lastAction}
        onRun={onRun}
        result={result}
        title={title}
      />
    </section>
  );
}
