import { useId } from 'react';
import { FiFileText, FiUpload, FiX } from 'react-icons/fi';
import './FileUploadField.css';
import type { ChangeEvent } from 'react';

type FileUploadFieldProps = {
  label: string;
  hint: string;
  files?: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  uploadLabel?: string;
  replaceLabel?: string;
  emptyLabel?: string;
  maxSizeLabel?: string;
  accept?: string;
};

export default function FileUploadField({
  label,
  hint,
  files = [],
  onChange,
  disabled = false,
  invalid = false,
  uploadLabel = 'Upload Files',
  replaceLabel = 'Add More Files',
  emptyLabel = 'No files selected',
  maxSizeLabel = '10 MB max',
  accept,
}: FileUploadFieldProps) {
  const inputId = useId();

  function removeFile(index: number) {
    onChange(files.filter((_, i) => i !== index));
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? []);
    // merge with existing, dedupe by name
    const merged = [...files, ...incoming].filter(
      (file, idx, all) => all.findIndex(f => f.name === file.name) === idx
    );
    onChange(merged);
    event.target.value = ''; // reset input so same file can be re-added
  }

  return (
    <div className="fileUploadField">
      <div className="fileUploadField__head">
        <span className="fileUploadField__label">{label}</span>
        <span className="fileUploadField__limit">{maxSizeLabel}</span>
      </div>
      <p className="fileUploadField__hint">{hint}</p>
      <div className="fileUploadField__panel" aria-invalid={invalid ? 'true' : undefined}>
        <div className="fileUploadField__actions">
          <label
            className={`fileUploadField__button${disabled ? ' is-disabled' : ''}`}
            htmlFor={disabled ? undefined : inputId}
            aria-disabled={disabled ? 'true' : undefined}
          >
            <FiUpload />
            <span>{files.length > 0 ? replaceLabel : uploadLabel}</span>
          </label>
        </div>

        {files.length === 0 && (
          <div className="fileUploadField__status">
            <FiFileText className="fileUploadField__statusIcon" />
            <span className="fileUploadField__statusText">{emptyLabel}</span>
          </div>
        )}

        {files.map((file, idx) => (
          <div key={`${file.name}-${idx}`} className="fileUploadField__status is-selected">
            <FiFileText className="fileUploadField__statusIcon" />
            <span className="fileUploadField__statusText">{file.name}</span>
            <button
              type="button"
              className="fileUploadField__clearMini"
              disabled={disabled}
              onClick={() => removeFile(idx)}
              title="Remove file"
            >
              <FiX />
            </button>
          </div>
        ))}
      </div>
      <input
        id={inputId}
        className="fileUploadField__input"
        type="file"
        accept={accept}
        multiple                          // ← allows multiple selection
        disabled={disabled}
        onChange={handleFileChange}
      />
    </div>
  );
}