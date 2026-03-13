const axios = require('axios');
const LotteryResult = require('../models/LotteryResult');

/**
 * ดึงผลหวยไทยจาก API
 * ใช้ API: https://lotto.api.advicefree.com หรือ alternative
 */
const fetchLotteryResult = async (roundDate) => {
  try {
    // Try primary API
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
    console.error('Lottery API error:', error.message);
    throw new Error(`Failed to fetch lottery results: ${error.message}`);
  }
};

/**
 * บันทึกผลหวยลง DB
 */
const saveLotteryResult = async (resultData) => {
  const existing = await LotteryResult.findOne({ roundDate: resultData.roundDate });
  
  if (existing) {
    Object.assign(existing, resultData);
    await existing.save();
    return existing;
  }

  return await LotteryResult.create(resultData);
};

/**
 * ดึงผลหวยล่าสุด
 */
const getLatestResult = async () => {
  return await LotteryResult.findOne().sort({ roundDate: -1 });
};

module.exports = { fetchLotteryResult, saveLotteryResult, getLatestResult };
