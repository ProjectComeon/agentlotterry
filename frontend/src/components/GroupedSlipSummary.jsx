import { useMemo } from 'react';
import { buildSlipDisplayGroups } from '../utils/slipGrouping';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const ui = {
  items: (count) => `${count} รายการ`,
  baht: 'บาท',
  maxPayout: 'จ่ายสูงสุด',
  memoLabel: 'บันทึกช่วยจำ',
  emptyMemo: 'ไม่มีบันทึกช่วยจำ'
};

const GroupedSlipSummary = ({
  slip,
  dense = false,
  showMemo = false,
  className = ''
}) => {
  const groups = useMemo(
    () => (slip?.displayGroups?.length ? slip.displayGroups : buildSlipDisplayGroups(slip?.items || [])),
    [slip]
  );

  const memoText = String(slip?.memo || '').trim();

  if (!groups.length && !(showMemo && memoText)) {
    return null;
  }

  const classes = ['grouped-slip-summary', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {groups.length ? (
        <div className={`operator-slip-group-list ${dense ? 'operator-slip-group-list-dense' : ''}`}>
          {groups.map((group) => (
            <div
              key={group.key}
              className={`card operator-slip-group-card ${dense ? 'operator-slip-group-card-dense' : ''}`}
            >
              <div className="operator-slip-group-side">
                <div className="operator-slip-family">{group.familyLabel}</div>
                <div className="operator-slip-combo">{group.comboLabel}</div>
                <div className="operator-slip-amount">{group.amountLabel}</div>
              </div>

              <div className="operator-slip-group-body">
                <div className="operator-slip-group-head">
                  <span className="ops-table-note">{ui.items(group.itemCount)}</span>
                  <strong>{money(group.totalAmount)} {ui.baht}</strong>
                </div>

                <div className="operator-slip-numbers">{group.numbersText}</div>
                <div className="ops-table-note">{ui.maxPayout} {money(group.potentialPayout)} {ui.baht}</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showMemo ? (
        <div className="card operator-preview-note grouped-slip-note">
          <div className="ops-table-note grouped-slip-note-label">{ui.memoLabel}</div>
          <strong>{memoText || ui.emptyMemo}</strong>
        </div>
      ) : null}
    </div>
  );
};

export default GroupedSlipSummary;
