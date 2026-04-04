import { FiCopy, FiX } from 'react-icons/fi';
import GroupedSlipSummary from './GroupedSlipSummary';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const copy = {
  eyebrow: 'สรุปโพยดิจิทัล',
  title: 'ตรวจสอบก่อนบันทึกโพย',
  memberLabel: 'สมาชิก',
  actorLabel: 'ผู้ทำรายการ',
  totalAmountLabel: 'ยอดรวม',
  copyImage: 'คัดลอกโพยเป็นรูป',
  copyImageLoading: 'กำลังคัดลอกรูป...',
  closeAriaLabel: 'ปิดหน้าต่าง'
};

const SlipPreviewModal = ({
  slip,
  onClose,
  onCopyImage,
  copyingImage = false,
  actorLabel = '-',
  unknownMember = '-'
}) => {
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
            <h3 className="modal-title">{copy.title}</h3>
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
          </div>
          <div className="operator-preview-meta-row">
            <strong>{copy.actorLabel}:</strong> {slip.placedBy?.name || actorLabel}
          </div>
        </div>

        <div className="operator-preview-summary operator-preview-summary-single">
          <div className="card">
            <div className="ops-table-note operator-preview-stat-label">{copy.totalAmountLabel}</div>
            <strong>{money(slip.totalAmount)} บาท</strong>
          </div>
        </div>

        <div className="operator-preview-list">
          <GroupedSlipSummary slip={slip} dense showMemo className="operator-preview-grouped-summary slip-grouped-compact" />
        </div>
      </div>
    </div>
  );
};

export default SlipPreviewModal;
