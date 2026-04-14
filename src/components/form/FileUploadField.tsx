import { useId } from 'react';
import { FiFileText, FiUpload, FiX } from 'react-icons/fi';
import './FileUploadField.css';

type FileUploadFieldProps = {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
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
  file,
  onChange,
  invalid = false,
  uploadLabel = 'Upload File',
  replaceLabel = 'Replace File',
  emptyLabel = 'No file selected',
  maxSizeLabel = '10 MB max',
  accept,
}: FileUploadFieldProps) {
  const inputId = useId();

  return (
    <div className="fileUploadField">
      <div className="fileUploadField__head">
        <span className="fileUploadField__label">{label}</span>
        <span className="fileUploadField__limit">{maxSizeLabel}</span>
      </div>

      <p className="fileUploadField__hint">{hint}</p>

      <div className="fileUploadField__panel" aria-invalid={invalid ? 'true' : undefined}>
        <div className="fileUploadField__actions">
          <label className="fileUploadField__button" htmlFor={inputId}>
            <FiUpload />
            <span>{file ? replaceLabel : uploadLabel}</span>
          </label>
        </div>

        <div className={`fileUploadField__status${file ? ' is-selected' : ''}`}>
          <FiFileText className="fileUploadField__statusIcon" />
          <span className="fileUploadField__statusText">{file ? file.name : emptyLabel}</span>
          {file && (
            <button
              type="button"
              className="fileUploadField__clearMini"
              onClick={() => onChange(null)}
              title="Remove file"
            >
              <FiX />
            </button>
          )}
        </div>
      </div>

      <input
        id={inputId}
        className="fileUploadField__input"
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </div>
  );
}
