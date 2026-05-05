import { FiEdit2 } from 'react-icons/fi';
import LargePopup from '../../../../components/dialog/LargePopup';
import { formatDate, formatDateTime } from '../../../../lib/utils/formatters';
import {
  formatPayrollRunTypeLabel,
  formatPayrollStatusLabel,
} from '../../../../lib/payrollRunLabels';
import type { PayrollRunRow as PayrollRunDto } from '../../../../lib/types/payroll';
import { formatCurrency } from '../payslipsShared';
import type { CorrectionLine, DisputeRow, PayrollItemSummaryRow } from '../types';

type PayslipBreakdownModalProps = {
  canEditSelectedPayrollItem: boolean;
  currentRun: PayrollRunDto | null;
  editingPayrollLineKey: string;
  isLoadingPayrollItem: boolean;
  isSavingPayrollLine: boolean;
  onCancelPayrollLineEdit: () => void;
  onClose: () => void;
  onPayrollLineDraftAmountChange: (value: string) => void;
  onSavePayrollLineAmount: (line: CorrectionLine) => void | Promise<void>;
  onStartPayrollLineEdit: (line: CorrectionLine) => void;
  open: boolean;
  payrollLineDraftAmount: string;
  selectedPayrollDeductions: number;
  selectedPayrollGross: number;
  selectedPayrollIsBonusPayout: boolean;
  selectedPayrollItem: PayrollItemSummaryRow | null;
  selectedPayrollItemDeductions: CorrectionLine[];
  selectedPayrollItemEarnings: CorrectionLine[];
  selectedPayrollNet: number;
};

function renderBreakdownSection({
  canEditSelectedPayrollItem,
  editingPayrollLineKey,
  isSavingPayrollLine,
  lines,
  onCancelPayrollLineEdit,
  onPayrollLineDraftAmountChange,
  onSavePayrollLineAmount,
  onStartPayrollLineEdit,
  payrollLineDraftAmount,
  title,
}: {
  canEditSelectedPayrollItem: boolean;
  editingPayrollLineKey: string;
  isSavingPayrollLine: boolean;
  lines: CorrectionLine[];
  onCancelPayrollLineEdit: () => void;
  onPayrollLineDraftAmountChange: (value: string) => void;
  onSavePayrollLineAmount: (line: CorrectionLine) => void | Promise<void>;
  onStartPayrollLineEdit: (line: CorrectionLine) => void;
  payrollLineDraftAmount: string;
  title: 'Earnings' | 'Deductions';
}) {
  const emptyMessage =
    title === 'Earnings'
      ? 'No earnings were returned for this payroll item.'
      : 'No deductions were returned for this payroll item.';

  return (
    <section className="hrPayBreakdown__section">
      <div className="hrPayBreakdown__head">
        <h4>{title}</h4>
        <span>{lines.length} line(s)</span>
      </div>
      <div className="hrPayBreakdown__list">
        {lines.length > 0 ? (
          lines.map((line) => (
            <div key={line.key} className="hrPayBreakdown__row">
              <div>
                <strong>{line.label}</strong>
                {(line.adjustedBy || line.adjustedAt) && (
                  <span>
                    {line.adjustedBy ? `Adjusted by ${line.adjustedBy}` : 'Adjusted'}{' '}
                    {line.adjustedAt ? `on ${formatDateTime(line.adjustedAt)}` : ''}
                  </span>
                )}
              </div>
              <div className="hrPayBreakdown__amounts">
                {line.originalAmount && <small>Original: {formatCurrency(line.originalAmount)}</small>}
                {editingPayrollLineKey === line.key ? (
                  <div className="hrPayBreakdown__editor">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={payrollLineDraftAmount}
                      onChange={(event) => onPayrollLineDraftAmountChange(event.target.value)}
                      aria-label={`Edit amount for ${line.label}`}
                    />
                    <div className="hrPayBreakdown__editorActions">
                      <button
                        type="button"
                        className="hrPayBreakdown__editorBtn is-muted"
                        onClick={onCancelPayrollLineEdit}
                        disabled={isSavingPayrollLine}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="hrPayBreakdown__editorBtn"
                        onClick={() => void onSavePayrollLineAmount(line)}
                        disabled={isSavingPayrollLine}
                      >
                        {isSavingPayrollLine ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="hrPayBreakdown__valueRow">
                    <strong>{formatCurrency(line.amount)}</strong>
                    {canEditSelectedPayrollItem && (
                      <button
                        type="button"
                        className="hrPayBreakdown__editBtn"
                        onClick={() => onStartPayrollLineEdit(line)}
                        disabled={isSavingPayrollLine}
                        aria-label={`Edit amount for ${line.label}`}
                        title={`Edit amount for ${line.label}`}
                      >
                        <FiEdit2 />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="hrPayBreakdown__empty">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}

export function PayslipBreakdownModal({
  canEditSelectedPayrollItem,
  currentRun,
  editingPayrollLineKey,
  isLoadingPayrollItem,
  isSavingPayrollLine,
  onCancelPayrollLineEdit,
  onClose,
  onPayrollLineDraftAmountChange,
  onSavePayrollLineAmount,
  onStartPayrollLineEdit,
  open,
  payrollLineDraftAmount,
  selectedPayrollDeductions,
  selectedPayrollGross,
  selectedPayrollIsBonusPayout,
  selectedPayrollItem,
  selectedPayrollItemDeductions,
  selectedPayrollItemEarnings,
  selectedPayrollNet,
}: PayslipBreakdownModalProps) {
  if (!open || !selectedPayrollItem) return null;

  return (
    <LargePopup
      open
      ariaLabel="Payroll item breakdown"
      title={`${selectedPayrollItem.employee} - Payslip Breakdown`}
      subtitle="Review the current earnings, deductions, and totals, and edit line amounts while this payroll item is still in progress."
      size="xl"
      className="hrPayPopup hrPayPopup--breakdown"
      onClose={onClose}
    >
      <div className="hrPayModal">
        <div className="hrPayModal__grid">
          <label>
            <span>Payroll Item:</span>
            <input value={`#${selectedPayrollItem.itemId}`} readOnly />
          </label>
          <label>
            <span>Run Status:</span>
            <input value={formatPayrollStatusLabel(currentRun?.payrollStatus ?? 'IN_PROGRESS')} readOnly />
          </label>
          <label>
            <span>Pay Period:</span>
            <input value={`${formatDate(currentRun?.periodStart)} - ${formatDate(currentRun?.periodEnd)}`} readOnly />
          </label>
          <label>
            <span>Run Type:</span>
            <input
              value={formatPayrollRunTypeLabel(currentRun?.runType, {
                bonusPayout: selectedPayrollIsBonusPayout,
              })}
              readOnly
            />
          </label>
        </div>

        <div className="hrPayBreakdownTotals">
          <div className="hrPayBreakdownTotals__card">
            <span>Gross Pay</span>
            <strong>{formatCurrency(selectedPayrollGross)}</strong>
          </div>
          <div className="hrPayBreakdownTotals__card">
            <span>Total Deductions</span>
            <strong>{formatCurrency(selectedPayrollDeductions)}</strong>
          </div>
          <div className="hrPayBreakdownTotals__card">
            <span>Net Pay</span>
            <strong>{formatCurrency(selectedPayrollNet)}</strong>
          </div>
        </div>

        {isLoadingPayrollItem ? (
          <p className="hrPayModal__intro">
            Loading the payroll lines for this employee so the full payslip breakdown can be reviewed.
          </p>
        ) : (
          <div className="hrPayBreakdown">
            {renderBreakdownSection({
              canEditSelectedPayrollItem,
              editingPayrollLineKey,
              isSavingPayrollLine,
              lines: selectedPayrollItemEarnings,
              onCancelPayrollLineEdit,
              onPayrollLineDraftAmountChange,
              onSavePayrollLineAmount,
              onStartPayrollLineEdit,
              payrollLineDraftAmount,
              title: 'Earnings',
            })}
            {renderBreakdownSection({
              canEditSelectedPayrollItem,
              editingPayrollLineKey,
              isSavingPayrollLine,
              lines: selectedPayrollItemDeductions,
              onCancelPayrollLineEdit,
              onPayrollLineDraftAmountChange,
              onSavePayrollLineAmount,
              onStartPayrollLineEdit,
              payrollLineDraftAmount,
              title: 'Deductions',
            })}
          </div>
        )}
      </div>
    </LargePopup>
  );
}

type PayslipDisputeModalProps = {
  canReviewSelectedDispute: boolean;
  canStageSelectedDisputeCorrection: boolean;
  isDisputeRemarksInvalid: boolean;
  isSaving: boolean;
  onClose: () => void;
  onOpenAttachment: (pathId: number) => void | Promise<void>;
  onOpenSelectedDisputeCorrection: () => void;
  onPendingDisputeDecisionChange: (value: 'APPROVED' | 'REJECTED') => void;
  onRemarksChange: (value: string) => void;
  onRequestDisputeDecisionConfirmation: () => void;
  open: boolean;
  openingAttachmentId: number | null;
  pendingDisputeDecision: 'APPROVED' | 'REJECTED' | null;
  remarks: string;
  selectedDispute: DisputeRow | null;
};

export function PayslipDisputeModal({
  canReviewSelectedDispute,
  canStageSelectedDisputeCorrection,
  isDisputeRemarksInvalid,
  isSaving,
  onClose,
  onOpenAttachment,
  onOpenSelectedDisputeCorrection,
  onPendingDisputeDecisionChange,
  onRemarksChange,
  onRequestDisputeDecisionConfirmation,
  open,
  openingAttachmentId,
  pendingDisputeDecision,
  remarks,
  selectedDispute,
}: PayslipDisputeModalProps) {
  if (!open || !selectedDispute) return null;

  return (
    <LargePopup
      open
      ariaLabel="Payslip dispute review"
      title={`${selectedDispute.employee} - Payslip Dispute`}
      subtitle="Review the employee dispute, decide whether it should be denied or moved to waiting for adjustment, and reopen it later when you are ready to stage the correction."
      size="xl"
      className="hrPayPopup hrPayPopup--dispute"
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={isSaving}>
            {canReviewSelectedDispute || canStageSelectedDisputeCorrection ? 'Cancel' : 'Close'}
          </button>
          {canReviewSelectedDispute ? (
            <button
              type="button"
              className="btn"
              onClick={onRequestDisputeDecisionConfirmation}
              disabled={isSaving || !pendingDisputeDecision}
            >
              {isSaving
                ? 'Saving...'
                : pendingDisputeDecision === 'APPROVED'
                  ? 'Move to Waiting Adjustment'
                  : pendingDisputeDecision === 'REJECTED'
                    ? 'Confirm Denial'
                    : 'Confirm Decision'}
            </button>
          ) : canStageSelectedDisputeCorrection ? (
            <button type="button" className="btn" onClick={onOpenSelectedDisputeCorrection}>
              Open Adjustment Workspace
            </button>
          ) : (
            <button type="button" className="btn" onClick={onClose} disabled={isSaving}>
              Close
            </button>
          )}
        </>
      )}
    >
      <div className="hrPayModal">
        <div className="hrPayModal__grid">
          <label>
            <span>Status:</span>
            <input value={selectedDispute.statusLabel} readOnly />
          </label>
          <label>
            <span>Submitted At:</span>
            <input value={selectedDispute.submittedAt} readOnly />
          </label>
          <label>
            <span>Payroll Period:</span>
            <input value={selectedDispute.payrollPeriod} readOnly />
          </label>
          <label>
            <span>Dispute Type:</span>
            <input value={selectedDispute.subject} readOnly />
          </label>
        </div>

        <label className="hrPayModal__area">
          <span>Reason for Dispute:</span>
          <textarea value={selectedDispute.reason || 'No reason provided.'} readOnly />
        </label>

        <div className="hrApprAttachment hrApprAttachment--payroll">
          <div className="hrApprAttachment__copy">
            <span>Attachment:</span>
            <p>
              {typeof selectedDispute.attachmentPathId === 'number'
                ? 'A supporting file was uploaded with this dispute.'
                : 'No attachment was uploaded with this dispute.'}
            </p>
          </div>
          {typeof selectedDispute.attachmentPathId === 'number' && (
            <button
              type="button"
              className="hrApprAttachment__button"
              onClick={() => void onOpenAttachment(selectedDispute.attachmentPathId!)}
              disabled={openingAttachmentId === selectedDispute.attachmentPathId}
            >
              {openingAttachmentId === selectedDispute.attachmentPathId ? 'Opening...' : 'View Attachment'}
            </button>
          )}
        </div>

        {selectedDispute.decisionSummary && (
          <label className="hrPayModal__area">
            <span>Latest Decision Note:</span>
            <textarea value={selectedDispute.decisionSummary} readOnly />
          </label>
        )}

        {canReviewSelectedDispute && (
          <>
            <div className="hrPayModal__area">
              <span>Administrative Decision:</span>
              <div className="decisionPicker">
                <div className="decisionPicker__actions">
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDisputeDecision === 'APPROVED' ? 'is-selected' : ''}`}
                    disabled={isSaving}
                    onClick={() => onPendingDisputeDecisionChange('APPROVED')}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className={`decisionPicker__button ${pendingDisputeDecision === 'REJECTED' ? 'is-selected' : ''}`}
                    disabled={isSaving}
                    onClick={() => onPendingDisputeDecisionChange('REJECTED')}
                  >
                    Deny
                  </button>
                </div>
                <p className="decisionPicker__note">
                  Approving this dispute will move it to <strong>Waiting for Adjustment</strong> so you can stage the
                  payroll fix later instead of being redirected immediately.
                </p>
              </div>
            </div>

            <label className="hrPayModal__area">
              <span>Reason for Approval / Denial:</span>
              <textarea
                placeholder="Type at least 20 characters explaining the decision"
                value={remarks}
                aria-invalid={isDisputeRemarksInvalid ? 'true' : undefined}
                onChange={(event) => onRemarksChange(event.target.value)}
              />
            </label>
          </>
        )}

        {canStageSelectedDisputeCorrection && (
          <div className="hrPayModal__callout">
            <strong>This dispute is waiting for adjustment.</strong>
            <span>
              The approval is already saved. Open the correction workspace whenever you are ready to edit the payroll
              line and stage the adjustment entry.
            </span>
          </div>
        )}

        {selectedDispute.statusCode === 'APPROVED' && (
          <p className="hrPay__message hrPay__message--ok">
            This dispute is already settled. Any correction that was needed has been staged or finalized.
          </p>
        )}

        {selectedDispute.statusCode === 'REJECTED' && (
          <p className="hrPay__message">This dispute was denied and no payroll adjustment will be staged from it.</p>
        )}

        {selectedDispute.statusCode === 'CANCELLED' && (
          <p className="hrPay__message">The employee cancelled this dispute before it was fully processed.</p>
        )}
      </div>
    </LargePopup>
  );
}
