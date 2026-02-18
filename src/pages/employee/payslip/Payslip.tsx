import './Payslip.css';

export default function Payslip() {
  return (
    <div className="pay">
      <div className="pay__head">
        <h1 className="pay__title">Payslips</h1>
        <div className="pay__selectWrap">
          <select className="pay__select" defaultValue="March 30, 2024">
            <option>March 30, 2024</option>
            <option>February 29, 2024</option>
            <option>January 31, 2024</option>
          </select>
        </div>
      </div>

      <section className="payCard">
        <div className="payCard__header">
          <div className="payCard__company">
            <div className="payCard__companyName">Marid Industries Corporation</div>
            <div className="payCard__companyMeta">Address</div>
            <div className="payCard__companyMeta">marid@marid.com</div>
          </div>
          <div className="payCard__title">PAYSLIP</div>
        </div>

        <div className="payCard__rule" />

        <div className="payInfo">
          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Name</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Tax Number</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Designation</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Department</span>
              <span className="payInfo__line" />
            </div>
          </div>

          <div className="payInfo__col">
            <div className="payInfo__row">
              <span>Pay Period</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Start Date</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>End Date</span>
              <span className="payInfo__line" />
            </div>
            <div className="payInfo__row">
              <span>Worked Days</span>
              <span className="payInfo__line" />
            </div>
          </div>
        </div>

        <div className="payTables">
          <div className="payTable">
            <div className="payTable__head">
              <div>Earnings</div>
              <div>Amount</div>
            </div>
            <div className="payTable__row">
              <span>Basic Salary</span>
              <span>PHP 67,000.00</span>
            </div>
            <div className="payTable__row">
              <span>Incentive Pay</span>
              <span>PHP 6,700.00</span>
            </div>
            <div className="payTable__row">
              <span>Other Allowances</span>
              <span>PHP 670.00</span>
            </div>
            <div className="payTable__row">
              <span>&lt;insert more if needed&gt;</span>
              <span />
            </div>
            <div className="payTable__total">
              <span>Total Earnings</span>
              <span>PHP 74,370.00</span>
            </div>
          </div>

          <div className="payTable">
            <div className="payTable__head">
              <div>Deductions</div>
              <div>Amount</div>
            </div>
            <div className="payTable__row">
              <span>SSS</span>
              <span>PHP 670.00</span>
            </div>
            <div className="payTable__row">
              <span>PAGIBIG</span>
              <span>PHP 670.00</span>
            </div>
            <div className="payTable__row">
              <span>PhilHealth</span>
              <span>PHP 670.00</span>
            </div>
            <div className="payTable__row">
              <span>Withholding Tax</span>
              <span>PHP 670.00</span>
            </div>
            <div className="payTable__total">
              <span>Total Deductions</span>
              <span>PHP 2,680.00</span>
            </div>
            <div className="payTable__net">
              <span>Net Pay</span>
              <span>PHP 71,690.00</span>
            </div>
          </div>
        </div>

        <div className="payCard__rule payCard__rule--thin" />

        <div className="paySign">
          <div className="paySign__line">
            <span>Employee Signature over Printed Name</span>
          </div>
          <div className="paySign__line">
            <span>Employer Signature over Printed Name</span>
          </div>
        </div>
      </section>

      <div className="payActions">
        <button className="payBtn" type="button">Download Payslip</button>
        <button className="payBtn" type="button">Print Payslip</button>
        <button className="payBtn" type="button">File Dispute</button>
      </div>
    </div>
  );
}
