import { useLoading } from '@/context/useLoading';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, apiFetchJson, toArray } from '@/lib/api/api';
import ConfirmDialog from '@/components/dialog/ConfirmDialog';
import SensitiveAccessIndicator from '@/components/security/SensitiveAccessIndicator';
import SensitiveAccessModal from '@/components/security/SensitiveAccessModal';
import { useUiDialog } from '@/components/dialog/useUiDialog';
import PageHeader from '@/components/layout/PageHeader';
import { useAutoRefreshingPage } from '@/hooks/useAutoRefreshingPage';
import { useEscapeDismiss } from '@/hooks/useEscapeDismiss';
import { useErrorDialogEffect } from '@/hooks/useErrorDialogEffect';
import { useSensitiveAccessPrompt } from '@/hooks/useSensitiveAccessPrompt';
import { useUnsavedChangesPrompt } from '@/hooks/useUnsavedChangesPrompt';
import { compareEmployees } from '@/lib/utils/employeeSort';
import { hasBonusEarning } from '@/lib/payrollRunLabels';
import { openDocumentAttachment } from '@/lib/document/documentAttachments';
import { getFriendlyErrorMessage } from '@/lib/uiErrors';
import { formatDate } from '@/lib/utils/formatters';
import type { EmployeeOption } from '@/lib/types/employee';
import type { PayrollRunRow as PayrollRunDto } from '@/lib/types/payroll';
import { usePayslipFilters } from './hooks/usePayslipFilters';
import {
  applyStandardPaymentDate,
  buildCorrectionIntent,
  buildEmployeeOptions,
  clearStoredRun,
  compareRunsDescending,
  createDefaultManualLineForm,
  createDefaultRunForm,
  createWaitingDisputeRow,
  describeAdjustmentRun,
  describeRun,
  EMPLOYEE_OPTIONS_TIMEOUT_MS,
  formatRunType,
  getStandardPaymentDate,
  getTodayIsoDate,
  isFutureIsoDate,
  mapCorrectionLine,
  mapCorrectionLines,
  mapDisputeRows,
  mapDisputeType,
  mapPayrollItemSummaryRows,
  normalizeRunType,
  normalizeText,
  persistRunSelection,
  pickCurrentRun,
  readStoredRun,
  reconcileWaitingDisputes,
  removeWaitingDispute,
  summarizePayrollItemLines,
  toAmount,
  upsertWaitingDispute,
} from './payslipsShared';
import PayslipDisputesPanel from './sections/PayslipDisputesPanel';
import {
  PayslipCorrectionModal,
  PayslipManualLineModal,
  PayslipPostRunModal,
  PayslipRunModal,
} from './sections/PayslipActionModals';
import PayslipRunPanel from './sections/PayslipRunPanel';
import { PayslipBreakdownModal, PayslipDisputeModal } from './sections/PayslipReviewModals';
import type {
  CorrectionIntent,
  CorrectionLine,
  CorrectionSourceItem,
  DisputeRow,
  ManualLineFormState,
  PayrollItemSummaryRow,
  RunFormState,
  RunItemViewRow,
} from './types';
import '../approvals/Approvals.css';
import '../../manager/pending-approvals/PendingApprovals.css';
import './Payslips.css';

export default function HrPayslips() {
  const { showLoading, hideLoading } = useLoading();

  const { showSuccess } = useUiDialog();
  const sensitiveAccess = useSensitiveAccessPrompt({
    entryNotice: 'Enter your password to verify before viewing payslip management.',
  });
  const handleSensitiveAccessError = sensitiveAccess.handleProtectedError;
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<DisputeRow | null>(null);
  const [runItems, setRunItems] = useState<PayrollItemSummaryRow[]>([]);
  const [isLoadingRunItems, setIsLoadingRunItems] = useState(false);
  const [runItemsError, setRunItemsError] = useState('');
  const [selectedPayrollItem, setSelectedPayrollItem] = useState<PayrollItemSummaryRow | null>(null);
  const [selectedPayrollItemEarnings, setSelectedPayrollItemEarnings] = useState<CorrectionLine[]>([]);
  const [selectedPayrollItemDeductions, setSelectedPayrollItemDeductions] = useState<CorrectionLine[]>([]);
  const [isLoadingPayrollItem, setIsLoadingPayrollItem] = useState(false);
  const [payrollItemError, setPayrollItemError] = useState('');
  const [editingPayrollLineKey, setEditingPayrollLineKey] = useState('');
  const [payrollLineDraftAmount, setPayrollLineDraftAmount] = useState('');
  const [isSavingPayrollLine, setIsSavingPayrollLine] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const [runModalOpen, setRunModalOpen] = useState(false);
  const [confirmRunOpen, setConfirmRunOpen] = useState(false);
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [manualLineModalOpen, setManualLineModalOpen] = useState(false);
  const [runSubmitAttempted, setRunSubmitAttempted] = useState(false);
  const [runForm, setRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [initialRunForm, setInitialRunForm] = useState<RunFormState>(() => createDefaultRunForm());
  const [manualLineForm, setManualLineForm] = useState<ManualLineFormState>(() => createDefaultManualLineForm());
  const [initialManualLineForm, setInitialManualLineForm] = useState<ManualLineFormState>(() => createDefaultManualLineForm());
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployeeOptions, setIsLoadingEmployeeOptions] = useState(false);
  const [manualEmployeeSearch, setManualEmployeeSearch] = useState('');
  const [initialManualEmployeeSearch, setInitialManualEmployeeSearch] = useState('');
  const [manualEmployeePickerOpen, setManualEmployeePickerOpen] = useState(false);
  const [manualLineError, setManualLineError] = useState('');
  const [manualLineSubmitAttempted, setManualLineSubmitAttempted] = useState(false);
  const [isSubmittingManualLine, setIsSubmittingManualLine] = useState(false);
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);
  const [isPostingRun, setIsPostingRun] = useState(false);
  const [runError, setRunError] = useState('');
  const [payrollRuns, setPayrollRuns] = useState<PayrollRunDto[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRunDto | null>(null);
  const {
    clearDisputeFilters,
    clearRunItemFilters,
    disputeFilterOpen,
    disputeSearchValue,
    disputeStatusFilter,
    disputeTypeFilter,
    runItemDepartmentFilter,
    runItemFilterOpen,
    runItemRoleFilter,
    runItemSort,
    runItemSortOpen,
    setDisputeFilterOpen,
    setDisputeSearchValue,
    setDisputeStatusFilter,
    setDisputeTypeFilter,
    setRunItemDepartmentFilter,
    setRunItemFilterOpen,
    setRunItemRoleFilter,
    setRunItemSort,
    setRunItemSortOpen,
  } = usePayslipFilters();
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionIntent, setCorrectionIntent] = useState<CorrectionIntent | null>(null);
  const [correctionSource, setCorrectionSource] = useState<CorrectionSourceItem | null>(null);
  const [correctionLines, setCorrectionLines] = useState<CorrectionLine[]>([]);
  const [selectedCorrectionKey, setSelectedCorrectionKey] = useState('');
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [correctionError, setCorrectionError] = useState('');
  const [correctionSubmitAttempted, setCorrectionSubmitAttempted] = useState(false);
  const [isLoadingCorrection, setIsLoadingCorrection] = useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [adjustmentRunId, setAdjustmentRunId] = useState<number | null>(null);
  const [pendingDisputeDecision, setPendingDisputeDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [confirmDisputeDecisionOpen, setConfirmDisputeDecisionOpen] = useState(false);
  const [disputeDecisionSubmitAttempted, setDisputeDecisionSubmitAttempted] = useState(false);
  const [attachmentError, setAttachmentError] = useState('');
  const [openingAttachmentId, setOpeningAttachmentId] = useState<number | null>(null);
  const manualEmployeePickerRef = useRef<HTMLDivElement | null>(null);
  const loadedRunItemsPayIdRef = useRef<number | null>(null);
  const isRunDirty =
    runModalOpen &&
    (runForm.periodStart !== initialRunForm.periodStart ||
      runForm.periodEnd !== initialRunForm.periodEnd ||
      runForm.paymentDate !== initialRunForm.paymentDate ||
      runForm.runType !== initialRunForm.runType);
  const isManualLineDirty =
    manualLineModalOpen &&
    (manualLineForm.empId !== initialManualLineForm.empId ||
      manualLineForm.lineType !== initialManualLineForm.lineType ||
      manualLineForm.amount !== initialManualLineForm.amount ||
      manualEmployeeSearch !== initialManualEmployeeSearch);
  const isCorrectionDirty =
    correctionOpen && (selectedCorrectionKey.trim().length > 0 || correctedAmount.trim().length > 0);
  const isDisputeReviewDirty =
    Boolean(selectedDispute) && (remarks.trim().length > 0 || pendingDisputeDecision !== null);
  const runUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: runModalOpen,
    isDirty: isRunDirty,
    isBusy: isSubmittingRun,
    onDiscard: closeRunModal,
  });
  const manualLineUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: manualLineModalOpen,
    isDirty: isManualLineDirty,
    isBusy: isSubmittingManualLine,
    onDiscard: resetManualLineState,
  });
  const correctionUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: correctionOpen,
    isDirty: isCorrectionDirty,
    isBusy: isSubmittingCorrection,
    onDiscard: resetCorrectionState,
  });
  const disputeReviewUnsavedPrompt = useUnsavedChangesPrompt({
    isOpen: Boolean(selectedDispute),
    isDirty: isDisputeReviewDirty,
    isBusy: isSaving,
    onDiscard: () => setSelectedDispute(null),
  });

  useErrorDialogEffect(loadError, 'Payroll data could not be loaded');
  useErrorDialogEffect(runItemsError, 'Payroll run items could not be loaded');
  useErrorDialogEffect(payrollItemError, 'Payroll item action failed');
  useErrorDialogEffect(manualLineError, 'Manual adjustment line could not be added');
  useErrorDialogEffect(actionError, 'Dispute action failed');
  useErrorDialogEffect(runError, 'Payroll run could not be completed');
  useErrorDialogEffect(correctionError, 'Payroll correction could not be completed');
  useErrorDialogEffect(attachmentError, 'Attachment could not be opened');
  useEscapeDismiss(runModalOpen && !isSubmittingRun && !runUnsavedPrompt.confirmOpen, runUnsavedPrompt.requestClose, 10);
  useEscapeDismiss(postModalOpen && !isPostingRun, () => setPostModalOpen(false), 10);
  useEscapeDismiss(
    manualLineModalOpen && !isSubmittingManualLine && !manualLineUnsavedPrompt.confirmOpen,
    manualLineUnsavedPrompt.requestClose,
    10
  );
  useEscapeDismiss(
    correctionOpen && !isSubmittingCorrection && !correctionUnsavedPrompt.confirmOpen,
    correctionUnsavedPrompt.requestClose,
    10
  );
  useEscapeDismiss(Boolean(selectedPayrollItem), () => setSelectedPayrollItem(null), 10);
  useEscapeDismiss(
    Boolean(selectedDispute) && !isSaving && !disputeReviewUnsavedPrompt.confirmOpen,
    disputeReviewUnsavedPrompt.requestClose,
    10
  );
  const handlePageRefresh = () => {
    setRefreshTick((tick) => tick + 1);
  };
  useAutoRefreshingPage(handlePageRefresh, {
    intervalMs: 15000,
    enabled:
      sensitiveAccess.isVerified &&
      !sensitiveAccess.open &&
      !selectedDispute &&
      !selectedPayrollItem &&
      !runModalOpen &&
      !postModalOpen &&
      !manualLineModalOpen &&
      !correctionOpen &&
      !isSaving &&
      !isSubmittingManualLine &&
      !isSubmittingRun &&
      !isPostingRun &&
      !isSubmittingCorrection,
  });

  const syncRunForm = useCallback((run: PayrollRunDto) => {
    setRunForm((prev) => ({
      periodStart: run.periodStart ?? prev.periodStart,
      periodEnd: run.periodEnd ?? prev.periodEnd,
      paymentDate: run.paymentDate ?? prev.paymentDate,
      runType: normalizeRunType(run.runType),
    }));
  }, []);

  const loadCurrentRun = useCallback(async (preferredPayId?: number | null) => {
    try {
      const response = await apiFetchJson<unknown>('/api/payroll/run');
      const runs = [...toArray<PayrollRunDto>(response)].sort(compareRunsDescending);
      if (preferredPayId != null && !runs.some((run) => run.payId === preferredPayId)) {
        clearStoredRun();
      }
      const nextRun = pickCurrentRun(runs, preferredPayId);

      setPayrollRuns(runs);
      setCurrentRun(nextRun);
      if (nextRun) syncRunForm(nextRun);
    } catch (error) {
      if (
        handleSensitiveAccessError(
          error,
          async () => {
            await loadCurrentRun(preferredPayId);
          },
          'Verify access before opening payslip management.'
        )
      ) {
        return;
      }
      setPayrollRuns([]);
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    }
  }, [handleSensitiveAccessError, syncRunForm]);

  useEffect(() => {
    if (selectedDispute || selectedPayrollItem || runModalOpen || postModalOpen || manualLineModalOpen || correctionOpen) {
      document.body.classList.add('modal-open');
    }
    else document.body.classList.remove('modal-open');

    return () => document.body.classList.remove('modal-open');
  }, [correctionOpen, manualLineModalOpen, postModalOpen, runModalOpen, selectedDispute, selectedPayrollItem]);

  useEffect(() => {
    setRemarks('');
    setActionError('');
    setPendingDisputeDecision(null);
    setDisputeDecisionSubmitAttempted(false);
    setConfirmDisputeDecisionOpen(false);
  }, [selectedDispute?.id]);

  useEffect(() => {
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
  }, [selectedPayrollItem?.itemId]);

  useEffect(() => {
    if ((!manualLineModalOpen && currentRun?.payrollStatus !== 'IN_PROGRESS') || employeeOptions.length > 0) {
      return;
    }

    let cancelled = false;
    let didTimeout = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, EMPLOYEE_OPTIONS_TIMEOUT_MS);

    async function loadEmployeeOptions() {
      setIsLoadingEmployeeOptions(true);
      if (manualLineModalOpen) {
        setManualLineError('');
      }
      try {
        let response: unknown;
        try {
          response = await apiFetchJson<unknown>('/api/employees/options', { signal: controller.signal });
        } catch (error) {
          if (controller.signal.aborted) throw error;
          if (!(error instanceof ApiError) || error.status !== 404) {
            throw error;
          }
          response = await apiFetchJson<unknown>('/api/employees?page=0&size=200', { signal: controller.signal });
        }

        if (cancelled) return;
        setEmployeeOptions(buildEmployeeOptions(response));
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (didTimeout) {
          if (manualLineModalOpen) {
            setManualLineError(
              'Employee list took too long to load. Close and reopen this dialog, then restart the backend if it keeps happening.'
            );
          }
          return;
        }
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        if (manualLineModalOpen) {
          setManualLineError(getFriendlyErrorMessage(error, 'employee-load'));
        }
      } finally {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsLoadingEmployeeOptions(false);
      }
    }

    void loadEmployeeOptions();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [currentRun?.payrollStatus, employeeOptions.length, manualLineModalOpen]);

  useEffect(() => {
    if (!manualEmployeePickerOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!manualEmployeePickerRef.current?.contains(event.target as Node)) {
        setManualEmployeePickerOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [manualEmployeePickerOpen]);

  useEffect(() => {
    if (!sensitiveAccess.isVerified) {
      setPayrollRuns([]);
      setCurrentRun(null);
      setRunItems([]);
      setRunItemsError('');
      setIsLoadingRunItems(false);
      return;
    }

    const storedRun = readStoredRun();
    void loadCurrentRun(storedRun?.payId);
  }, [loadCurrentRun, refreshTick, sensitiveAccess.isVerified]);

  useEffect(() => {
    persistRunSelection(currentRun);
  }, [currentRun]);

  const loadDisputes = useCallback(async () => {
    const waitingDisputes = await reconcileWaitingDisputes();
    try {
      setLoadError('');
      const response = await apiFetchJson<unknown>('/api/payroll/item/dispute/all?page=0&size=100');
      const pendingDisputes = mapDisputeRows(response);
      const merged = [...pendingDisputes, ...waitingDisputes]
        .filter((row, idx, rows) => rows.findIndex((entry) => entry.id === row.id) === idx)
        .sort((left, right) => right.sortStamp - left.sortStamp || left.employee.localeCompare(right.employee));
      setDisputes(merged);
      return merged;
    } catch (error) {
      if (
        handleSensitiveAccessError(
          error,
          async () => {
            await loadDisputes();
          },
          'Verify access before opening payslip disputes and payroll runs.'
        )
      ) {
        return waitingDisputes;
      }
      setDisputes(waitingDisputes);
      setLoadError(getFriendlyErrorMessage(error, 'payroll-dispute'));
      return waitingDisputes;
    }
  }, [handleSensitiveAccessError]);

  useEffect(() => {
    if (!sensitiveAccess.isVerified) {
      setDisputes([]);
      setLoadError('');
      return;
    }

    void loadDisputes();
  }, [loadDisputes, refreshTick, sensitiveAccess.isVerified]);

  useEffect(() => {
    if (!sensitiveAccess.isVerified || !currentRun?.payId || currentRun.payrollStatus !== 'IN_PROGRESS') {
      loadedRunItemsPayIdRef.current = null;
      setRunItems([]);
      setRunItemsError('');
      setIsLoadingRunItems(false);
      return;
    }

    let cancelled = false;

    async function loadRunItems() {
      const payId = currentRun?.payId;
      if (payId == null) {
        loadedRunItemsPayIdRef.current = null;
        setRunItems([]);
        setIsLoadingRunItems(false);
        return;
      }

      const shouldShowLoadingState = loadedRunItemsPayIdRef.current !== payId;
      if (shouldShowLoadingState) {
        setIsLoadingRunItems(true);
        setRunItems([]);
      }
      setRunItemsError('');

      try {
        const response = await apiFetchJson<unknown>(`/api/payroll/run/${payId}/items?page=0&size=500`);
        if (cancelled) return;

        const mapped = mapPayrollItemSummaryRows(response);

        loadedRunItemsPayIdRef.current = payId;
        setRunItems(mapped);
      } catch (error) {
        if (!cancelled) {
          if (
            handleSensitiveAccessError(
              error,
              loadRunItems,
              'Verify access before loading payroll run items for this payslip run.'
            )
          ) {
            return;
          }
          if (shouldShowLoadingState) {
            loadedRunItemsPayIdRef.current = null;
            setRunItems([]);
          }
          setRunItemsError(getFriendlyErrorMessage(error, 'payroll-run'));
        }
      } finally {
        if (!cancelled) setIsLoadingRunItems(false);
      }
    }

    void loadRunItems();

    return () => {
      cancelled = true;
    };
  }, [currentRun?.payId, currentRun?.payrollStatus, refreshTick, handleSensitiveAccessError, sensitiveAccess.isVerified]);

  const displayedPeriodStart = currentRun?.periodStart ?? runForm.periodStart;
  const displayedPeriodEnd = currentRun?.periodEnd ?? runForm.periodEnd;
  const canAddManualAdjustmentLine =
    currentRun?.payrollStatus === 'IN_PROGRESS' && currentRun?.runType === 'ADJUSTMENT';
  const canPostCurrentRun =
    Boolean(currentRun?.payId) &&
    currentRun?.payrollStatus !== 'POSTED' &&
    (currentRun?.itemCount ?? 0) > 0;
  const emptyRunHint =
    currentRun && currentRun.payrollStatus !== 'POSTED' && (currentRun.itemCount ?? 0) <= 0
      ? currentRun.runType === 'ADJUSTMENT'
        ? ''
        : 'This run has no generated payroll items yet. Process the payroll period again or check if there were eligible employees for these dates.'
      : '';
  const runModalTitle =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';
  const runSubmitLabel =
    runForm.runType === 'ADJUSTMENT' ? 'Create Adjustment Run' : 'Create New Payroll Run';
  const hasOngoingRunConflict =
    currentRun?.payrollStatus === 'IN_PROGRESS' &&
    (currentRun.periodStart !== runForm.periodStart ||
      currentRun.periodEnd !== runForm.periodEnd ||
      normalizeRunType(currentRun.runType) !== runForm.runType);
  const confirmRunTitle = hasOngoingRunConflict
    ? 'Ongoing Payroll Run Detected'
    : runForm.runType === 'ADJUSTMENT'
      ? 'Confirm Adjustment Run'
      : 'Confirm New Payroll Run';
  const confirmRunMessage =
    hasOngoingRunConflict && currentRun
      ? `There is already an ongoing ${formatRunType(currentRun.runType)} for ${formatDate(
          currentRun.periodStart
        )} to ${formatDate(
          currentRun.periodEnd
        )}. Creating another run will switch this page to the new run. Continue?`
      : `Create a ${runForm.runType === 'ADJUSTMENT' ? 'payroll adjustment' : 'new payroll'} run for ${formatDate(
          runForm.periodStart
        )} to ${formatDate(runForm.periodEnd)}?`;
  const confirmRunConfirmLabel = hasOngoingRunConflict
    ? 'Create Another Run'
    : runForm.runType === 'ADJUSTMENT'
      ? 'Create Adjustment Run'
      : 'Create New Payroll Run';
  const confirmRunCancelLabel = hasOngoingRunConflict ? 'Keep Current Run' : 'Go Back';

  const currentPayPeriod = useMemo(() => {
    return formatDate(currentRun?.paymentDate ?? runForm.paymentDate);
  }, [currentRun?.paymentDate, runForm.paymentDate]);
  const todayIsoDate = useMemo(() => getTodayIsoDate(), []);
  const normalizedDisputeSearch = normalizeText(disputeSearchValue);
  const canReviewSelectedDispute = selectedDispute ? selectedDispute.statusCode === 'PENDING' : false;
  const canStageSelectedDisputeCorrection =
    selectedDispute ? selectedDispute.statusCode === 'WAITING_ADJUSTMENT' : false;
  const isCurrentRunInProgress = currentRun?.payrollStatus === 'IN_PROGRESS';
  const canEditSelectedPayrollItem = currentRun?.payrollStatus === 'IN_PROGRESS';
  const inProgressRuns = useMemo(
    () => payrollRuns.filter((run) => run.payrollStatus === 'IN_PROGRESS'),
    [payrollRuns]
  );
  const currentInProgressRunIndex = useMemo(() => {
    if (currentRun?.payId == null) return -1;
    return inProgressRuns.findIndex((run) => run.payId === currentRun.payId);
  }, [currentRun?.payId, inProgressRuns]);
  const hasMultipleInProgressRuns = inProgressRuns.length > 1;
  const canViewPreviousInProgressRun = currentInProgressRunIndex > 0;
  const canViewNextInProgressRun =
    currentInProgressRunIndex >= 0 && currentInProgressRunIndex < inProgressRuns.length - 1;
  const employeeOptionsById = useMemo(
    () => new Map(employeeOptions.map((option) => [option.id, option])),
    [employeeOptions]
  );
  const manualSelectableEmployeeOptions = useMemo(
    () => employeeOptions.filter((option) => normalizeText(option.status) !== 'terminated'),
    [employeeOptions]
  );
  const selectedPayrollGross = selectedPayrollItem ? selectedPayrollItem.grossPay : 0;
  const selectedPayrollNet = selectedPayrollItem ? selectedPayrollItem.netPay : 0;
  const selectedPayrollDeductions = useMemo(() => {
    if (!selectedPayrollItem) return 0;
    if (selectedPayrollItemDeductions.length > 0) {
      return selectedPayrollItemDeductions.reduce((sum, line) => sum + toAmount(line.amount), 0);
    }
    return selectedPayrollItem.deductions;
  }, [selectedPayrollItem, selectedPayrollItemDeductions]);
  const selectedPayrollIsBonusPayout = useMemo(
    () => currentRun?.runType === 'ADJUSTMENT' && hasBonusEarning(selectedPayrollItemEarnings),
    [currentRun?.runType, selectedPayrollItemEarnings]
  );
  const runItemRows = useMemo<RunItemViewRow[]>(() => {
    return runItems.map((row) => {
      const option = typeof row.empId === 'number' ? employeeOptionsById.get(row.empId) : undefined;
      return {
        ...row,
        role: option?.position ?? '',
        department: option?.department ?? '',
      };
    });
  }, [employeeOptionsById, runItems]);

  const runItemRoleOptions = useMemo(
    () => Array.from(new Set(runItemRows.map((row) => row.role).filter(Boolean))).sort(),
    [runItemRows]
  );

  const runItemDepartmentOptions = useMemo(
    () => Array.from(new Set(runItemRows.map((row) => row.department).filter(Boolean))).sort(),
    [runItemRows]
  );

  const visibleRunItems = useMemo(() => {
    const filtered = runItemRows.filter((row) => {
      if (runItemRoleFilter !== 'all' && row.role !== runItemRoleFilter) {
        return false;
      }

      if (runItemDepartmentFilter !== 'all' && row.department !== runItemDepartmentFilter) {
        return false;
      }

      return true;
    });

    return [...filtered].sort((left, right) =>
      compareEmployees(runItemSort, { id: left.empId, name: left.employee }, { id: right.empId, name: right.employee })
    );
  }, [runItemDepartmentFilter, runItemRoleFilter, runItemRows, runItemSort]);
  const selectedManualEmployee = useMemo(() => {
    const employeeId = Number(manualLineForm.empId);
    if (!Number.isFinite(employeeId) || employeeId <= 0) return null;
    return manualSelectableEmployeeOptions.find((option) => option.id === employeeId) ?? null;
  }, [manualLineForm.empId, manualSelectableEmployeeOptions]);
  const filteredEmployeeOptions = useMemo(() => {
    const query = normalizeText(manualEmployeeSearch);
    if (!query) return manualSelectableEmployeeOptions;
    return manualSelectableEmployeeOptions.filter((option) => normalizeText(option.name).includes(query));
  }, [manualEmployeeSearch, manualSelectableEmployeeOptions]);
  const canClearManualEmployeePicker =
    manualEmployeeSearch.trim().length > 0 || manualLineForm.empId.trim().length > 0;

  const visibleDisputes = useMemo(() => {
    return disputes.filter((row) => {
      if (disputeStatusFilter !== 'all' && row.statusCode !== disputeStatusFilter) {
        return false;
      }

      if (disputeTypeFilter !== 'all' && mapDisputeType(row.subject) !== disputeTypeFilter) {
        return false;
      }

      if (!normalizedDisputeSearch) {
        return true;
      }

      const haystack = [
        row.employee,
        row.payrollPeriod,
        row.submittedAt,
        row.statusLabel,
        row.subject,
        row.reason,
        row.decisionSummary,
      ]
        .map(normalizeText)
        .join(' ');

      return haystack.includes(normalizedDisputeSearch);
    });
  }, [disputes, disputeStatusFilter, disputeTypeFilter, normalizedDisputeSearch]);

  const activeDisputeFilterCount = [disputeStatusFilter, disputeTypeFilter].filter((value) => value !== 'all').length;
  const activeRunItemFilterCount = [runItemRoleFilter, runItemDepartmentFilter].filter((value) => value !== 'all').length;

  const selectedCorrectionLine = useMemo(
    () => correctionLines.find((line) => line.key === selectedCorrectionKey) ?? null,
    [correctionLines, selectedCorrectionKey]
  );
  const isRunPeriodStartInvalid = runSubmitAttempted && !runForm.periodStart;
  const isRunPeriodEndInvalid = runSubmitAttempted && !runForm.periodEnd;
  const isManualEmployeeInvalid = manualLineSubmitAttempted && !manualLineForm.empId.trim();
  const isManualAmountInvalid = manualLineSubmitAttempted && manualLineForm.amount.trim().length === 0;
  const isCorrectionAmountInvalid =
    correctionSubmitAttempted && Boolean(selectedCorrectionLine) && correctedAmount.trim().length === 0;
  const isDisputeRemarksInvalid = disputeDecisionSubmitAttempted && remarks.trim().length < 20;

  function showAdjacentInProgressRun(direction: -1 | 1) {
    if (currentInProgressRunIndex < 0) return;

    const nextRun = inProgressRuns[currentInProgressRunIndex + direction];
    if (!nextRun) return;

    setCurrentRun(nextRun);
    syncRunForm(nextRun);
  }

  function closeRunModal() {
    setRunModalOpen(false);
    setRunSubmitAttempted(false);
  }

  function openRunModal() {
    setRunError('');
    setRunSubmitAttempted(false);
    const nextRunForm = applyStandardPaymentDate(runForm);
    setRunForm(nextRunForm);
    setInitialRunForm(nextRunForm);
    setRunModalOpen(true);
  }

  function handleRunPeriodStartChange(nextStart: string) {
    setRunForm((prev) => {
      const next = { ...prev, periodStart: nextStart };
      const standard = getStandardPaymentDate(next.periodStart, next.periodEnd);
      if (standard) next.paymentDate = standard;
      return next;
    });
  }

  function handleRunPeriodEndChange(nextEnd: string) {
    setRunForm((prev) => {
      const next = { ...prev, periodEnd: nextEnd };
      const standard = getStandardPaymentDate(next.periodStart, next.periodEnd);
      if (standard) next.paymentDate = standard;
      return next;
    });
  }

  function handleRunPaymentDateChange(nextPaymentDate: string) {
    setRunForm((prev) => ({ ...prev, paymentDate: nextPaymentDate }));
  }

  function handleRunTypeChange(nextRunType: RunFormState['runType']) {
    setRunForm((prev) => ({
      ...prev,
      runType: nextRunType,
    }));
  }

  function resetCorrectionState() {
    setCorrectionOpen(false);
    setCorrectionIntent(null);
    setCorrectionSource(null);
    setCorrectionLines([]);
    setSelectedCorrectionKey('');
    setCorrectedAmount('');
    setCorrectionError('');
    setCorrectionSubmitAttempted(false);
    setIsLoadingCorrection(false);
    hideLoading();
    setIsSubmittingCorrection(false);
    setAdjustmentRunId(null);
  }

  function resetManualLineState() {
    setManualLineModalOpen(false);
    setManualLineForm(createDefaultManualLineForm());
    setManualEmployeeSearch('');
    setManualEmployeePickerOpen(false);
    setManualLineError('');
    setManualLineSubmitAttempted(false);
    setIsLoadingEmployeeOptions(false);
    hideLoading();
    setIsSubmittingManualLine(false);
  }

  function openManualLineModal(defaults?: Partial<ManualLineFormState>) {
    setManualLineError('');
    setManualLineSubmitAttempted(false);
    setIsLoadingEmployeeOptions(false);
    const nextEmpId = defaults?.empId ?? '';
    const nextForm: ManualLineFormState = {
      empId: nextEmpId,
      lineType: defaults?.lineType ?? 'EARNING',
      amount: defaults?.amount ?? '',
    };
    const nextEmployee =
      nextEmpId && Number.isFinite(Number(nextEmpId))
        ? manualSelectableEmployeeOptions.find((option) => option.id === Number(nextEmpId)) ?? null
        : null;
    const nextSearch = nextEmployee?.name ?? '';
    setManualLineForm(nextForm);
    setInitialManualLineForm(nextForm);
    setManualEmployeeSearch(nextSearch);
    setInitialManualEmployeeSearch(nextSearch);
    setManualEmployeePickerOpen(false);
    setManualLineModalOpen(true);
  }

  function selectManualEmployee(option: EmployeeOption) {
    setManualLineForm((prev) => ({ ...prev, empId: String(option.id) }));
    setManualEmployeeSearch(option.name);
    setManualEmployeePickerOpen(false);
    setManualLineError('');
  }

  function clearManualEmployeeSelection() {
    setManualLineForm((prev) => ({ ...prev, empId: '' }));
    setManualEmployeeSearch('');
    setManualEmployeePickerOpen(false);
    setManualLineError('');
  }

  function handleManualEmployeeSearchChange(nextValue: string) {
    setManualEmployeeSearch(nextValue);
    setManualEmployeePickerOpen(true);
    setManualLineError('');
    if (normalizeText(selectedManualEmployee?.name ?? '') !== normalizeText(nextValue)) {
      setManualLineForm((prev) => ({ ...prev, empId: '' }));
    }
  }

  function openManualEmployeePicker() {
    setManualEmployeePickerOpen(true);
  }

  function toggleManualEmployeePicker() {
    setManualEmployeePickerOpen((prev) => !prev);
  }

  async function openPayrollItemDetail(row: PayrollItemSummaryRow) {
    setSelectedPayrollItemEarnings([]);
    setSelectedPayrollItemDeductions([]);
    setPayrollItemError('');
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
    setIsLoadingPayrollItem(true);

    try {
      const [earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${row.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${row.itemId}`),
      ]);

      setSelectedPayrollItemEarnings(mapCorrectionLines(earningsResponse, 'EARNING'));
      setSelectedPayrollItemDeductions(mapCorrectionLines(deductionsResponse, 'DEDUCTION'));
      setSelectedPayrollItem(row);
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => openPayrollItemDetail(row),
          'Verify access before opening payroll item earnings and deductions.'
        )
      ) {
        return;
      }
      setPayrollItemError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsLoadingPayrollItem(false);
    }
  }

  async function ensurePayrollItemForEmployee(payId: number, empId: number) {
    const existingItem = runItems.find((row) => row.empId === empId);
    if (existingItem?.itemId) {
      return existingItem.itemId;
    }

    const createdItem = await apiFetchJson<Record<string, unknown>>('/api/payroll/item/create', {
      method: 'POST',
      body: JSON.stringify({
        payId,
        empId,
      }),
    });

    const nextItemId = Number(createdItem.id);
    if (!Number.isFinite(nextItemId) || nextItemId <= 0) {
      throw new Error('The payroll item was created, but its ID was not returned.');
    }
    return nextItemId;
  }

  async function submitManualLine() {
    setManualLineSubmitAttempted(true);
    if (!currentRun?.payId || currentRun.runType !== 'ADJUSTMENT') {
      setManualLineError('Open an in-progress adjustment run before adding manual lines.');
      return;
    }

    const empId = Number(manualLineForm.empId);
    if (!Number.isFinite(empId) || empId <= 0) {
      setManualLineError('Choose an employee before adding a manual line.');
      return;
    }

    const trimmedAmount = manualLineForm.amount.trim();
    if (!trimmedAmount) {
      setManualLineError('Enter the amount for this manual line.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setManualLineError('Manual line amount must be a valid amount greater than zero.');
      return;
    }

    setManualLineError('');
    showLoading();
    setIsSubmittingManualLine(true);

    try {
      const itemId = await ensurePayrollItemForEmployee(currentRun.payId, empId);
      if (manualLineForm.lineType === 'DEDUCTION') {
        await apiFetchJson(`/api/payroll/item/deductions/create/${itemId}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: trimmedAmount,
          }),
        });
      } else {
        await apiFetchJson(`/api/payroll/item/earnings/create/${itemId}`, {
          method: 'POST',
          body: JSON.stringify({
            amount: trimmedAmount,
            earningsType: manualLineForm.lineType === 'BONUS' ? 'BONUS' : 'FIXED',
          }),
        });
      }

      await loadCurrentRun(currentRun.payId);
      resetManualLineState();
      showSuccess(
        `${manualLineForm.lineType === 'DEDUCTION'
          ? 'Deduction'
          : manualLineForm.lineType === 'BONUS'
            ? 'Bonus'
            : 'Earning'} line added for ${selectedManualEmployee?.name ?? `Employee #${empId}`}.`,
        'Adjustment Line Added'
      );
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          submitManualLine,
          'Verify access before adding a manual payroll earning or deduction.'
        )
      ) {
        return;
      }
      setManualLineError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsSubmittingManualLine(false);
    }
  }

  function startPayrollLineEdit(line: CorrectionLine) {
    setPayrollItemError('');
    setEditingPayrollLineKey(line.key);
    setPayrollLineDraftAmount(line.amount);
  }

  function cancelPayrollLineEdit() {
    setEditingPayrollLineKey('');
    setPayrollLineDraftAmount('');
    setPayrollItemError('');
  }

  async function savePayrollLineAmount(line: CorrectionLine) {
    if (!selectedPayrollItem) return;

    const trimmedAmount = payrollLineDraftAmount.trim();
    if (!trimmedAmount) {
      setPayrollItemError('Enter an updated amount before saving this payroll line.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setPayrollItemError('Payroll line amount must be a valid non-negative number.');
      return;
    }

    if (parsedAmount.toFixed(2) === toAmount(line.amount).toFixed(2)) {
      setPayrollItemError('Change the amount before saving. The updated value cannot match the current amount.');
      return;
    }

    setPayrollItemError('');
    setIsSavingPayrollLine(true);

    try {
      const endpoint =
        line.lineType === 'EARNING'
          ? `/api/payroll/item/earnings/update/${line.lineId}`
          : `/api/payroll/item/deductions/update/${line.lineId}`;
      const updatedResponse = await apiFetchJson<Record<string, unknown>>(endpoint, {
        method: 'PATCH',
        body: JSON.stringify({ amount: trimmedAmount }),
      });

      const updatedLine = mapCorrectionLine(updatedResponse, 0, line.lineType);
      if (!updatedLine) {
        throw new Error('The updated payroll line could not be read.');
      }

      const nextEarnings =
        line.lineType === 'EARNING'
          ? selectedPayrollItemEarnings.map((entry) => (entry.key === line.key ? updatedLine : entry))
          : selectedPayrollItemEarnings;
      const nextDeductions =
        line.lineType === 'DEDUCTION'
          ? selectedPayrollItemDeductions.map((entry) => (entry.key === line.key ? updatedLine : entry))
          : selectedPayrollItemDeductions;
      const nextTotals = summarizePayrollItemLines(nextEarnings, nextDeductions, selectedPayrollItem);

      setSelectedPayrollItemEarnings(nextEarnings);
      setSelectedPayrollItemDeductions(nextDeductions);
      setSelectedPayrollItem((prev) =>
        prev && prev.itemId === selectedPayrollItem.itemId
          ? {
              ...prev,
              grossPay: nextTotals.grossPay,
              deductions: nextTotals.deductions,
              netPay: nextTotals.netPay,
            }
          : prev
      );
      setRunItems((prev) =>
        prev.map((entry) =>
          entry.itemId === selectedPayrollItem.itemId
            ? {
                ...entry,
                grossPay: nextTotals.grossPay,
                deductions: nextTotals.deductions,
                netPay: nextTotals.netPay,
              }
            : entry
        )
      );
      setEditingPayrollLineKey('');
      setPayrollLineDraftAmount('');
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => savePayrollLineAmount(line),
          'Verify access before updating protected payroll line amounts.'
        )
      ) {
        return;
      }
      setPayrollItemError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      setIsSavingPayrollLine(false);
    }
  }

  async function ensureAdjustmentRun(source: CorrectionSourceItem) {
    const sourceRun = source.runDetails;
    const sourceStart = sourceRun?.periodStart;
    const sourceEnd = sourceRun?.periodEnd;

    if (!sourceStart || !sourceEnd) {
      throw new Error('The source payslip is missing its payroll period, so no adjustment run can be prepared yet.');
    }

    const runsResponse = await apiFetchJson<unknown>('/api/payroll/run');
    const runs = toArray<PayrollRunDto>(runsResponse);
    const sortedRuns = [...runs].sort(compareRunsDescending);
    setPayrollRuns(sortedRuns);
    const reusableRun =
      runs.find(
        (run) =>
          run.runType === 'ADJUSTMENT' &&
          run.payrollStatus !== 'POSTED' &&
          run.periodStart === sourceStart &&
          run.periodEnd === sourceEnd
      ) ?? null;

    if (reusableRun) {
      setCurrentRun(reusableRun);
      syncRunForm(reusableRun);
      persistRunSelection(reusableRun);
      setAdjustmentRunId(reusableRun.payId ?? null);
      return reusableRun;
    }

    const createdRun = await apiFetchJson<PayrollRunDto>('/api/payroll/run/create', {
      method: 'POST',
      body: JSON.stringify({
        periodStart: sourceStart,
        periodEnd: sourceEnd,
        periodDescription: describeAdjustmentRun(sourceStart, sourceEnd),
        payrollStatus: 'IN_PROGRESS',
        runType: 'ADJUSTMENT',
      }),
    });

    setPayrollRuns((prev) => [...prev.filter((run) => run.payId !== createdRun.payId), createdRun].sort(compareRunsDescending));
    setCurrentRun(createdRun);
    syncRunForm(createdRun);
    persistRunSelection(createdRun);
    setAdjustmentRunId(createdRun.payId ?? null);
    showSuccess('Adjustment run is ready for the approved dispute.', 'Adjustment Run Ready');
    return createdRun;
  }

  async function startApprovedDisputeCorrection(intent: CorrectionIntent) {
    setCorrectionOpen(true);
    setCorrectionIntent(intent);
    setCorrectionSource(null);
    setCorrectionLines([]);
    setSelectedCorrectionKey('');
    setCorrectedAmount('');
    setCorrectionError('');
    setIsLoadingCorrection(true);

    try {
      const [sourceResponse, earningsResponse, deductionsResponse] = await Promise.all([
        apiFetchJson<CorrectionSourceItem>(`/api/payroll/item/manage/${intent.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/earnings/${intent.itemId}`),
        apiFetchJson<unknown>(`/api/payroll/item/deductions/${intent.itemId}`),
      ]);

      const nextLines: CorrectionLine[] = [
        ...mapCorrectionLines(earningsResponse, 'EARNING'),
        ...mapCorrectionLines(deductionsResponse, 'DEDUCTION'),
      ];

      if (nextLines.length === 0) {
        throw new Error('No earnings or deductions were found for the selected payslip item.');
      }

      setCorrectionSource(sourceResponse);
      setCorrectionLines(nextLines);
      setSelectedCorrectionKey('');
      await ensureAdjustmentRun(sourceResponse);
    } catch (error) {
      if (
        sensitiveAccess.handleProtectedError(
          error,
          () => startApprovedDisputeCorrection(intent),
          'Verify access before opening the correction workspace for a protected payslip item.'
        )
      ) {
        return;
      }
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
      if (!currentRun) {
        await loadCurrentRun();
      }
    } finally {
      setIsLoadingCorrection(false);
    }
  }

  async function submitCorrection() {
    setCorrectionSubmitAttempted(true);
    if (!correctionIntent || !correctionSource?.itemId || !selectedCorrectionLine || !adjustmentRunId) {
      setCorrectionError('Complete the correction details before submitting.');
      return;
    }

    const trimmedAmount = correctedAmount.trim();
    if (!trimmedAmount) {
      setCorrectionError('Enter the corrected amount before staging this payroll change.');
      return;
    }

    const parsedAmount = Number(trimmedAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      setCorrectionError('Corrected amount must be a valid non-negative number.');
      return;
    }

    if (parsedAmount.toFixed(2) === Number(selectedCorrectionLine.amount).toFixed(2)) {
      setCorrectionError('Change the amount before submitting. The corrected amount cannot match the current line.');
      return;
    }

    setCorrectionError('');
    showLoading();
    setIsSubmittingCorrection(true);
    try {
      await apiFetchJson(`/api/payroll/run/${adjustmentRunId}/adjustment/correction`, {
        method: 'POST',
        body: JSON.stringify({
          sourceItemId: correctionSource.itemId,
          sourceLineType: selectedCorrectionLine.lineType,
          sourceLineId: selectedCorrectionLine.lineId,
          correctedAmount: trimmedAmount,
          disputeId: correctionIntent.disputeId,
        }),
      });

      const runId = adjustmentRunId;
      const employee = correctionIntent.employee;
      resetCorrectionState();
      setSelectedDispute(null);
      removeWaitingDispute(correctionIntent.disputeId);
      await loadCurrentRun(runId);
      await loadDisputes();
      showSuccess(`Correction for ${employee} was staged successfully.`, 'Correction Staged');
    } catch (error) {
      setCorrectionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      hideLoading();
      setIsSubmittingCorrection(false);
    }
  }

  async function updateDispute(status: 'APPROVED' | 'REJECTED') {
    if (!selectedDispute) return;
    setDisputeDecisionSubmitAttempted(true);
    const trimmedRemarks = remarks.trim();
    if (trimmedRemarks.length < 20) {
      setActionError('Please enter at least 20 characters explaining the approval or denial.');
      return;
    }

    setIsSaving(true);
    setActionError('');
    try {
      const activeDispute = selectedDispute;
      await apiFetchJson<unknown>(`/api/payroll/item/dispute/update/${activeDispute.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          statusReason: trimmedRemarks,
        }),
      });
      setRemarks('');
      setPendingDisputeDecision(null);
      if (status === 'APPROVED') {
        const waitingRow = createWaitingDisputeRow(activeDispute, trimmedRemarks);
        upsertWaitingDispute(waitingRow);
        await loadDisputes();
        setSelectedDispute(null);
        showSuccess(
          `${activeDispute.employee}'s dispute was moved to Waiting for Adjustment. Reopen the request when you are ready to stage the correction.`,
          'Dispute Approved'
        );
      } else {
        removeWaitingDispute(activeDispute.id);
        setSelectedDispute(null);
        await loadDisputes();
      }
    } catch (error) {
      setActionError(getFriendlyErrorMessage(error, 'payroll-dispute'));
    } finally {
      setIsSaving(false);
    }
  }

  function openSelectedDisputeCorrection() {
    if (!selectedDispute) return;
    const intent = buildCorrectionIntent(selectedDispute);
    if (!intent) {
      setActionError('This dispute is missing its source payslip item, so no adjustment can be staged yet.');
      return;
    }

    setActionError('');
    setSelectedDispute(null);
    void startApprovedDisputeCorrection(intent);
  }

  function openDisputeRow(row: DisputeRow) {
    if (row.statusCode === 'WAITING_ADJUSTMENT') {
      const intent = buildCorrectionIntent(row);
      if (!intent) {
        setActionError('This dispute is missing its source payslip item, so no adjustment can be staged yet.');
        return;
      }

      setActionError('');
      setSelectedDispute(null);
      void startApprovedDisputeCorrection(intent);
      return;
    }

    setSelectedDispute(row);
  }

  async function confirmDisputeDecision() {
    if (!pendingDisputeDecision) {
      setActionError('Choose approve or deny before confirming the dispute decision.');
      return;
    }

    await updateDispute(pendingDisputeDecision);
  }

  function requestDisputeDecisionConfirmation() {
    setDisputeDecisionSubmitAttempted(true);
    if (!pendingDisputeDecision) {
      setActionError('Choose approve or deny before confirming the dispute decision.');
      return;
    }
    if (remarks.trim().length < 20) {
      setActionError('Please enter at least 20 characters explaining the approval or denial.');
      return;
    }
    setActionError('');
    setConfirmDisputeDecisionOpen(true);
  }

  async function handleOpenAttachment(pathId: number) {
    setAttachmentError('');
    setOpeningAttachmentId(pathId);
    try {
      await openDocumentAttachment(pathId);
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : 'Failed to open the attachment.');
    } finally {
      setOpeningAttachmentId(null);
    }
  }

  function requestPayrollRunConfirmation() {
    setRunSubmitAttempted(true);
    setRunError('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    if (isFutureIsoDate(runForm.periodStart, todayIsoDate) || isFutureIsoDate(runForm.periodEnd, todayIsoDate)) {
      setRunError('Payroll run dates cannot be later than today.');
      return;
    }

    setConfirmRunOpen(true);
  }

  async function submitPayrollRun() {
    setRunSubmitAttempted(true);
    setRunError('');

    if (!runForm.periodStart || !runForm.periodEnd) {
      setRunError('Payroll period start and end dates are required.');
      return;
    }

    if (runForm.periodEnd < runForm.periodStart) {
      setRunError('Period end cannot be earlier than period start.');
      return;
    }

    if (isFutureIsoDate(runForm.periodStart, todayIsoDate) || isFutureIsoDate(runForm.periodEnd, todayIsoDate)) {
      setRunError('Payroll run dates cannot be later than today.');
      return;
    }

    const isAdjustmentRun = runForm.runType === 'ADJUSTMENT';
    const endpoint = isAdjustmentRun ? '/api/payroll/run/create' : '/api/payroll/run/process';

    showLoading();
    setIsSubmittingRun(true);
    try {
      const createdRun = await apiFetchJson<PayrollRunDto>(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          periodStart: runForm.periodStart,
          periodEnd: runForm.periodEnd,
          paymentDate: runForm.paymentDate,
          periodDescription: describeRun(runForm.periodStart, runForm.periodEnd),
          payrollStatus: 'IN_PROGRESS',
          runType: runForm.runType,
        }),
      });

      persistRunSelection(createdRun);
      await loadCurrentRun(createdRun.payId);
      setRunModalOpen(false);
      if (isAdjustmentRun) {
        showSuccess('Adjustment run successfully created and is now the active run on this page.', 'Adjustment Run Created');
      } else {
        showSuccess('Payroll run successfully created and is now the active run on this page.', 'Payroll Run In Progress');
      }
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsSubmittingRun(false);
    }
  }

  async function postCurrentRun() {
    if (!currentRun?.payId) {
      setRunError('Create a payroll run first before posting it.');
      return;
    }

    if ((currentRun.itemCount ?? 0) <= 0) {
      setRunError('Generate payroll items first before posting this run.');
      return;
    }

    setRunError('');
    showLoading();
    setIsPostingRun(true);
    try {
      const postedRun = await apiFetchJson<PayrollRunDto>(`/api/payroll/run/${currentRun.payId}/post`, {
        method: 'PATCH',
      });
      setCurrentRun(postedRun);
      setPostModalOpen(false);
      showSuccess('Payroll run successfully posted.', 'Payroll Run Posted');
    } catch (error) {
      setRunError(getFriendlyErrorMessage(error, 'payroll-run'));
    } finally {
      hideLoading();
      setIsPostingRun(false);
    }
  }

  return (
    <div className="hrPay">
      <div className="hrPay__head">
        <PageHeader
          title="Manage Payslips"
          description="Manage payroll runs, review disputes, and publish finalized payslips."
          titleMeta={
            <SensitiveAccessIndicator
              onActivate={() =>
                sensitiveAccess.requestVerification(
                  async () => Promise.resolve(),
                  'Enter your password to unlock payslip management.'
                )
              }
            />
          }
        />
      </div>

      <PayslipRunPanel
        activeRunItemFilterCount={activeRunItemFilterCount}
        canAddManualAdjustmentLine={canAddManualAdjustmentLine}
        canPostCurrentRun={canPostCurrentRun}
        canViewNextInProgressRun={canViewNextInProgressRun}
        canViewPreviousInProgressRun={canViewPreviousInProgressRun}
        currentInProgressRunIndex={currentInProgressRunIndex}
        currentPayPeriod={currentPayPeriod}
        currentRun={currentRun}
        displayedPeriodEnd={displayedPeriodEnd}
        displayedPeriodStart={displayedPeriodStart}
        emptyRunHint={emptyRunHint}
        hasMultipleInProgressRuns={hasMultipleInProgressRuns}
        inProgressRunCount={inProgressRuns.length}
        isCurrentRunInProgress={isCurrentRunInProgress}
        isLoadingRunItems={isLoadingRunItems}
        isPostingRun={isPostingRun}
        isSubmittingManualLine={isSubmittingManualLine}
        onClearRunItemFilters={clearRunItemFilters}
        onOpenManualLineModal={() => openManualLineModal()}
        onOpenPayrollItemDetail={openPayrollItemDetail}
        onOpenPostModal={() => setPostModalOpen(true)}
        onOpenRunModal={openRunModal}
        onRunItemDepartmentFilterChange={setRunItemDepartmentFilter}
        onRunItemRoleFilterChange={setRunItemRoleFilter}
        onRunItemSortChange={setRunItemSort}
        onRunItemSortOpenChange={(open) => {
          setRunItemSortOpen(open);
          if (open) {
            setRunItemFilterOpen(false);
          }
        }}
        onShowNextRun={() => showAdjacentInProgressRun(1)}
        onShowPreviousRun={() => showAdjacentInProgressRun(-1)}
        onToggleRunItemFilter={() =>
          setRunItemFilterOpen((open) => {
            const nextOpen = !open;
            if (nextOpen) {
              setRunItemSortOpen(false);
            }
            return nextOpen;
          })
        }
        runItemDepartmentFilter={runItemDepartmentFilter}
        runItemDepartmentOptions={runItemDepartmentOptions}
        runItemFilterOpen={runItemFilterOpen}
        runItemRoleFilter={runItemRoleFilter}
        runItemRoleOptions={runItemRoleOptions}
        runItemSort={runItemSort}
        runItemSortOpen={runItemSortOpen}
        runItemsCount={runItems.length}
        visibleRunItems={visibleRunItems}
      />

      <PayslipDisputesPanel
        activeDisputeFilterCount={activeDisputeFilterCount}
        disputeFilterOpen={disputeFilterOpen}
        disputeSearchValue={disputeSearchValue}
        disputeStatusFilter={disputeStatusFilter}
        disputeTypeFilter={disputeTypeFilter}
        disputesCount={disputes.length}
        onClearDisputeFilters={clearDisputeFilters}
        onClearDisputeSearch={() => setDisputeSearchValue('')}
        onDisputeSearchChange={setDisputeSearchValue}
        onDisputeStatusFilterChange={(value) => setDisputeStatusFilter(value)}
        onDisputeTypeFilterChange={(value) => setDisputeTypeFilter(value)}
        onOpenDisputeRow={openDisputeRow}
        onToggleDisputeFilter={() => setDisputeFilterOpen((open) => !open)}
        visibleDisputes={visibleDisputes}
      />

      <PayslipRunModal
        isRunPeriodEndInvalid={isRunPeriodEndInvalid}
        isRunPeriodStartInvalid={isRunPeriodStartInvalid}
        isSubmittingRun={isSubmittingRun}
        onClose={runUnsavedPrompt.requestClose}
        onPaymentDateChange={handleRunPaymentDateChange}
        onPeriodEndChange={handleRunPeriodEndChange}
        onPeriodStartChange={handleRunPeriodStartChange}
        onRequestSubmit={requestPayrollRunConfirmation}
        onRunTypeChange={handleRunTypeChange}
        open={runModalOpen}
        runForm={runForm}
        runModalTitle={runModalTitle}
        runSubmitLabel={runSubmitLabel}
        todayIsoDate={todayIsoDate}
      />

      <PayslipManualLineModal
        canClearManualEmployeePicker={canClearManualEmployeePicker}
        filteredEmployeeOptions={filteredEmployeeOptions}
        isLoadingEmployeeOptions={isLoadingEmployeeOptions}
        isManualAmountInvalid={isManualAmountInvalid}
        isManualEmployeeInvalid={isManualEmployeeInvalid}
        isSubmittingManualLine={isSubmittingManualLine}
        manualEmployeePickerOpen={manualEmployeePickerOpen}
        manualEmployeePickerRef={manualEmployeePickerRef}
        manualEmployeeSearch={manualEmployeeSearch}
        manualLineError={manualLineError}
        manualLineForm={manualLineForm}
        onAmountChange={(value) => setManualLineForm((prev) => ({ ...prev, amount: value }))}
        onClearManualEmployeeSelection={clearManualEmployeeSelection}
        onClose={manualLineUnsavedPrompt.requestClose}
        onLineTypeChange={(value) => setManualLineForm((prev) => ({ ...prev, lineType: value }))}
        onManualEmployeeSearchChange={handleManualEmployeeSearchChange}
        onOpenManualEmployeePicker={openManualEmployeePicker}
        onSelectManualEmployee={selectManualEmployee}
        onSubmit={submitManualLine}
        onToggleManualEmployeePicker={toggleManualEmployeePicker}
        open={manualLineModalOpen && Boolean(currentRun)}
        selectedEmployeeId={manualLineForm.empId}
      />

      <PayslipPostRunModal
        currentRunId={currentRun?.payId}
        currentRunPeriodEnd={currentRun?.periodEnd}
        currentRunPeriodStart={currentRun?.periodStart}
        currentRunType={currentRun?.runType}
        isPostingRun={isPostingRun}
        onClose={() => setPostModalOpen(false)}
        onSubmit={postCurrentRun}
        open={postModalOpen && Boolean(currentRun)}
      />

      <PayslipCorrectionModal
        adjustmentRunId={adjustmentRunId}
        correctedAmount={correctedAmount}
        correctionIntent={correctionIntent}
        correctionLines={correctionLines}
        correctionSource={correctionSource}
        isCorrectionAmountInvalid={isCorrectionAmountInvalid}
        isLoadingCorrection={isLoadingCorrection}
        isSubmittingCorrection={isSubmittingCorrection}
        onClose={correctionUnsavedPrompt.requestClose}
        onCorrectedAmountChange={setCorrectedAmount}
        onSelectCorrectionKey={setSelectedCorrectionKey}
        onSubmit={submitCorrection}
        open={correctionOpen}
        selectedCorrectionKey={selectedCorrectionKey}
        selectedCorrectionLine={selectedCorrectionLine}
      />

      <PayslipBreakdownModal
        canEditSelectedPayrollItem={canEditSelectedPayrollItem}
        currentRun={currentRun}
        editingPayrollLineKey={editingPayrollLineKey}
        isLoadingPayrollItem={isLoadingPayrollItem}
        isSavingPayrollLine={isSavingPayrollLine}
        onCancelPayrollLineEdit={cancelPayrollLineEdit}
        onClose={() => setSelectedPayrollItem(null)}
        onPayrollLineDraftAmountChange={setPayrollLineDraftAmount}
        onSavePayrollLineAmount={savePayrollLineAmount}
        onStartPayrollLineEdit={startPayrollLineEdit}
        open={Boolean(selectedPayrollItem)}
        payrollLineDraftAmount={payrollLineDraftAmount}
        selectedPayrollDeductions={selectedPayrollDeductions}
        selectedPayrollGross={selectedPayrollGross}
        selectedPayrollIsBonusPayout={selectedPayrollIsBonusPayout}
        selectedPayrollItem={selectedPayrollItem}
        selectedPayrollItemDeductions={selectedPayrollItemDeductions}
        selectedPayrollItemEarnings={selectedPayrollItemEarnings}
        selectedPayrollNet={selectedPayrollNet}
      />

      <PayslipDisputeModal
        canReviewSelectedDispute={canReviewSelectedDispute}
        canStageSelectedDisputeCorrection={canStageSelectedDisputeCorrection}
        isDisputeRemarksInvalid={isDisputeRemarksInvalid}
        isSaving={isSaving}
        onClose={disputeReviewUnsavedPrompt.requestClose}
        onOpenAttachment={handleOpenAttachment}
        onOpenSelectedDisputeCorrection={openSelectedDisputeCorrection}
        onPendingDisputeDecisionChange={(value) => setPendingDisputeDecision(value)}
        onRemarksChange={setRemarks}
        onRequestDisputeDecisionConfirmation={requestDisputeDecisionConfirmation}
        open={Boolean(selectedDispute)}
        openingAttachmentId={openingAttachmentId}
        pendingDisputeDecision={pendingDisputeDecision}
        remarks={remarks}
        selectedDispute={selectedDispute}
      />
      <ConfirmDialog
        open={confirmRunOpen}
        title={confirmRunTitle}
        message={confirmRunMessage}
        confirmLabel={confirmRunConfirmLabel}
        cancelLabel={confirmRunCancelLabel}
        isBusy={isSubmittingRun}
        onConfirm={() => {
          setConfirmRunOpen(false);
          void submitPayrollRun();
        }}
        onCancel={() => setConfirmRunOpen(false)}
      />
      <ConfirmDialog
        open={confirmDisputeDecisionOpen}
        title={pendingDisputeDecision === 'REJECTED' ? 'Confirm Dispute Denial' : 'Confirm Dispute Approval'}
        message={
          selectedDispute
            ? pendingDisputeDecision === 'REJECTED'
              ? `Apply this denial to ${selectedDispute.employee}'s payroll dispute?`
              : `Approve ${selectedDispute.employee}'s payroll dispute and move it to Waiting for Adjustment?`
            : 'Confirm this dispute decision?'
        }
        confirmLabel={pendingDisputeDecision === 'REJECTED' ? 'Confirm Denial' : 'Move to Waiting Adjustment'}
        cancelLabel="Go Back"
        isBusy={isSaving}
        onConfirm={() => {
          setConfirmDisputeDecisionOpen(false);
          void confirmDisputeDecision();
        }}
        onCancel={() => setConfirmDisputeDecisionOpen(false)}
      />
      <ConfirmDialog
        open={runUnsavedPrompt.confirmOpen}
        title="Discard Payroll Run Setup?"
        message="You have unsaved changes in this payroll run form. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={runUnsavedPrompt.discardAndClose}
        onCancel={runUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={manualLineUnsavedPrompt.confirmOpen}
        title="Discard Manual Line?"
        message="You have unsaved changes in this manual adjustment form. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={manualLineUnsavedPrompt.discardAndClose}
        onCancel={manualLineUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={correctionUnsavedPrompt.confirmOpen}
        title="Discard Correction Draft?"
        message="You have unsaved changes in this correction workspace. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={correctionUnsavedPrompt.discardAndClose}
        onCancel={correctionUnsavedPrompt.keepEditing}
      />
      <ConfirmDialog
        open={disputeReviewUnsavedPrompt.confirmOpen}
        title="Discard Dispute Review Changes?"
        message="You have unsaved changes in this dispute review. If you close it now, your updates will be lost."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        onConfirm={disputeReviewUnsavedPrompt.discardAndClose}
        onCancel={disputeReviewUnsavedPrompt.keepEditing}
      />
      <SensitiveAccessModal
        open={sensitiveAccess.open}
        onClose={sensitiveAccess.close}
        onVerified={sensitiveAccess.handleVerified}
        notice={sensitiveAccess.notice}
      />
    </div>
  );
}
