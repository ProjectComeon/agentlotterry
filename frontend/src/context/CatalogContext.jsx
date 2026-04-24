import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
const shouldLoadCatalogForUser = (user) => Boolean(user && user.role !== 'admin');
const defaultCatalogLoadState = {
  includeAnnouncements: false,
  includeRecentResults: false
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

const normalizeLoadOptions = (options = {}) => {
  const includeAnnouncements = Boolean(options.includeAnnouncements);
  const includeRecentResults = Boolean(options.includeRecentResults);
  const variant = options.variant || (!includeAnnouncements && !includeRecentResults ? 'betting' : 'full');

  return {
    force: Boolean(options.force),
    variant,
    includeAnnouncements,
    includeRecentResults
  };
};

const buildLoadRequestKey = (options = {}) => JSON.stringify({
  variant: options.variant || 'full',
  includeAnnouncements: Boolean(options.includeAnnouncements),
  includeRecentResults: Boolean(options.includeRecentResults)
});

const canReuseLoadedOverview = (overview, loadState, options) => Boolean(
  overview &&
  (!options.includeAnnouncements || loadState.includeAnnouncements) &&
  (!options.includeRecentResults || loadState.includeRecentResults)
);

export const CatalogProvider = ({ children }) => {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState(emptySelection);
  const overviewRef = useRef(null);
  const loadStateRef = useRef(defaultCatalogLoadState);
  const loadPromisesRef = useRef(new Map());

  useEffect(() => {
    overviewRef.current = overview;
  }, [overview]);

  const loadOverview = useCallback(async (requestOptions = {}) => {
    if (!shouldLoadCatalogForUser(user)) {
      setOverview(null);
      setSelection(emptySelection);
      overviewRef.current = null;
      loadStateRef.current = defaultCatalogLoadState;
      loadPromisesRef.current.clear();
      return null;
    }

    const options = normalizeLoadOptions(requestOptions);
    const requestKey = buildLoadRequestKey(options);
    const hasBaseOverview = Boolean(overviewRef.current);

    if (!options.force && canReuseLoadedOverview(overviewRef.current, loadStateRef.current, options)) {
      return overviewRef.current;
    }

    if (!options.force && loadPromisesRef.current.has(requestKey)) {
      return loadPromisesRef.current.get(requestKey);
    }

    if (!hasBaseOverview) {
      setLoading(true);
    }
    const request = (async () => {
      try {
        const res = await getCatalogOverview({
          force: options.force,
          variant: options.variant,
          includeAnnouncements: options.includeAnnouncements,
          includeRecentResults: options.includeRecentResults
        });
        const payload = normalizeOverviewPayload(res.data);
        const currentOverview = overviewRef.current;
        const nextOverview = currentOverview
          ? {
              ...payload,
              announcements: options.includeAnnouncements ? payload.announcements : (currentOverview.announcements || []),
              recentResults: options.includeRecentResults ? payload.recentResults : (currentOverview.recentResults || [])
            }
          : payload;
        setOverview(nextOverview);
        overviewRef.current = nextOverview;
        loadStateRef.current = {
          includeAnnouncements: loadStateRef.current.includeAnnouncements || options.includeAnnouncements,
          includeRecentResults: loadStateRef.current.includeRecentResults || options.includeRecentResults
        };

        const stored = readStoredSelection();
        const flatLotteries = nextOverview.leagues.flatMap((league) =>
          (league.lotteries || []).map((lottery) => ({ ...lottery, leagueId: league.id }))
        );
        const fallback = nextOverview.selectionDefaults || {};
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
        return nextOverview;
      } catch (error) {
        console.error('Catalog load error:', error);
        if (overviewRef.current) {
          return overviewRef.current;
        }
        const emptyOverview = normalizeOverviewPayload(null);
        setOverview(emptyOverview);
        overviewRef.current = emptyOverview;
        setSelection(emptySelection);
        return emptyOverview;
      } finally {
        if (!hasBaseOverview) {
          setLoading(false);
        }
        loadPromisesRef.current.delete(requestKey);
      }
    })();

    loadPromisesRef.current.set(requestKey, request);
    return request;
  }, [user]);

  useEffect(() => {
    if (shouldLoadCatalogForUser(user)) return;
    setOverview(null);
    setSelection(emptySelection);
    overviewRef.current = null;
    loadStateRef.current = defaultCatalogLoadState;
    loadPromisesRef.current.clear();
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

      const nextOverview = {
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
      overviewRef.current = nextOverview;
      loadStateRef.current = {
        ...loadStateRef.current,
        includeAnnouncements: true
      };
      return nextOverview;
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
      catalogLoaded: Boolean(overview),
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
      ensureCatalogLoaded: loadOverview,
      refreshCatalog: () => loadOverview({
        force: true,
        includeAnnouncements: loadStateRef.current.includeAnnouncements,
        includeRecentResults: loadStateRef.current.includeRecentResults
      }),
      markAnnouncementRead
    }}>
      {children}
    </CatalogContext.Provider>
  );
};

export const useCatalog = () => useContext(CatalogContext);
