const Bet = require('../models/Bet');
const LotteryResult = require('../models/LotteryResult');

/**
 * อัตราจ่ายมาตรฐาน
 */
const PAY_RATES = {
  '3top': 500,
  '3tod': 100,
  '2top': 70,
  '2bottom': 70,
  'run_top': 3,
  'run_bottom': 2
};

/**
 * สร้าง permutation ของเลข 3 หลัก (สำหรับโต๊ด)
 */
const getPermutations = (str) => {
  if (str.length <= 1) return [str];
  const perms = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const remaining = str.slice(0, i) + str.slice(i + 1);
    for (const perm of getPermutations(remaining)) {
      perms.push(char + perm);
    }
  }
  return [...new Set(perms)];
};

/**
 * ตรวจว่า bet ถูกรางวัลหรือไม่
 */
const checkBetResult = (bet, lotteryResult) => {
  const number = bet.number;
  
  switch (bet.betType) {
    case '3top': {
      // 3 ตัวบน - ต้องตรงกับ 3 ตัวท้ายของรางวัลที่ 1
      const threeTop = lotteryResult.firstPrize.slice(-3);
      return number === threeTop;
    }
    case '3tod': {
      // 3 ตัวโต๊ด - permutation ของ 3 ตัวท้ายรางวัลที่ 1
      const threeTop = lotteryResult.firstPrize.slice(-3);
      const perms = getPermutations(threeTop);
      return perms.includes(number);
    }
    case '2top': {
      // 2 ตัวบน - ตรงกับ 2 ตัวท้ายของรางวัลที่ 1
      const twoTop = lotteryResult.firstPrize.slice(-2);
      return number === twoTop;
    }
    case '2bottom': {
      // 2 ตัวล่าง
      return number === lotteryResult.twoBottom;
    }
    case 'run_top': {
      // วิ่งบน - ตัวเลขตรงกับหลักใดหลักหนึ่งของ 3 ตัวท้ายรางวัลที่ 1
      const threeTop = lotteryResult.firstPrize.slice(-3);
      return threeTop.includes(number);
    }
    case 'run_bottom': {
      // วิ่งล่าง - ตัวเลขตรงกับหลักใดหลักหนึ่งของ 2 ตัวล่าง
      return lotteryResult.twoBottom.includes(number);
    }
    default:
      return false;
  }
};

/**
 * คำนวณผลทั้งหมดสำหรับงวดที่ระบุ
 */
const calculateResults = async (roundDate) => {
  const lotteryResult = await LotteryResult.findOne({ roundDate });
  
  if (!lotteryResult) {
    throw new Error('Lottery result not found for this round');
  }

  if (!lotteryResult.firstPrize) {
    throw new Error('Lottery result is incomplete');
  }

  // Get all pending bets for this round
  const bets = await Bet.find({ roundDate, result: 'pending' });
  
  let totalWon = 0;
  let totalLost = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const bet of bets) {
    const isWon = checkBetResult(bet, lotteryResult);
    
    bet.result = isWon ? 'won' : 'lost';
    bet.wonAmount = isWon ? bet.amount * bet.payRate : 0;
    bet.isLocked = true;
    
    await bet.save();

    if (isWon) {
      totalWon += bet.wonAmount;
      wonCount++;
    } else {
      totalLost += bet.amount;
      lostCount++;
    }
  }

  // Mark lottery result as calculated
  lotteryResult.isCalculated = true;
  await lotteryResult.save();

  return {
    roundDate,
    totalBets: bets.length,
    wonCount,
    lostCount,
    totalWon,
    totalLost,
    netProfit: totalLost - totalWon
  };
};

module.exports = { PAY_RATES, checkBetResult, calculateResults, getPermutations };
