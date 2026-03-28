const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');
const { settleRoundById, syncLegacyThaiGovernmentResult } = require('./resultService');

const THAI_LOTTO_LATEST_URL = (process.env.THAI_LOTTO_API_URL || 'https://lotto.api.rayriffy.com').replace(/\/$/, '');

const formatRayriffyId = (roundDate) => {
  const [year, month, day] = String(roundDate).split('-').map((value) => Number(value));
  if (!year || !month || !day) {
    throw new Error('Invalid round date format for Rayriffy API');
  }

  return `${String(day).padStart(2, '0')}${String(month).padStart(2, '0')}${year + 543}`;
};

const parseRayriffyResponse = (payload, roundDate) => {
  const response = payload?.response;
  const prizes = Array.isArray(response?.prizes) ? response.prizes : [];
  const runningNumbers = Array.isArray(response?.runningNumbers) ? response.runningNumbers : [];
  const firstPrize = prizes.find((item) => item.id === 'prizeFirst')?.number?.[0] || '';
  const frontThree = runningNumbers.find((item) => item.id === 'runningNumberFrontThree')?.number || [];
  const backThree = runningNumbers.find((item) => item.id === 'runningNumberBackThree')?.number || [];
  const backTwo = runningNumbers.find((item) => item.id === 'runningNumberBackTwo')?.number?.[0] || '';

  if (!firstPrize && !backTwo) {
    throw new Error('Rayriffy API returned incomplete lottery data');
  }

  return {
    roundDate,
    firstPrize,
    threeTopList: frontThree,
    threeBotList: backThree,
    twoBottom: backTwo,
    runTop: firstPrize ? [...new Set(firstPrize.slice(-3).split(''))] : [],
    runBottom: backTwo ? [...new Set(backTwo.split(''))] : [],
    fetchedAt: new Date()
  };
};

/**
 * ดึงผลหวยไทยจาก API
 * ใช้ API: https://lotto.api.advicefree.com หรือ alternative
 */
const fetchLotteryResult = async (roundDate) => {
  try {
    const response = await axios.get(`https://lotto.api.advicefree.com/lotto/date/${roundDate}`, {
      timeout: 10000
    });

    if (response.data && response.data.status === 'success') {
      const data = response.data.response;
      
      const result = {
        roundDate: roundDate,
        firstPrize: '',
        threeTopList: [],
        threeBotList: [],
        twoBottom: '',
        runTop: [],
        runBottom: [],
        fetchedAt: new Date()
      };

      // Parse results from API
      if (data && data.data) {
        for (const item of data.data) {
          switch (item.id) {
            case 'prizefirst':
              result.firstPrize = item.number?.[0] || '';
              break;
            case 'runningnumbersfronttop':
              result.threeTopList = item.number || [];
              break;
            case 'runningnumbersbackbottom':
              result.threeBotList = item.number || [];
              break;
            case 'prizetwobottom':
              result.twoBottom = item.number?.[0] || '';
              break;
            case 'runningnumberstop':
              result.runTop = item.number || [];
              break;
            case 'runningnumbersbottom':
              result.runBottom = item.number || [];
              break;
          }
        }
      }

      // Derive run numbers from first prize if not available
      if (result.firstPrize && result.runTop.length === 0) {
        result.runTop = [result.firstPrize.charAt(result.firstPrize.length - 1)];
      }

      return result;
    }

    throw new Error('API returned no data');
  } catch (error) {
    try {
      const rayriffyId = formatRayriffyId(roundDate);
      const response = await axios.get(`${THAI_LOTTO_LATEST_URL}/lotto/${rayriffyId}`, {
        timeout: 10000
      });

      if (response.data?.status === 'success') {
        return parseRayriffyResponse(response.data, roundDate);
      }

      throw new Error('Rayriffy API returned no data');
    } catch (fallbackError) {
      console.error('Lottery API error:', error.message);
      console.error('Rayriffy fallback error:', fallbackError.message);
      throw new Error(`Failed to fetch lottery results: ${fallbackError.message}`);
    }
  }
};

/**
 * บันทึกผลหวยลง DB
 */
const saveLotteryResult = async (resultData) => {
  const existing = await LotteryResult.findOne({ roundDate: resultData.roundDate });
  let savedResult = null;

  if (existing) {
    Object.assign(existing, resultData);
    savedResult = await existing.save();
  } else {
    savedResult = await LotteryResult.create(resultData);
  }

  const syncedResult = await syncLegacyThaiGovernmentResult(savedResult, resultData.sourceType || 'legacy');
  const settlement = syncedResult ? await settleRoundById(syncedResult.round._id, { force: true }) : null;

  return {
    result: savedResult,
    syncedResult,
    settlement
  };
};

/**
 * ดึงผลหวยล่าสุด
 */
const getLatestResult = async () => {
  return await LotteryResult.findOne().sort({ roundDate: -1 });
};

module.exports = { fetchLotteryResult, saveLotteryResult, getLatestResult };
