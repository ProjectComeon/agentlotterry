import { FiRepeat } from 'react-icons/fi';
import { getWalletDirectionLabel, getWalletEntryTypeLabel, getWalletReasonLabel } from '../../i18n/th/labels';
import { agentCopy } from '../../i18n/th/agent';
import { formatDateTime, formatMoney as money } from '../../utils/formatters';
import { SectionSkeleton } from '../../components/PageSkeleton';

const AgentMemberWalletSection = ({
  walletLoading,
  agentWallet,
  memberWallet,
  walletEntries,
  transferForm,
  setTransferForm,
  submitTransfer,
  walletSubmitting
}) => {
  if (walletLoading) {
    return <SectionSkeleton rows={5} />;
  }

  return (
    <>
      <section className="detail-summary-grid">
        <article className="detail-summary-card">
          <span>ยอดเจ้ามือ</span>
          <strong>{money(agentWallet?.account?.creditBalance)}</strong>
          <small>กระเป๋าเจ้ามือ</small>
        </article>
        <article className="detail-summary-card">
          <span>ยอดสมาชิก</span>
          <strong>{money(memberWallet?.account?.creditBalance)}</strong>
          <small>กระเป๋าสมาชิก</small>
        </article>
        <article className="detail-summary-card">
          <span>เครดิตเข้า</span>
          <strong>{money(memberWallet?.totals?.totalCreditIn)}</strong>
          <small>ยอดรับเครดิตสะสม</small>
        </article>
        <article className="detail-summary-card">
          <span>รายการในสมุดเครดิต</span>
          <strong>{money(memberWallet?.totals?.transactionCount)}</strong>
          <small>จำนวนแถวประวัติ</small>
        </article>
      </section>

      <section className="wallet-grid">
        <section className="card detail-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">จัดการเครดิต</div>
              <h3 className="card-title">โอนเครดิต</h3>
            </div>
          </div>
          <form className="detail-stack" onSubmit={submitTransfer}>
            <div className="detail-grid">
              <label>
                <span>ทิศทาง</span>
                <select
                  value={transferForm.direction}
                  onChange={(event) => setTransferForm((current) => ({ ...current, direction: event.target.value }))}
                >
                  <option value="to_member">จากเจ้ามือไปสมาชิก</option>
                  <option value="from_member">จากสมาชิกไปเจ้ามือ</option>
                </select>
              </label>
              <label>
                <span>จำนวนเครดิต</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={transferForm.amount}
                  onChange={(event) => setTransferForm((current) => ({ ...current, amount: event.target.value }))}
                />
              </label>
              <label className="full">
                <span>หมายเหตุ</span>
                <textarea
                  rows="4"
                  value={transferForm.note}
                  onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))}
                  placeholder={agentCopy.memberDetail.walletNotePlaceholder}
                />
              </label>
            </div>
            <div className="inline-actions">
              <button className="btn btn-primary" type="submit" disabled={walletSubmitting}>
                <FiRepeat />
                {walletSubmitting ? 'กำลังโอน...' : 'ยืนยันโอนเครดิต'}
              </button>
            </div>
          </form>
        </section>

        <section className="card detail-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">ประวัติสมุดเครดิต</div>
              <h3 className="card-title">ความเคลื่อนไหวล่าสุด</h3>
            </div>
          </div>
          {walletEntries.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-text">{agentCopy.memberDetail.noWalletActivity}</div>
            </div>
          ) : (
            <div className="detail-stack">
              {walletEntries.map((entry) => (
                <article key={entry.id} className={`wallet-row wallet-${entry.direction}`}>
                  <div className="wallet-main">
                    <div className="wallet-topline">
                      <strong>{getWalletEntryTypeLabel(entry.entryType)}</strong>
                      <span className={`wallet-direction-pill wallet-direction-${entry.direction}`}>
                        {getWalletDirectionLabel(entry.direction)}
                      </span>
                    </div>
                    <div className="wallet-meta">
                      {entry.counterparty?.name || entry.performedBy?.name || agentCopy.memberDetail.systemActor}
                      {' • '}
                      {getWalletReasonLabel(entry.reasonCode)}
                      {' • '}
                      คงเหลือ {money(entry.balanceAfter)}
                    </div>
                    {entry.note ? <div className="wallet-note-text">{entry.note}</div> : null}
                  </div>
                  <div className="wallet-right">
                    <strong className={entry.direction === 'credit' ? 'wallet-credit-text' : 'wallet-debit-text'}>
                      {entry.direction === 'credit' ? '+' : '-'}
                      {money(entry.amount)}
                    </strong>
                    <span>{formatDateTime(entry.createdAt, { fallback: agentCopy.memberDetail.noRecentActivity })}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </>
  );
};

export default AgentMemberWalletSection;
