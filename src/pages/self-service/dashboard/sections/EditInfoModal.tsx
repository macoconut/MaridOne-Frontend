import { FiLock, FiMinus, FiPlus } from 'react-icons/fi';
import LargePopup from '../../../../components/dialog/LargePopup';
import { formatSss, formatPhilHealth, formatPagibig, formatTin, formatPhone, formatBankAccount } from '../../../../lib/utils/phIdFormatters';

function maskAccountNumber(num: string): string {
  if (!num) return '—';
  return '••••' + num.slice(-4);
}

type EditDraft = {
  gender: string;
  birthDate: string;
  city: string;
  companyEmail: string;
  country: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  emergencyContactRelationship: string;
  pagibigNumber: string;
  personalEmail: string;
  permanentAddress: string;
  philhealthNumber: string;
  phoneNumber: string;
  sssNumber: string;
  state: string;
  temporaryAddress: string;
  tinNumber: string;
  zipCode: string;
};

type BankAccountDraft = {
  bankId?: number;
  bankName: string;
  accountNumber: string;
};

type EditInfoModalProps = {
  editDraft: EditDraft;
  bankAccounts: BankAccountDraft[];
  bankRevealed: boolean;
  emailVerificationWillReset: boolean;
  savingEdit: boolean;
  onClose: () => void;
  onSetField: <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => void;
  onAddBankAccount: () => void;
  onRemoveBankAccount: (index: number) => void;
  onSetBankAccountField: (index: number, key: keyof BankAccountDraft, value: string) => void;
  onRevealBankNumbers: () => void;
  onSubmit: () => void;
};

const GENDER_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'NON_BINARY', label: 'Non-Binary' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer Not To Say' },
];

export default function EditInfoModal({
  editDraft,
  bankAccounts,
  bankRevealed,
  emailVerificationWillReset,
  savingEdit,
  onClose,
  onSetField,
  onAddBankAccount,
  onRemoveBankAccount,
  onSetBankAccountField,
  onRevealBankNumbers,
  onSubmit,
}: EditInfoModalProps) {
  const sssDigits = editDraft.sssNumber.replace(/-/g, '');
  const sssError = sssDigits.length > 0 && sssDigits.length !== 10;

  const phDigits = editDraft.philhealthNumber.replace(/-/g, '');
  const philhealthError = phDigits.length > 0 && phDigits.length !== 12;

  const pagibigDigits = editDraft.pagibigNumber.replace(/-/g, '');
  const pagibigError = pagibigDigits.length > 0 && pagibigDigits.length !== 12;

  const tinDigits = editDraft.tinNumber.replace(/-/g, '');
  const tinError = tinDigits.length > 0 && tinDigits.length !== 9 && tinDigits.length !== 12;

  const phoneError = editDraft.phoneNumber.length > 0 && editDraft.phoneNumber.length !== 11;

  const emergencyContactError = editDraft.emergencyContactNumber.length > 0 && editDraft.emergencyContactNumber.length !== 11;

  const bankAccountError = bankRevealed && bankAccounts.some(
    acc => acc.accountNumber.length > 0 && acc.accountNumber.length < 10
  );

  const hasIdError = sssError || philhealthError || pagibigError || tinError || phoneError || emergencyContactError || bankAccountError;

  return (
    <LargePopup
      open
      ariaLabel="Edit employee info"
      title="Edit Info"
      subtitle="Update your personal details, contact information, and bank details before saving."
      size="xl"
      onClose={onClose}
      closeDisabled={savingEdit}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={savingEdit}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onSubmit} disabled={savingEdit || hasIdError}>
            {savingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="dashModal__grid">
        <div className="dashModal__sectionHeader">Personal Information</div>
        <label className="dashModal__field">
          <span>Gender</span>
          <select
            value={editDraft.gender}
            onChange={(event) => onSetField('gender', event.target.value)}
          >
            {GENDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label className="dashModal__field">
          <span>Birthday</span>
          <input
            type="date"
            value={editDraft.birthDate}
            onChange={(event) => onSetField('birthDate', event.target.value)}
          />
        </label>

        <div className="dashModal__sectionHeader">Contact</div>
        <label className="dashModal__field">
          <span>Company Email</span>
          <input
            value={editDraft.companyEmail}
            placeholder="Company email is managed by HR"
            disabled
            readOnly
          />
        </label>
        <label className="dashModal__field">
          <span>Personal Email</span>
          <input
            type="email"
            value={editDraft.personalEmail}
            placeholder="Add your personal email"
            onChange={(event) => onSetField('personalEmail', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>Phone Number</span>
          <input
            value={editDraft.phoneNumber}
            placeholder="Optional phone number"
            inputMode="numeric"
            maxLength={11}
            onChange={(event) => onSetField('phoneNumber', formatPhone(event.target.value))}
          />
          {phoneError && <span className="dashModal__helper dashModal__helper--warning">Must be exactly 11 digits.</span>}
        </label>
        <label className="dashModal__field dashModal__field--full">
          <span>Permanent Address</span>
          <input
            value={editDraft.permanentAddress}
            placeholder="Optional permanent address"
            onChange={(event) => onSetField('permanentAddress', event.target.value)}
          />
        </label>
        <label className="dashModal__field dashModal__field--full">
          <span>Temporary Address</span>
          <input
            value={editDraft.temporaryAddress}
            placeholder="Optional temporary address"
            onChange={(event) => onSetField('temporaryAddress', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>City</span>
          <input value={editDraft.city} placeholder="Optional city" onChange={(event) => onSetField('city', event.target.value)} />
        </label>
        <label className="dashModal__field">
          <span>State</span>
          <input value={editDraft.state} placeholder="Optional state" onChange={(event) => onSetField('state', event.target.value)} />
        </label>
        <label className="dashModal__field">
          <span>Country</span>
          <input value={editDraft.country} placeholder="Optional country" onChange={(event) => onSetField('country', event.target.value)} />
        </label>
        <label className="dashModal__field">
          <span>Zip Code</span>
          <input value={editDraft.zipCode} placeholder="Optional ZIP code" onChange={(event) => onSetField('zipCode', event.target.value)} />
        </label>

        <div className="dashModal__sectionHeader dashModal__sectionHeader--withAction">
          <span>Bank Information</span>
          {bankRevealed ? (
            <button
              type="button"
              className="dashModal__headerBtn"
              onClick={onAddBankAccount}
              disabled={savingEdit}
              aria-label="Add bank account"
              title="Add bank account"
            >
              <FiPlus aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="dashModal__headerBtn"
              onClick={onRevealBankNumbers}
              aria-label="Reveal bank account numbers"
              title="Click to reveal bank account numbers"
            >
              <FiLock aria-hidden="true" />
            </button>
          )}
        </div>
        {bankAccounts.map((bankAccount, index) => (
          <div key={bankAccount.bankId ?? `bank-account-${index}`} className="dashModal__field dashModal__field--full dashModal__bankRow">
            <div className="dashModal__bankRowHeader">
              <span>{`Account ${index + 1}`}</span>
              {bankRevealed && (
                <button
                  type="button"
                  className="dashModal__removeBtn"
                  onClick={() => onRemoveBankAccount(index)}
                  disabled={savingEdit}
                  aria-label={`Remove account ${index + 1}`}
                  title="Remove account"
                >
                  <FiMinus aria-hidden="true" />
                </button>
              )}
            </div>
            <div className="dashModal__inlineGroup">
              {bankRevealed ? (
                <>
                  <input
                    value={bankAccount.bankName}
                    placeholder="e.g. BDO, BPI, UnionBank"
                    onChange={(event) => onSetBankAccountField(index, 'bankName', event.target.value)}
                  />
                  <input
                    value={bankAccount.accountNumber}
                    placeholder="Bank account number"
                    inputMode="numeric"
                    maxLength={15}
                    onChange={(event) => onSetBankAccountField(index, 'accountNumber', formatBankAccount(event.target.value))}
                  />
                  {bankAccount.accountNumber.length > 0 && bankAccount.accountNumber.length < 10 && (
                    <span className="dashModal__helper dashModal__helper--warning">Must be 10 to 15 digits.</span>
                  )}
                </>
              ) : (
                <>
                  <input value={bankAccount.bankName || '—'} readOnly />
                  <input value={maskAccountNumber(bankAccount.accountNumber)} readOnly />
                </>
              )}
            </div>
          </div>
        ))}

        <div className="dashModal__sectionHeader">Government Identifiers</div>
        <label className="dashModal__field">
          <span>SSS Number</span>
          <input
            value={editDraft.sssNumber}
            placeholder="00-0000000-0"
            inputMode="numeric"
            maxLength={12}
            onChange={(event) => onSetField('sssNumber', formatSss(event.target.value))}
          />
          {sssError && <span className="dashModal__helper dashModal__helper--warning">Must be exactly 10 digits.</span>}
        </label>
        <label className="dashModal__field">
          <span>PhilHealth ID</span>
          <input
            value={editDraft.philhealthNumber}
            placeholder="00-000000000-0"
            inputMode="numeric"
            maxLength={14}
            onChange={(event) => onSetField('philhealthNumber', formatPhilHealth(event.target.value))}
          />
          {philhealthError && <span className="dashModal__helper dashModal__helper--warning">Must be exactly 12 digits.</span>}
        </label>
        <label className="dashModal__field">
          <span>Pag-IBIG MID</span>
          <input
            value={editDraft.pagibigNumber}
            placeholder="0000-0000-0000"
            inputMode="numeric"
            maxLength={14}
            onChange={(event) => onSetField('pagibigNumber', formatPagibig(event.target.value))}
          />
          {pagibigError && <span className="dashModal__helper dashModal__helper--warning">Must be exactly 12 digits.</span>}
        </label>
        <label className="dashModal__field">
          <span>TIN</span>
          <input
            value={editDraft.tinNumber}
            placeholder="000-000-000"
            inputMode="numeric"
            maxLength={15}
            onChange={(event) => onSetField('tinNumber', formatTin(event.target.value))}
          />
          {tinError && <span className="dashModal__helper dashModal__helper--warning">Must be 9 or 12 digits.</span>}
        </label>

        <div className="dashModal__sectionHeader">Emergency Contact</div>
        <label className="dashModal__field">
          <span>Contact Name</span>
          <input
            value={editDraft.emergencyContactName}
            placeholder="Full name"
            onChange={(event) => onSetField('emergencyContactName', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>Relationship</span>
          <input
            value={editDraft.emergencyContactRelationship}
            placeholder="e.g. Spouse, Sibling"
            onChange={(event) => onSetField('emergencyContactRelationship', event.target.value)}
          />
        </label>
        <label className="dashModal__field dashModal__field--full">
          <span>Contact Number</span>
          <input
            value={editDraft.emergencyContactNumber}
            placeholder="Phone number"
            inputMode="numeric"
            maxLength={11}
            onChange={(event) => onSetField('emergencyContactNumber', formatPhone(event.target.value))}
          />
          {emergencyContactError && <span className="dashModal__helper dashModal__helper--warning">Must be exactly 11 digits.</span>}
        </label>
      </div>

      {emailVerificationWillReset ? (
        <div className="dashModal__helper dashModal__helper--warning">
          Changing this verified personal email will reset its verification status until the new address is verified.
        </div>
      ) : null}
    </LargePopup>
  );
}
