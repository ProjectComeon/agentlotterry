import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCatalogOverview, markCatalogAnnouncementRead } from '../services/api';
import { useAuth } from './AuthContext';

const CatalogContext = createContext(null);
const STORAGE_KEY = 'catalogSelection';

const readStoredSelection = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
};

const writeStoredSelection = (selection) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
};

const emptySelection = {
  leagueId: null,
  lotteryId: null,
  roundId: null,
  rateProfileId: null
};

const normalizeOverviewPayload = (payload) => ({
  ...(payload || {}),
  leagues: Array.isArray(payload?.leagues)
    ? payload.leagues.map((league) => ({
        ...league,
        lotteries: Array.isArray(league?.lotteries) ? league.lotteries : []
      }))
    : [],
  announcements: Array.isArray(payload?.announcements) ? payload.announcements : [],
  recentResults: Array.isArray(payload?.recentResults) ? payload.recentResults : [],
  selectionDefaults: payload?.selectionDefaults && typeof payload.selectionDefaults === 'object'
    ? payload.selectionDefaults
    : {}
});

export const CatalogProvider = ({ children }) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState(emptySelection);

  const loadOverview = async () => {
    if (!user) {
      setOverview(null);
      setSelection(emptySelection);
      return;
    }

    setLoading(true);
    try {
      const res = await getCatalogOverview();
      const payload = normalizeOverviewPayload(res.data);
      setOverview(payload);

      const stored = readStoredSelection();
      const flatLotteries = payload.leagues.flatMap((league) =>
        (league.lotteries || []).map((lottery) => ({ ...lottery, leagueId: league.id }))
      );
      const fallback = payload.selectionDefaults || {};
      const selectedLottery = flatLotteries.find((lottery) => lottery.id === stored?.lotteryId) ||
        flatLotteries.find((lottery) => lottery.id === fallback.lotteryId) ||
        flatLotteries[0] ||
        null;

      const nextSelection = {
        leagueId: selectedLottery?.leagueId || fallback.leagueId || null,
        lotteryId: selectedLottery?.id || fallback.lotteryId || null,
        roundId: selectedLottery?.activeRound?.id || fallback.roundId || null,
        rateProfileId: selectedLottery?.defaultRateProfileId || selectedLottery?.rateProfiles?.[0]?.id || fallback.rateProfileId || null
      };

      setSelection(nextSelection);
      writeStoredSelection(nextSelection);
    } catch (error) {
      console.error('Catalog load error:', error);
      setOverview(normalizeOverviewPayload(null));
      setSelection(emptySelection);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [user]);

  const flatLotteries = useMemo(
    () => overview?.leagues?.flatMap((league) => league.lotteries.map((lottery) => ({ ...lottery, leagueId: league.id, leagueName: league.name }))) || [],
    [overview]
  );

  const selectedLottery = flatLotteries.find((lottery) => lottery.id === selection.lotteryId) || null;
  const selectedRound = selectedLottery?.activeRound && selectedLottery.activeRound.id === selection.roundId
    ? selectedLottery.activeRound
    : selectedLottery?.activeRound || null;
  const selectedRateProfile = selectedLottery?.rateProfiles?.find((profile) => profile.id === selection.rateProfileId) ||
    selectedLottery?.rateProfiles?.[0] ||
    null;

  const updateSelection = (partial) => {
    const next = { ...selection, ...partial };
    setSelection(next);
    writeStoredSelection(next);
  };

  const markAnnouncementRead = async (announcementId) => {
    if (!announcementId) return;

    await markCatalogAnnouncementRead(announcementId);
    setOverview((current) => {
      if (!current) return current;

      return {
        ...current,
        announcements: (current.announcements || []).map((announcement) =>
          announcement.id === announcementId
            ? {
              ...announcement,
              isRead: true,
              readAt: new Date().toISOString()
            }
            : announcement
        )
      };
    });
  };

  return (
    <CatalogContext.Provider value={{
      overview,
      loading,
      leagues: overview?.leagues || [],
      flatLotteries,
      announcements: overview?.announcements || [],
      recentResults: overview?.recentResults || [],
      selectedLottery,
      selectedRound,
      selectedRateProfile,
      selection,
      setSelectedLottery: (lotteryId) => {
        const lottery = flatLotteries.find((item) => item.id === lotteryId);
        if (!lottery) return;
        updateSelection({
          leagueId: lottery.leagueId,
          lotteryId: lottery.id,
          roundId: lottery.activeRound?.id || null,
          rateProfileId: lottery.defaultRateProfileId || lottery.rateProfiles?.[0]?.id || null
        });
      },
      setSelectedRound: (roundId) => updateSelection({ roundId }),
      setSelectedRateProfile: (rateProfileId) => updateSelection({ rateProfileId }),
      refreshCatalog: loadOverview,
      markAnnouncementRead
    }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => useContext(CatalogContext);
