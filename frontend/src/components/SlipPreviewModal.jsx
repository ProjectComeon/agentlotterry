import { useMemo } from 'react';
import { FiCopy, FiX } from 'react-icons/fi';
import { operatorBettingCopy } from '../i18n/th/operatorBetting';
import { buildSlipDisplayGroups } from '../utils/slipGrouping';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const SlipPreviewModal = ({
  slip,
  onClose,
  onCopyImage,
  copyingImage = false,
  actorLabel = '-',
  unknownMember = '-'
}) => {
  const groups = useMemo(() => buildSlipDisplayGroups(slip?.items || []), [slip]);
  const copy = operatorBettingCopy.previewModal;

  if (!slip) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal operator-preview-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="ui-eyebrow">{copy.eyebrow}</div>
            <h3 className="modal-title">{copy.titlePrefix} {slip.slipNumber || slip.slipId || '-'}</h3>
          </div>
          <div className="operator-preview-modal-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCopyImage}
              disabled={copyingImage}
            >
              <FiCopy />
              {copyingImage ? copy.copyImageLoading : copy.copyImage}
            </button>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label={copy.closeAriaLabel}
            >
              <FiX />
            </button>
          </div>
        </div>

        <div className="card operator-preview-meta">
          <div>
            <strong>{copy.memberLabel}:</strong> {slip.customer?.name || unknownMember}
            <span className="ops-table-note">
              {slip.customer?.username ? `@${slip.customer.username}` : ''}
            </span>
          </div>
          <div className="operator-preview-meta-row">
            <strong>{copy.actorLabel}:</strong> {slip.placedBy?.name || actorLabel}
            <span className="ops-table-note">{slip.placedBy?.roleLabel || actorLabel}</span>
          </div>
          <div className="operator-preview-meta-row">
            <strong>{copy.marketRoundLabel}:</strong> {slip.marketName || '-'} • {slip.roundLabel || '-'}
          </div>
        </div>

        <div className="operator-preview-summary">
          <div className="card">
            <div className="ops-table-note" style={{ margin: 0 }}>{copy.itemCountLabel}</div>
            <strong>{slip.items?.length || 0}</strong>
          </div>
          <div className="card">
            <div className="ops-table-note" style={{ margin: 0 }}>{copy.totalAmountLabel}</div>
            <strong>{money(slip.totalAmount)} บาท</strong>
          </div>
          <div className="card">
            <div className="ops-table-note" style={{ margin: 0 }}>{copy.maxPayoutLabel}</div>
            <strong>{money(slip.totalPotentialPayout)} บาท</strong>
          </div>
          <div className="card">
            <div className="ops-table-note" style={{ margin: 0 }}>{copy.slipStatusLabel}</div>
            <strong>{slip.resultLabel || '-'}</strong>
          </div>
        </div>

        <div className="operator-preview-list operator-slip-group-list">
          {groups.map((group) => (
            <div key={group.key} className="card operator-slip-group-card operator-slip-group-card-compact">
              <div className="operator-slip-group-side">
                <div className="operator-slip-family">{group.familyLabel}</div>
                <div className="operator-slip-combo">{group.comboLabel}</div>
                <div className="operator-slip-amount">{group.amountLabel}</div>
              </div>
              <div className="operator-slip-group-body">
                <div className="operator-slip-group-head">
                  <span className="ops-table-note">{group.itemCount} รายการ</span>
                  <strong>{money(group.totalAmount)} บาท</strong>
                </div>
                <div className="operator-slip-numbers">{group.numbersText}</div>
                <div className="ops-table-note">จ่ายสูงสุด {money(group.potentialPayout)} บาท</div>
              </div>
            </div>
          ))}
        </div>

        {slip.memo ? (
          <div className="card operator-preview-note">
            <div className="ops-table-note" style={{ margin: 0 }}>{copy.memoLabel}</div>
            <strong>{slip.memo}</strong>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default SlipPreviewModal;
