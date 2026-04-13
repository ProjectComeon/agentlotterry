const LEGACY_MARKET_CODE_MAP = {
  'thai-government': 'thai_government',
  baac: 'baac',
  gsb: 'gsb',
  'gsb-1year-100': 'gsb',
  'hanoi-special': 'hanoi_special',
  'lao-vip': 'lao_vip',
  'dowjones-vip': 'dowjones_vip',
  'stock-nikkei-morning': 'nikkei_morning',
  'stock-china-afternoon': 'china_afternoon'
};

const normalizeLotteryCode = (value) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return LEGACY_MARKET_CODE_MAP[normalized] || normalized.replace(/-/g, '_');
};

module.exports = {
  LEGACY_MARKET_CODE_MAP,
  normalizeLotteryCode
};
