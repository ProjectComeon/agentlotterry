import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiClock, FiTrendingUp } from 'react-icons/fi';
import PageSkeleton from '../../components/PageSkeleton';
import { memberCopy } from '../../i18n/th/member';
import { getBetTypeLabel, getProviderLabel, getRoundStatusLabel } from '../../i18n/th/labels';
import { useCatalog } from '../../context/CatalogContext';

const formatCountdown = (seconds) => {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds <= 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
};

const CustomerOverview = () => {
  const copy = memberCopy.overview;
  const {
    leagues,
    announcements,
    catalogLoaded,
    selectedLottery,
    selectedRound,
    selectedRateProfile,
    ensureCatalogLoaded,
    markAnnouncementRead,
    setSelectedLottery,
    setSelectedRateProfile,
    loading
  } = useCatalog();

  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

    const scheduleAnnouncementsLoad = () => {
      if (cancelled) return;

      const loadAnnouncements = () => {
        if (!cancelled) {
          void ensureCatalogLoaded?.({ includeAnnouncements: true });
        }
      };

      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(loadAnnouncements, { timeout: 500 });
      } else if (typeof window !== 'undefined') {
        timeoutId = window.setTimeout(loadAnnouncements, 150);
      } else {
        loadAnnouncements();
      }
    };

    void ensureCatalogLoaded?.().then(() => {
      scheduleAnnouncementsLoad();
    });

    return () => {
      cancelled = true;
      if (idleId !== null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null && typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [ensureCatalogLoaded]);

  if (loading || !catalogLoaded) return <PageSkeleton statCount={4} rows={6} sidebar={false} />;

  const lotteryCount = leagues.reduce((sum, league) => sum + league.lotteries.length, 0);
  const openCount = leagues.reduce((sum, league) => sum + league.lotteries.filter((lottery) => lottery.status === 'open').length, 0);

  return (
    <div className="animate-fade-in customer-market-page">
      <section className="market-hero card">
        <div className="market-hero-copy">
          <span className="section-eyebrow">{copy.heroEyebrow}</span>
          <h1 className="page-title">{copy.heroTitle}</h1>
          <p className="page-subtitle">{copy.heroSubtitle}</p>
          <div className="market-hero-meta">
            <span><FiActivity /> {copy.marketCount(lotteryCount)}</span>
            <span><FiTrendingUp /> {copy.openCount(openCount)}</span>
            <span><FiClock /> {copy.countdown(formatCountdown(selectedLottery?.countdownSeconds))}</span>
          </div>
        </div>
        <Link to="/customer/history" className="btn btn-primary">
          ดูรายการโพย <FiArrowRight />
        </Link>
      </section>

      <section className="card market-panel">
        <div className="bet-note">
          <FiActivity />
          <span>สมาชิกดูตลาด ผลรางวัล และประวัติโพยได้จากหน้านี้ ส่วนการซื้อรายการใหม่ให้เอเย่นต์หรือแอดมินทำรายการแทน</span>
        </div>
      </section>

      <section className="market-stat-grid">
        <article className="market-stat-card">
          <span>{copy.stats.selectedMarket}</span>
          <strong>{selectedLottery?.name || '-'}</strong>
          <small>{getProviderLabel(selectedLottery?.provider, copy.stats.noProviderSelected)}</small>
        </article>
        <article className="market-stat-card">
          <span>{copy.stats.currentRound}</span>
          <strong>{selectedRound?.displayDate || selectedRound?.title || '-'}</strong>
          <small>{selectedRound?.displayCloseAt || copy.stats.noRoundLoaded}</small>
        </article>
        <article className="market-stat-card">
          <span>{copy.stats.rateProfile}</span>
          <strong>{selectedRateProfile?.name || '-'}</strong>
          <small>{copy.stats.supportedBetTypes(selectedLottery?.supportedBetTypes?.length || 0)}</small>
        </article>
        <article className="market-stat-card">
          <span>{copy.stats.status}</span>
          <strong>{getRoundStatusLabel(selectedLottery?.status)}</strong>
          <small>{selectedLottery?.description || copy.stats.selectMarketHint}</small>
        </article>
      </section>

      {announcements.length > 0 ? (
        <section className="card market-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">{copy.announcements.eyebrow}</div>
              <h3 className="card-title">{copy.announcements.title}</h3>
            </div>
          </div>
          <div className="announcement-list">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="announcement-row">
                <div>
                  <strong>{announcement.title}</strong>
                  <div className="announcement-body">{announcement.body}</div>
                </div>
                {!announcement.isRead ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => markAnnouncementRead(announcement.id)}>
                    {copy.announcements.markRead}
                  </button>
                ) : (
                  <span className="read-pill">{copy.announcements.read}</span>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {selectedLottery ? (
        <section className="card market-panel">
          <div className="panel-head">
            <div>
              <div className="panel-eyebrow">{copy.selectedMarket.eyebrow}</div>
              <h3 className="card-title">{selectedLottery.name}</h3>
            </div>
          </div>

          <div className="selected-market-summary">
            <span>{copy.selectedMarket.round} {selectedRound?.title || '-'}</span>
            <span>{copy.selectedMarket.close} {selectedRound?.displayCloseAt || '-'}</span>
            <span>{copy.selectedMarket.draw} {selectedRound?.displayDrawAt || '-'}</span>
          </div>

          <div className="catalog-rate-chips">
            {selectedLottery.rateProfiles.map((profile) => (
              <button key={profile.id} className={`catalog-chip ${selectedRateProfile?.id === profile.id ? 'catalog-chip-active' : ''}`} onClick={() => setSelectedRateProfile(profile.id)}>
                {profile.name}
              </button>
            ))}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{copy.selectedMarket.betType}</th>
                  <th>{copy.selectedMarket.rate}</th>
                </tr>
              </thead>
              <tbody>
                {selectedLottery.supportedBetTypes.map((betType) => (
                  <tr key={betType}>
                    <td>{getBetTypeLabel(betType)}</td>
                    <td>x{selectedRateProfile?.rates?.[betType] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {leagues.map((league) => (
        <section key={league.id} className="league-section">
          <div className="market-section-heading">{league.name}</div>
          <div className="market-grid">
            {league.lotteries.map((lottery) => {
              const latestResult = lottery.latestResult;
              return (
                <button
                  key={lottery.id}
                  type="button"
                  className={`market-card market-card-button market-card-${lottery.status === 'open' ? 'live' : lottery.status === 'upcoming' ? 'pending' : lottery.status === 'closed' ? 'waiting' : 'unsupported'} ${selectedLottery?.id === lottery.id ? 'market-card-active' : ''}`}
                  onClick={() => {
                    setSelectedLottery(lottery.id);
                  }}
                >
                  <div className="market-card-header">
                    <div>
                      <div className="market-card-title">{lottery.name}</div>
                      <div className="market-card-date">{lottery.activeRound?.title || copy.cards.noRound}</div>
                    </div>
                    <span className={`badge badge-${lottery.status === 'open' ? 'success' : lottery.status === 'upcoming' ? 'warning' : lottery.status === 'closed' ? 'info' : 'danger'}`}>
                      {getRoundStatusLabel(lottery.status)}
                    </span>
                  </div>

                  <div className="market-card-headline">
                    {latestResult?.headline || lottery.activeRound?.displayDate || copy.cards.waitingForData}
                  </div>

                  <div className="market-chip-list">
                    <div className="market-chip"><span className="market-chip-label">{copy.cards.close}</span><strong>{lottery.activeRound?.displayCloseAt || '-'}</strong></div>
                    <div className="market-chip"><span className="market-chip-label">{copy.cards.countdown}</span><strong>{formatCountdown(lottery.countdownSeconds)}</strong></div>
                    <div className="market-chip"><span className="market-chip-label">{copy.cards.baseRate}</span><strong>{lottery.rateProfiles?.[0]?.name || '-'}</strong></div>
                    <div className="market-chip"><span className="market-chip-label">{copy.cards.latestResult}</span><strong>{latestResult?.headline || latestResult?.twoBottom || latestResult?.threeTop || copy.cards.noResultYet}</strong></div>
                  </div>

                  <div className="market-card-footer">
                    <div className="market-card-note">{copy.cards.supportedBetTypes(lottery.supportedBetTypes.length)}</div>
                    <div className="market-card-provider">{getProviderLabel(lottery.provider)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <style>{`
        .customer-market-page{display:flex;flex-direction:column;gap:18px;position:relative;isolation:isolate}
        .customer-market-page::before{content:'';position:absolute;inset:-48px 0 auto;height:220px;background:radial-gradient(circle at top left,rgba(16,185,129,.14),transparent 62%);pointer-events:none;z-index:-1}
        .market-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;padding:28px;background:linear-gradient(135deg,rgba(15,23,42,.96),rgba(17,24,39,.9)),radial-gradient(circle at top right,rgba(16,185,129,.12),transparent 38%);border-color:rgba(52,211,153,.18);box-shadow:0 24px 60px rgba(15,23,42,.34)}
        .market-hero-copy{display:flex;flex-direction:column;gap:12px;min-width:0}
        .section-eyebrow,.panel-eyebrow{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--primary-light);font-weight:700}
        .market-hero .page-title{margin:0;font-size:clamp(2rem,4vw,3rem);line-height:.96;letter-spacing:-.04em}
        .market-hero .page-subtitle{margin:0;max-width:56ch}
        .market-hero-meta,.selected-market-summary{display:flex;gap:12px;flex-wrap:wrap}
        .market-hero-meta span,.selected-market-summary span{display:inline-flex;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;background:rgba(9,16,30,.78);border:1px solid rgba(148,163,184,.14);color:var(--text-secondary);font-size:.82rem}
        .market-stat-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .market-stat-card{padding:18px;border-radius:20px;border:1px solid rgba(148,163,184,.14);background:linear-gradient(180deg,rgba(20,30,49,.94),rgba(15,23,42,.9));display:flex;flex-direction:column;gap:8px}
        .market-stat-card span,.market-stat-card small,.announcement-body{color:var(--text-muted)}
        .market-stat-card strong{font-size:1.35rem;line-height:1;letter-spacing:-.04em}
        .market-panel{padding:20px}
        .bet-note{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border-radius:18px;border:1px solid rgba(52,211,153,.18);background:rgba(16,185,129,.08);color:var(--text-secondary);font-size:.9rem;line-height:1.6}
        .bet-note svg{margin-top:2px;color:var(--primary-light);flex-shrink:0}
        .panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
        .panel-head .card-title{margin:6px 0 0;font-size:1.15rem}
        .announcement-list{display:flex;flex-direction:column;gap:12px}
        .announcement-row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:16px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(20,30,49,.94)}
        .read-pill{display:inline-flex;align-items:center;justify-content:center;padding:6px 10px;border-radius:999px;background:rgba(16,185,129,.12);color:#34d399;font-size:.72rem;font-weight:700}
        .catalog-rate-chips{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
        .catalog-chip{padding:8px 14px;border-radius:999px;background:rgba(9,16,30,.76);border:1px solid rgba(148,163,184,.16);color:var(--text-secondary);font-size:.82rem;font-weight:700}
        .catalog-chip-active{background:rgba(16,185,129,.12);border-color:rgba(52,211,153,.2);color:var(--primary-light)}
        .league-section{display:flex;flex-direction:column;gap:12px}
        @media (max-width:1100px){.market-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.market-hero{flex-direction:column;align-items:stretch}}
        @media (max-width:760px){.market-stat-grid{grid-template-columns:1fr}.announcement-row{flex-direction:column;align-items:stretch}}
      `}</style>
    </div>
  );
};

export default CustomerOverview;
