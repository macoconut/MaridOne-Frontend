import LargePopup from '../../../../components/dialog/LargePopup';

type EditDraft = {
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

type EditInfoModalProps = {
  editDraft: EditDraft;
  emailVerificationWillReset: boolean;
  savingEdit: boolean;
  onClose: () => void;
  onSetField: <K extends keyof EditDraft>(key: K, value: EditDraft[K]) => void;
  onSubmit: () => void;
};

export default function EditInfoModal({
  editDraft,
  emailVerificationWillReset,
  savingEdit,
  onClose,
  onSetField,
  onSubmit,
}: EditInfoModalProps) {
  return (
    <LargePopup
      open
      ariaLabel="Edit employee info"
      title="Edit Info"
      subtitle="Update your contact details and address information before saving the changes."
      size="xl"
      onClose={onClose}
      closeDisabled={savingEdit}
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={savingEdit}>
            Cancel
          </button>
          <button type="button" className="btn" onClick={onSubmit} disabled={savingEdit}>
            {savingEdit ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <div className="dashModal__grid">
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
            onChange={(event) => onSetField('phoneNumber', event.target.value)}
          />
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

        <div className="dashModal__sectionHeader">Government Identifiers</div>
        <label className="dashModal__field">
          <span>SSS Number</span>
          <input value={editDraft.sssNumber} placeholder="00-0000000-0" onChange={(event) => onSetField('sssNumber', event.target.value)} />
        </label>
        <label className="dashModal__field">
          <span>PhilHealth ID</span>
          <input
            value={editDraft.philhealthNumber}
            placeholder="00-000000000-0"
            onChange={(event) => onSetField('philhealthNumber', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>Pag-IBIG MID</span>
          <input
            value={editDraft.pagibigNumber}
            placeholder="0000-0000-0000"
            onChange={(event) => onSetField('pagibigNumber', event.target.value)}
          />
        </label>
        <label className="dashModal__field">
          <span>TIN</span>
          <input value={editDraft.tinNumber} placeholder="000-000-000-000" onChange={(event) => onSetField('tinNumber', event.target.value)} />
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
            onChange={(event) => onSetField('emergencyContactNumber', event.target.value)}
          />
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
