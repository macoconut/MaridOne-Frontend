import { useId, useState } from 'react';
import { FiHelpCircle, FiX } from 'react-icons/fi';
import './WorkflowHelpButton.css';

type WorkflowHelpButtonProps = {
  title: string;
  items: string[];
  ariaLabel?: string;
};

export default function WorkflowHelpButton({
  title,
  items,
  ariaLabel = 'Show workflow help',
}: WorkflowHelpButtonProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="workflowHelp">
      <button
        type="button"
        className="workflowHelp__trigger"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        title={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <FiHelpCircle aria-hidden="true" />
      </button>

      {open ? (
        <div id={panelId} className="workflowHelp__panel" role="dialog" aria-label={title}>
          <div className="workflowHelp__header">
            <strong>{title}</strong>
            <button type="button" aria-label="Close workflow help" onClick={() => setOpen(false)}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          <ul>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
