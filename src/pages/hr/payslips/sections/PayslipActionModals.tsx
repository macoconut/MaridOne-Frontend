import type { RefObject } from 'react';
import { FiChevronDown, FiX } from 'react-icons/fi';
import LargePopup from '../../../../components/dialog/LargePopup';
import { formatDate, formatDateTime } from '../../../../lib/utils/formatters';
import type { EmployeeOption } from '../../../../lib/types/employee';
import { formatCurrency, formatRunType, getStandardPaymentDate } from '../payslipsShared';
import type {
  CorrectionIntent,
  CorrectionLine,
  CorrectionSourceItem,
  ManualLineFormState,
  RunFormState,
} from '../types';

type PayslipRunModalProps = {
  isRunPeriodEndInvalid: boolean;
  isRunPeriodStartInvalid: boolean;
  isSubmittingRun: boolean;
  onClose: () => void;
  onPaymentDateChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onPeriodStartChange: (value: string) => void;
  onRequestSubmit: () => void;
  onRunTypeChange: (value: RunFormState['runType']) => void;
  open: boolean;
  runForm: RunFormState;
  runModalTitle: string;
  runSubmitLabel: string;
  todayIsoDate: string;
};

export function PayslipRunModal({
  isRunPeriodEndInvalid,
  isRunPeriodStartInvalid,
  isSubmittingRun,
  onClose,
  onPaymentDateChange,
  onPeriodEndChange,
  onPeriodStartChange,
  onRequestSubmit,
  onRunTypeChange,
  open,
  runForm,
  runModalTitle,
  runSubmitLabel,
  todayIsoDate,
}: PayslipRunModalProps) {
  if (!open) return null;

  return (
    <LargePopup
      open
      ariaLabel={runModalTitle}
      title={runModalTitle}
      subtitle="Set the payroll coverage window and run type before starting this payroll process."
      size="lg"
      className="hrPayPopup hrPayPopup--runSetup"
      onClose={onClose}
      closeDisabled={isSubmittingRun}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmittingRun}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onRequestSubmit} disabled={isSubmittingRun}>
            {isSubmittingRun ? 'Submitting...' : runSubmitLabel}
          </button>
        </>
      )}
    >
      <div className="hrPayModal hrPayModal--run">
        <div className="hrPayModal__grid hrPayModal__grid--compact">
          <label>
            <span>Period Start:</span>
            <input
              type="date"
              value={runForm.periodStart}
              aria-invalid={isRunPeriodStartInvalid ? 'true' : undefined}
              onChange={(event) => onPeriodStartChange(event.target.value)}
              max={runForm.periodEnd || todayIsoDate}
            />
          </label>
          <label>
            <span>Period End:</span>
            <input
              type="date"
              value={runForm.periodEnd}
              aria-invalid={isRunPeriodEndInvalid ? 'true' : undefined}
              onChange={(event) => onPeriodEndChange(event.target.value)}
              min={runForm.periodStart || undefined}
              max={todayIsoDate}
            />
          </label>
          <label>
            <span>
              Payment Date:
              {getStandardPaymentDate(runForm.periodStart, runForm.periodEnd) === runForm.paymentDate && (
                <small style={{ color: 'var(--hr-primary)', marginLeft: '6px', fontWeight: 'bold' }}>(Standard)</small>
              )}
            </span>
            <input
              type="date"
              value={runForm.paymentDate}
              onChange={(event) => onPaymentDateChange(event.target.value)}
              min={runForm.periodEnd || undefined}
            />
          </label>
          <label>
            <span>Run Type:</span>
            <select value={runForm.runType} onChange={(event) => onRunTypeChange(event.target.value as RunFormState['runType'])}>
              <option value="REGULAR">Regular Payroll</option>
              <option value="ADJUSTMENT">Adjustment Payroll</option>
            </select>
          </label>
        </div>
      </div>
    </LargePopup>
  );
}

type PayslipManualLineModalProps = {
  canClearManualEmployeePicker: boolean;
  filteredEmployeeOptions: EmployeeOption[];
  isLoadingEmployeeOptions: boolean;
  isManualAmountInvalid: boolean;
  isManualEmployeeInvalid: boolean;
  isSubmittingManualLine: boolean;
  manualEmployeePickerOpen: boolean;
  manualEmployeePickerRef: RefObject<HTMLDivElement | null>;
  manualEmployeeSearch: string;
  manualLineError: string;
  manualLineForm: ManualLineFormState;
  onAmountChange: (value: string) => void;
  onClearManualEmployeeSelection: () => void;
  onClose: () => void;
  onLineTypeChange: (value: ManualLineFormState['lineType']) => void;
  onManualEmployeeSearchChange: (value: string) => void;
  onOpenManualEmployeePicker: () => void;
  onSelectManualEmployee: (option: EmployeeOption) => void;
  onSubmit: () => void;
  onToggleManualEmployeePicker: () => void;
  open: boolean;
  selectedEmployeeId: string;
};

export function PayslipManualLineModal({
  canClearManualEmployeePicker,
  filteredEmployeeOptions,
  isLoadingEmployeeOptions,
  isManualAmountInvalid,
  isManualEmployeeInvalid,
  isSubmittingManualLine,
  manualEmployeePickerOpen,
  manualEmployeePickerRef,
  manualEmployeeSearch,
  manualLineError,
  manualLineForm,
  onAmountChange,
  onClearManualEmployeeSelection,
  onClose,
  onLineTypeChange,
  onManualEmployeeSearchChange,
  onOpenManualEmployeePicker,
  onSelectManualEmployee,
  onSubmit,
  onToggleManualEmployeePicker,
  open,
  selectedEmployeeId,
}: PayslipManualLineModalProps) {
  if (!open) return null;

  return (
    <LargePopup
      open
      ariaLabel="Add manual adjustment line"
      title="Add Manual Adjustment Line"
      subtitle="Choose an employee, select whether this is an earning or deduction, and enter the amount to add it to the active adjustment run."
      size="xl"
      className="hrPayPopup hrPayPopup--manualLine"
      onClose={onClose}
      closeDisabled={isSubmittingManualLine}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmittingManualLine}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void onSubmit()}
            disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
          >
            {isSubmittingManualLine ? 'Adding...' : 'Add Line'}
          </button>
        </>
      )}
    >
      <div className="hrPayModal hrPayModal--run">
        <div className="hrPayModal__grid hrPayModal__grid--compact hrPayModal__grid--manualLine">
          <label className="hrPayModal__gridItem--full">
            <span>Employee:</span>
            <div className={`hrPayPicker ${manualEmployeePickerOpen ? 'is-open' : ''}`} ref={manualEmployeePickerRef}>
              <div className="hrPayPicker__control" aria-invalid={isManualEmployeeInvalid ? 'true' : undefined}>
                <input
                  type="text"
                  className="hrPayPicker__input"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="manual-employee-options"
                  aria-expanded={manualEmployeePickerOpen}
                  aria-haspopup="listbox"
                  aria-invalid={isManualEmployeeInvalid ? 'true' : undefined}
                  value={manualEmployeeSearch}
                  onFocus={onOpenManualEmployeePicker}
                  onChange={(event) => onManualEmployeeSearchChange(event.target.value)}
                  placeholder={isLoadingEmployeeOptions ? 'Loading employees...' : 'Search or choose an employee'}
                  disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                />
                {canClearManualEmployeePicker ? (
                  <button
                    type="button"
                    className="hrPayPicker__clear"
                    onClick={onClearManualEmployeeSelection}
                    disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                    aria-label="Clear employee selection"
                  >
                    <FiX />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="hrPayPicker__toggle"
                  onClick={onToggleManualEmployeePicker}
                  disabled={isLoadingEmployeeOptions || isSubmittingManualLine}
                  aria-label={manualEmployeePickerOpen ? 'Close employee list' : 'Open employee list'}
                >
                  <FiChevronDown />
                </button>
              </div>
              {manualEmployeePickerOpen && (
                <div className="hrPayPicker__menu" id="manual-employee-options" role="listbox">
                  {isLoadingEmployeeOptions ? (
                    <div className="hrPayPicker__empty">Loading employees...</div>
                  ) : filteredEmployeeOptions.length > 0 ? (
                    filteredEmployeeOptions.map((option) => {
                      const isSelected = option.id === Number(selectedEmployeeId);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`hrPayPicker__option ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => onSelectManualEmployee(option)}
                        >
                          {option.name}
                        </button>
                      );
                    })
                  ) : (
                    <div className="hrPayPicker__empty">No employees match that search.</div>
                  )}
                </div>
              )}
            </div>
          </label>
          <label>
            <span>Line Type:</span>
            <select
              value={manualLineForm.lineType}
              onChange={(event) => onLineTypeChange(event.target.value as ManualLineFormState['lineType'])}
              disabled={isSubmittingManualLine}
            >
              <option value="EARNING">Manual Earning</option>
              <option value="BONUS">Bonus</option>
              <option value="DEDUCTION">Manual Deduction</option>
            </select>
          </label>
          <label>
            <span>Amount:</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={manualLineForm.amount}
              aria-invalid={isManualAmountInvalid ? 'true' : undefined}
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="0.00"
              disabled={isSubmittingManualLine}
            />
          </label>
        </div>
        {manualLineError && <p className="hrPay__message">{manualLineError}</p>}
      </div>
    </LargePopup>
  );
}

type PayslipPostRunModalProps = {
  currentRunPeriodEnd?: string;
  currentRunPeriodStart?: string;
  currentRunType?: string;
  currentRunId?: number;
  isPostingRun: boolean;
  onClose: () => void;
  onSubmit: () => void;
  open: boolean;
};

export function PayslipPostRunModal({
  currentRunId,
  currentRunPeriodEnd,
  currentRunPeriodStart,
  currentRunType,
  isPostingRun,
  onClose,
  onSubmit,
  open,
}: PayslipPostRunModalProps) {
  if (!open) return null;

  return (
    <LargePopup
      open
      ariaLabel="Post payroll run"
      title="Post Payroll Run"
      subtitle="Review the payroll run summary carefully before confirming the final posting step."
      size="lg"
      className="hrPayPopup hrPayPopup--postRun"
      onClose={onClose}
      closeDisabled={isPostingRun}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isPostingRun}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={() => void onSubmit()} disabled={isPostingRun}>
            {isPostingRun ? 'Posting...' : 'Confirm Post'}
          </button>
        </>
      )}
    >
      <div className="hrPayModal hrPayModal--run">
        <div className="hrPayModal__summary">
          <div className="hrPayModal__summaryRow">
            <span>Run ID</span>
            <strong>#{currentRunId ?? '-'}</strong>
          </div>
          <div className="hrPayModal__summaryRow">
            <span>Type</span>
            <strong>{formatRunType(currentRunType)}</strong>
          </div>
          <div className="hrPayModal__summaryRow">
            <span>Period</span>
            <strong>{formatDate(currentRunPeriodStart)} - {formatDate(currentRunPeriodEnd)}</strong>
          </div>
        </div>
      </div>
    </LargePopup>
  );
}

type PayslipCorrectionModalProps = {
  adjustmentRunId: number | null;
  correctedAmount: string;
  correctionIntent: CorrectionIntent | null;
  correctionLines: CorrectionLine[];
  correctionSource: CorrectionSourceItem | null;
  isCorrectionAmountInvalid: boolean;
  isLoadingCorrection: boolean;
  isSubmittingCorrection: boolean;
  onClose: () => void;
  onCorrectedAmountChange: (value: string) => void;
  onSelectCorrectionKey: (key: string) => void;
  onSubmit: () => void;
  open: boolean;
  selectedCorrectionKey: string;
  selectedCorrectionLine: CorrectionLine | null;
};

export function PayslipCorrectionModal({
  adjustmentRunId,
  correctedAmount,
  correctionIntent,
  correctionLines,
  correctionSource,
  isCorrectionAmountInvalid,
  isLoadingCorrection,
  isSubmittingCorrection,
  onClose,
  onCorrectedAmountChange,
  onSelectCorrectionKey,
  onSubmit,
  open,
  selectedCorrectionKey,
  selectedCorrectionLine,
}: PayslipCorrectionModalProps) {
  if (!open) return null;

  return (
    <LargePopup
      open
      ariaLabel="Stage payroll correction"
      title="Stage Approved Dispute Correction"
      subtitle="Review the approved dispute, choose the matching payroll line, and stage the corrected amount into the active adjustment run."
      size="xl"
      className="hrPayPopup hrPayPopup--correction"
      onClose={onClose}
      closeDisabled={isSubmittingCorrection}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSubmittingCorrection}>
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void onSubmit()}
            disabled={isLoadingCorrection || isSubmittingCorrection || !selectedCorrectionLine}
          >
            {isSubmittingCorrection ? 'Staging...' : 'Stage Correction'}
          </button>
        </>
      )}
    >
      <div className="hrPayModal">
        {isLoadingCorrection ? (
          <p className="hrPayModal__intro">
            Loading the disputed payslip item, its earnings and deductions, and the adjustment run to use for this
            correction.
          </p>
        ) : (
          <>
            <div className="hrPayCorrectionSummary">
              <div className="hrPayCorrectionSummary__row">
                <span className="hrPayCorrectionSummary__label">Employee</span>
                <div className="hrPayCorrectionSummary__value">{correctionIntent?.employee ?? '-'}</div>
              </div>
              <div className="hrPayCorrectionSummary__row">
                <span className="hrPayCorrectionSummary__label">Source Item</span>
                <div className="hrPayCorrectionSummary__value">#{correctionSource?.itemId ?? correctionIntent?.itemId ?? '-'}</div>
              </div>
              <div className="hrPayCorrectionSummary__row">
                <span className="hrPayCorrectionSummary__label">Source Period</span>
                <div className="hrPayCorrectionSummary__value">
                  {formatDate(correctionSource?.runDetails?.periodStart)} - {formatDate(correctionSource?.runDetails?.periodEnd)}
                </div>
              </div>
              <div className="hrPayCorrectionSummary__row">
                <span className="hrPayCorrectionSummary__label">Adjustment Run</span>
                <div className="hrPayCorrectionSummary__value">#{adjustmentRunId ?? '-'}</div>
              </div>
            </div>

            <label className="hrPayModal__area">
              <span>Dispute Message:</span>
              <textarea value={correctionIntent?.message ?? 'No dispute message provided.'} readOnly />
            </label>

            <label className="hrPayModal__area">
              <span>Employee Reason:</span>
              <textarea value={correctionIntent?.disputeReason ?? 'No employee reason provided.'} readOnly />
            </label>

            <label className="hrPayModal__area">
              <span>HR Decision Note:</span>
              <textarea value={correctionIntent?.decisionReason ?? '-'} readOnly />
            </label>

            <div className="hrPayCorrectionPicker">
              <div className="hrPayCorrectionPicker__head">
                <div className="hrPayCorrectionPicker__heading">
                  <span className="hrPayCorrectionPicker__stepText">Step 1</span>
                  <strong>Select the exact line to correct</strong>
                  <p>
                    Click the matching payroll line below to select it. The line name is filled in automatically, so
                    you only need to type the corrected amount afterward.
                  </p>
                </div>
              </div>
              <div className="hrPayCorrectionPicker__list">
                {correctionLines.map((line) => (
                  <button
                    key={line.key}
                    type="button"
                    className={`hrPayCorrectionLine${line.key === selectedCorrectionKey ? ' is-selected' : ''}`}
                    onClick={() => onSelectCorrectionKey(line.key)}
                    aria-pressed={line.key === selectedCorrectionKey}
                  >
                    <div className="hrPayCorrectionLine__main">
                      <div className="hrPayCorrectionLine__identity">
                        <span className="hrPayCorrectionLine__type">
                          {line.lineType === 'EARNING' ? 'Earning' : 'Deduction'}
                        </span>
                        <strong>{line.label}</strong>
                      </div>
                      <span className="hrPayCorrectionLine__amount">{formatCurrency(line.amount)}</span>
                    </div>
                    <div className="hrPayCorrectionLine__meta">
                      {line.originalAmount && <span>Original posted amount: {formatCurrency(line.originalAmount)}</span>}
                      {line.adjustedBy && <span>Last adjusted by {line.adjustedBy}</span>}
                      {line.adjustedAt && <span>{formatDateTime(line.adjustedAt)}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="hrPayCorrectionAction">
              <div className="hrPayCorrectionAction__card">
                <span>Step 2</span>
                <strong>
                  {selectedCorrectionLine
                    ? `${selectedCorrectionLine.lineType === 'EARNING' ? 'Earning' : 'Deduction'} - ${selectedCorrectionLine.label}`
                    : 'No payroll line selected yet'}
                </strong>
                <p>
                  {selectedCorrectionLine
                    ? 'Enter the corrected amount for the selected payroll line.'
                    : 'Click one payroll line above to lock in the exact line before the corrected amount field becomes available.'}
                </p>
              </div>
              <label className="hrPayCorrectionAction__card hrPayCorrectionAction__card--form">
                <span>Corrected Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={correctedAmount}
                  aria-invalid={isCorrectionAmountInvalid ? 'true' : undefined}
                  onChange={(event) => onCorrectedAmountChange(event.target.value)}
                  placeholder={selectedCorrectionLine ? `Current amount: ${selectedCorrectionLine.amount}` : 'Choose a line first'}
                  disabled={!selectedCorrectionLine || isSubmittingCorrection}
                />
                {!selectedCorrectionLine && <small>Pick the exact payroll line above to enable amount entry.</small>}
              </label>
            </div>
          </>
        )}
      </div>
    </LargePopup>
  );
}
