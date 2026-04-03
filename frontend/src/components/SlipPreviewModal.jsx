import { FiCopy, FiX } from 'react-icons/fi';
import GroupedSlipSummary from './GroupedSlipSummary';
import { operatorBettingCopy } from '../i18n/th/operatorBetting';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const SlipPreviewModal = ({
  slip,
  onClose,
  onCopyImage,
  copyingImage = false,
  actorLabel = '-',
  unknownMember = '-'
}) => {
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
            <h3 className="modal-title">
              {copy.titlePrefix} {slip.slipNumber || slip.slipId || '-'}
            </h3>
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
            {slip.customer?.username ? (
              <span className="ops-table-note"> @{slip.customer.username}</span>
            ) : null}
          </div>
          <div className="operator-preview-meta-row">
            <strong>{copy.actorLabel}:</strong> {slip.placedBy?.name || actorLabel}
            <span className="ops-table-note"> {slip.placedBy?.roleLabel || actorLabel}</span>
          </div>
          <div className="operator-preview-meta-row">
            <strong>{copy.marketRoundLabel}:</strong> {slip.marketName || '-'} • {slip.roundLabel || '-'}
          </div>
        </div>

        <div className="operator-preview-summary">
          <div className="card">
            <div className="ops-table-note operator-preview-stat-label">{copy.itemCountLabel}</div>
            <strong>{slip.items?.length || 0}</strong>
          </div>
          <div className="card">
            <div className="ops-table-note operator-preview-stat-label">{copy.totalAmountLabel}</div>
            <strong>{money(slip.totalAmount)} บาท</strong>
          </div>
          <div className="card">
            <div className="ops-table-note operator-preview-stat-label">{copy.maxPayoutLabel}</div>
            <strong>{money(slip.totalPotentialPayout)} บาท</strong>
          </div>
          <div className="card">
            <div className="ops-table-note operator-preview-stat-label">{copy.slipStatusLabel}</div>
            <strong>{slip.resultLabel || '-'}</strong>
          </div>
        </div>

        <div className="operator-preview-list">
          <GroupedSlipSummary slip={slip} dense showMemo className="operator-preview-grouped-summary" />
        </div>
      </div>
    </div>
  );
};

export default SlipPreviewModal;
