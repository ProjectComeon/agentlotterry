const LEGACY_MARKET_CODE_MAP = {
  'thai-government': 'thai_government',
  baac: 'baac',
  gsb: 'gsb',
  'gsb-1year-100': 'gsb',
  lao: 'tlzc',
  'lao-redcross': 'lao_redcross',
  'lao-pathana': 'lao_pathana',
  'lao-tv': 'lao_tv',
  'lao-hd': 'lao_hd',
  'lao-extra': 'lao_extra',
  'lao-star': 'lao_star',
  'lao-stars': 'lao_star',
  'lao-star-vip': 'lao_star_vip',
  'lao-stars-vip': 'lao_star_vip',
  'lao-union': 'lao_union',
  'lao-union-vip': 'lao_union_vip',
  laounionvip: 'lao_union_vip',
  'lao-asean': 'lao_asean',
  laoasean: 'lao_asean',
  'hanoi-extra': 'hanoi_extra',
  hanoiextra: 'hanoi_extra',
  'hanoi-star': 'hanoi_star',
  hanoistar: 'hanoi_star',
  'hanoi-develop': 'hanoi_develop',
  hanoidevelop: 'hanoi_develop',
  'hanoi-hd': 'hanoi_hd',
  hanoihd: 'hanoi_hd',
  'hanoi-tv': 'hanoi_tv',
  hanoitv: 'hanoi_tv',
  'hanoi-redcross': 'hanoi_redcross',
  hanoiredcross: 'hanoi_redcross',
  'hanoi-union': 'hanoi_union',
  hanoiunion: 'hanoi_union',
  'hanoi-asean': 'hanoi_asean',
  hanoiasean: 'hanoi_asean',
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
