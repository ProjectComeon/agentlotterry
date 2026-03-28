import { Link } from 'react-router-dom';
import { FiActivity, FiArrowRight, FiClock, FiLayers, FiTrendingUp } from 'react-icons/fi';
import { useCatalog } from '../../context/CatalogContext';

const statusLabels = {
  open: 'เปิดรับ',
  upcoming: 'กำลังจะเปิด',
  closed: 'ปิดรับ รอผล',
  resulted: 'ประกาศผลแล้ว',
  missing: 'ยังไม่มีงวด'
};

const formatCountdown = (seconds) => {
  if (seconds === null || seconds === undefined) return '-';
  if (seconds <= 0) return '00:00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs].map((value) => String(value).padStart(2, '0')).join(':');
};

const betTypeLabels = {
  '3top': '3 ตัวบน',
  '3tod': '3 ตัวโต๊ด',
  '2top': '2 ตัวบน',
  '2bottom': '2 ตัวล่าง',
  'run_top': 'วิ่งบน',
  'run_bottom': 'วิ่งล่าง'
};

const CustomerOverview = () => {
  const {
    leagues,
    announcements,
    selectedLottery,
    selectedRound,
    selectedRateProfile,
    markAnnouncementRead,
    setSelectedLottery,
    setSelectedRateProfile,
    loading
  } = useCatalog();

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div><span>กำลังโหลดตลาดหวย...</span></div>;
  }

  const lotteryCount = leagues.reduce((sum, league) => sum + league.lotteries.length, 0);
  const openCount = leagues.reduce(
    (sum, league) => sum + league.lotteries.filter((lottery) => lottery.status === 'open').length,
    0
  );

  return (
    <div className="animate-fade-in market-section-stack">
      <div className="page-header">
        <div>
          <h1 className="page-title">ตลาดหวยแบบใหม่</h1>
          <p className="page-subtitle">เลือกตลาด เลือกงวด เลือกเรท และเข้าสู่ betting console แบบ slip-based ใหม่</p>
        </div>
        <Link to="/customer/bet" className="btn btn-secondary">
          เปิด betting console <FiArrowRight />
        </Link>
      </div>

      <section className="market-overview-hero">
        <div className="market-overview-copy">
          <div className="market-provider-pill"><FiLayers /> Phase 1 Catalog Foundation</div>
          <h2>{selectedLottery?.name || 'ยังไม่มีตลาดหวยให้เลือก'}</h2>
          <p>
            {selectedLottery?.description || 'ตลาดหวยจะถูกจัดกลุ่มตามประเภท พร้อมงวดเปิดรับ เรท และการเชื่อมไปหา member slip flow แบบใหม่'}
          </p>

          <div className="market-hero-meta">
            <span><FiActivity /> ตลาดทั้งหมด {lotteryCount} รายการ</span>
            <span><FiTrendingUp /> เปิดรับตอนนี้ {openCount} รายการ</span>
            <span><FiClock /> นับถอยหลัง {formatCountdown(selectedLottery?.countdownSeconds)}</span>
          </div>
        </div>

        <div className="overview-stat-grid">
          <div className="overview-stat-card">
            <div className="overview-stat-icon"><FiClock /></div>
            <div className="overview-stat-value">{selectedRound?.displayDate || '-'}</div>
            <div className="overview-stat-label">งวดที่กำลังใช้งาน</div>
          </div>
          <div className="overview-stat-card">
            <div className="overview-stat-icon"><FiLayers /></div>
            <div className="overview-stat-value">{statusLabels[selectedLottery?.status] || '-'}</div>
            <div className="overview-stat-label">สถานะตลาด</div>
          </div>
          <div className="overview-stat-card">
            <div className="overview-stat-icon"><FiTrendingUp /></div>
            <div className="overview-stat-value">{selectedRateProfile?.name || '-'}</div>
            <div className="overview-stat-label">ชุดอัตราจ่ายที่เลือก</div>
          </div>
          <div className="overview-stat-card">
            <div className="overview-stat-icon"><FiActivity /></div>
            <div className="overview-stat-value">{selectedLottery?.provider || '-'}</div>
            <div className="overview-stat-label">ผู้ให้ข้อมูล</div>
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">ประกาศล่าสุด</h3>
          </div>
          <div className="warning-list">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="warning-item">
                <div className="warning-headline">
                  <strong>{announcement.title}</strong>
                  {!announcement.isRead && (
                    <button
                      type="button"
                      className="warning-action"
                      onClick={() => markAnnouncementRead(announcement.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
                <div>{announcement.body}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedLottery && (
        <section className="card">
          <div className="card-header">
            <h3 className="card-title">งวดและเรทของตลาดที่เลือก</h3>
          </div>

          <div className="market-hero-meta mb-md">
            <span>งวด: {selectedRound?.title || '-'}</span>
            <span>ปิดรับ: {selectedRound?.displayCloseAt || '-'}</span>
            <span>ออกรางวัล: {selectedRound?.displayDrawAt || '-'}</span>
          </div>

          <div className="catalog-rate-chips mb-md">
            {selectedLottery.rateProfiles.map((profile) => (
              <button
                key={profile.id}
                className={`catalog-chip ${selectedRateProfile?.id === profile.id ? 'catalog-chip-active' : ''}`}
                onClick={() => setSelectedRateProfile(profile.id)}
              >
                {profile.name}
              </button>
            ))}
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชนิดเดิมพัน</th>
                  <th>อัตราจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {selectedLottery.supportedBetTypes.map((betType) => (
                  <tr key={betType}>
                    <td>{betTypeLabels[betType]}</td>
                    <td>x{selectedRateProfile?.rates?.[betType] || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {leagues.map((league) => (
        <section key={league.id}>
          <div className="market-section-heading">{league.name}</div>
          <div className="market-grid">
            {league.lotteries.map((lottery) => {
              const latestResult = lottery.latestResult;
              return (
                <button
                  key={lottery.id}
                  type="button"
                  className={`market-card market-card-button market-card-${lottery.status === 'open' ? 'live' : lottery.status === 'upcoming' ? 'pending' : lottery.status === 'closed' ? 'waiting' : 'unsupported'} ${selectedLottery?.id === lottery.id ? 'market-card-active' : ''}`}
                  onClick={() => setSelectedLottery(lottery.id)}
                >
                  <div className="market-card-header">
                    <div>
                      <div className="market-card-title">{lottery.name}</div>
                      <div className="market-card-date">{lottery.activeRound?.title || 'ยังไม่มีงวด'}</div>
                    </div>
                    <span className={`badge badge-${lottery.status === 'open' ? 'success' : lottery.status === 'upcoming' ? 'warning' : lottery.status === 'closed' ? 'info' : 'danger'}`}>
                      {statusLabels[lottery.status] || lottery.status}
                    </span>
                  </div>

                  <div className="market-card-headline">
                    {latestResult?.headline || lottery.activeRound?.displayDate || 'รอข้อมูล'}
                  </div>

                  <div className="market-chip-list">
                    <div className="market-chip">
                      <span className="market-chip-label">ปิดรับ</span>
                      <strong>{lottery.activeRound?.displayCloseAt || '-'}</strong>
                    </div>
                    <div className="market-chip">
                      <span className="market-chip-label">นับถอยหลัง</span>
                      <strong>{formatCountdown(lottery.countdownSeconds)}</strong>
                    </div>
                    <div className="market-chip">
                      <span className="market-chip-label">เรทเริ่มต้น</span>
                      <strong>{lottery.rateProfiles?.[0]?.name || '-'}</strong>
                    </div>
                    <div className="market-chip">
                      <span className="market-chip-label">ผลล่าสุด</span>
                      <strong>{latestResult?.twoBottom || latestResult?.threeTop || '-'}</strong>
                    </div>
                  </div>

                  <div className="market-card-footer">
                    <div className="market-card-note">
                      รองรับ {lottery.supportedBetTypes.length} ประเภทเดิมพัน
                    </div>
                    <div className="market-card-provider">{lottery.provider}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <style>{`
        .catalog-rate-chips {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .catalog-chip {
          padding: 8px 14px;
          border-radius: 999px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 700;
          transition: var(--transition-fast);
        }

        .catalog-chip:hover {
          border-color: var(--border-accent);
          color: var(--text-primary);
        }

        .catalog-chip-active {
          background: var(--primary-subtle);
          border-color: var(--border-accent);
          color: var(--primary-light);
          box-shadow: var(--shadow-glow);
        }

        .warning-headline {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .warning-action {
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
};

export default CustomerOverview;
