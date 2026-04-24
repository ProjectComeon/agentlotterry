import { FiCheckCircle, FiExternalLink, FiRotateCcw, FiSlash } from 'react-icons/fi';

const LotteryDetailPanel = ({
  selectedCard,
  isAdmin,
  ui,
  bettingUi,
  selectedStatusIcon: SelectedStatusIcon,
  detailDisplayDate,
  detailResolvedDate,
  activeRound,
  activeRoundStatusMeta,
  activeRoundStatusIcon: ActiveRoundStatusIcon,
  bettingToggleUnavailableReason,
  activeRoundOverrideLabel,
  bettingToggleChecked,
  bettingOverrideBusy,
  onBettingToggle,
  timingDraft,
  onTimingDraftChange,
  timingBusy,
  timingDraftChanged,
  onTimingSave,
  activeRoundId,
  activeRoundBettingOverride,
  onBettingReset,
  selectedResult,
  selectedResultItems,
  selectedResultSourceLabel,
  selectedResultUpdatedAt,
  settlementRoundId,
  settlementUnavailableReason,
  settlementBusy,
  onSettlementAction,
  settlementFeedback,
  selectedHistoryItems
}) => (
  <aside className="card lottery-detail-card">
    {selectedCard ? (
      <>
        <div className="detail-top">
          <div className="detail-market-meta">
            <span className="section-eyebrow">{ui.latestDetailTitle}</span>
            <h2>{selectedCard.name}</h2>
            <div className="detail-market-date">{detailDisplayDate}</div>
            <p>
              {detailResolvedDate}
              {' · '}
            </p>
          </div>

          <span className={`detail-status-pill ${selectedCard.statusClass}`}>
            <SelectedStatusIcon />
            {selectedCard.statusLabel}
          </span>
        </div>

        {isAdmin ? (
          <section className="round-toggle-panel">
            <div className="settlement-head">
              <div>
                <div className="history-title">{bettingUi.title}</div>
                <p className="settlement-note">{bettingUi.help}</p>
              </div>
              {activeRound ? (
                <span className={`detail-status-pill ${activeRoundStatusMeta.cardClass}`}>
                  <ActiveRoundStatusIcon />
                  {activeRoundStatusMeta.label}
                </span>
              ) : null}
            </div>

            {bettingToggleUnavailableReason ? (
              <div className="detail-empty compact">{bettingToggleUnavailableReason}</div>
            ) : (
              <>
                <div className="round-toggle-body">
                  <div className="round-toggle-copy">
                    <strong>{activeRoundOverrideLabel}</strong>
                    <span>{activeRound?.title || activeRound?.code || ui.noRound}</span>
                  </div>

                  <label className={`round-toggle-switch ${bettingToggleChecked ? 'is-checked' : ''} ${bettingOverrideBusy ? 'is-disabled' : ''}`}>
                    <input
                      type="checkbox"
                      checked={bettingToggleChecked}
                      onChange={onBettingToggle}
                      disabled={Boolean(bettingOverrideBusy)}
                    />
                    <span className="round-toggle-track">
                      <span className="round-toggle-thumb" />
                    </span>
                    <span className="round-toggle-text">
                      {bettingOverrideBusy && bettingOverrideBusy !== 'auto'
                        ? bettingUi.busy
                        : (bettingToggleChecked ? bettingUi.open : bettingUi.closed)}
                    </span>
                  </label>
                </div>

                <div className="round-timing-form">
                  <div className="round-timing-head">
                    <div>
                      <strong>{bettingUi.timingTitle}</strong>
                      <span>{bettingUi.timingHelp}</span>
                    </div>
                    {activeRound?.isManualTiming ? (
                      <span className="round-toggle-pill is-compact">{bettingUi.manualTiming}</span>
                    ) : null}
                  </div>

                  <div className="round-timing-grid">
                    <label>
                      <span>{bettingUi.openAtLabel}</span>
                      <input
                        type="datetime-local"
                        value={timingDraft.openAt}
                        onChange={(event) => onTimingDraftChange('openAt', event.target.value)}
                        disabled={timingBusy}
                      />
                    </label>
                    <label>
                      <span>{bettingUi.closeAtLabel}</span>
                      <input
                        type="datetime-local"
                        value={timingDraft.closeAt}
                        onChange={(event) => onTimingDraftChange('closeAt', event.target.value)}
                        disabled={timingBusy}
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    className="button button-primary round-timing-save"
                    onClick={onTimingSave}
                    disabled={timingBusy || !timingDraftChanged}
                  >
                    {timingBusy ? bettingUi.savingTiming : bettingUi.saveTiming}
                  </button>
                </div>
              </>
            )}

            {activeRoundId ? (
              <div className="round-toggle-footer">
                <span className="round-toggle-pill">{activeRound?.code || activeRound?.title || '-'}</span>
                <button
                  type="button"
                  className="button button-secondary round-toggle-reset"
                  onClick={onBettingReset}
                  disabled={Boolean(bettingOverrideBusy) || activeRoundBettingOverride === 'auto' || Boolean(bettingToggleUnavailableReason)}
                >
                  {bettingOverrideBusy === 'auto' ? bettingUi.busy : bettingUi.reset}
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="detail-result-hero">
          <div className="detail-result-label">{ui.latestResult}</div>
          <div className="detail-result-headline">{selectedResult?.headline || '-'}</div>
          <div className="detail-result-meta">
            <span>{ui.source}: {selectedResultSourceLabel}</span>
            <span>{ui.updatedAt}: {selectedResultUpdatedAt}</span>
          </div>
        </section>

        {selectedResult ? (
          <div className="detail-result-grid">
            {selectedResultItems.map((item) => (
              <article key={`${item.label}-${item.value}`} className="detail-result-item">
                <span>{item.label}</span>
                <strong>{item.value || '-'}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="detail-empty">{ui.noResult}</div>
        )}

        {selectedCard?.apiMarket?.provider ? (
          <div className="detail-provider-note">
            {ui.source}: {selectedCard.apiMarket.provider}
          </div>
        ) : null}

        {selectedResult?.sourceUrl ? (
          <a
            className="detail-link"
            href={selectedResult.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <FiExternalLink />
            {ui.apiLink}
          </a>
        ) : null}

        {isAdmin ? (
          <section className="settlement-panel">
            <div className="settlement-head">
              <div>
                <div className="history-title">{ui.settlementTitle}</div>
                <p className="settlement-note">{ui.settlementHelp}</p>
              </div>
              {settlementRoundId ? (
                <span className="settlement-round-pill">{selectedResult?.roundCode || selectedCard.activeRound?.code || selectedCard.activeRound?.title || '-'}</span>
              ) : null}
            </div>

            {settlementUnavailableReason ? (
              <div className="detail-empty compact">{settlementUnavailableReason}</div>
            ) : (
              <div className="settlement-actions">
                <button
                  type="button"
                  className="button button-secondary settlement-button"
                  onClick={() => onSettlementAction('reconcile')}
                  disabled={Boolean(settlementBusy)}
                >
                  <FiCheckCircle />
                  {settlementBusy === 'reconcile' ? ui.settlementBusy : ui.settlementReconcile}
                </button>
                <button
                  type="button"
                  className="button button-secondary settlement-button is-warning"
                  onClick={() => onSettlementAction('reverse')}
                  disabled={Boolean(settlementBusy)}
                >
                  <FiSlash />
                  {settlementBusy === 'reverse' ? ui.settlementBusy : ui.settlementReverse}
                </button>
                <button
                  type="button"
                  className="button button-secondary settlement-button is-accent"
                  onClick={() => onSettlementAction('rerun')}
                  disabled={Boolean(settlementBusy)}
                >
                  <FiRotateCcw />
                  {settlementBusy === 'rerun' ? ui.settlementBusy : ui.settlementRerun}
                </button>
              </div>
            )}

            {settlementFeedback ? (
              <article className={`settlement-feedback ${settlementFeedback.className || ''}`}>
                <strong>{settlementFeedback.title}</strong>
                <div className="settlement-feedback-lines">
                  {settlementFeedback.lines.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </div>
              </article>
            ) : (
              <div className="settlement-empty">{ui.settlementFeedbackEmpty}</div>
            )}
          </section>
        ) : null}

        <div className="history-head">
          <div className="history-title">{ui.recentHistoryTitle}</div>
          <div className="history-count">{selectedHistoryItems.length} งวด</div>
        </div>

        {selectedHistoryItems.length ? (
          <div className="history-list">
            {selectedHistoryItems.map((result) => (
              <article key={result.id} className="history-item">
                <div>
                  <div className="history-round">{result.roundLabel}</div>
                  <div className="history-source">{result.sourceLabel}</div>
                </div>
                <div className="history-headline">{result.headline}</div>
              </article>
            ))}
          </div>
        ) : (
          <div className="detail-empty">{ui.noHistory}</div>
        )}
      </>
    ) : (
      <div className="detail-empty">{ui.noData}</div>
    )}
  </aside>
);

export default LotteryDetailPanel;
