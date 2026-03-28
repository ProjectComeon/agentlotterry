const BANGKOK_OFFSET_MINUTES = 7 * 60;

const shiftToBangkok = (date) => new Date(date.getTime() + BANGKOK_OFFSET_MINUTES * 60 * 1000);

const getBangkokParts = (date = new Date()) => {
  const shifted = shiftToBangkok(date);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  };
};

const createBangkokDate = (year, month, day, hour = 0, minute = 0, second = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));

const pad = (value) => String(value).padStart(2, '0');

const formatBangkokDate = (date) => {
  const { year, month, day } = getBangkokParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
};

const formatBangkokDateTime = (date) => {
  const { year, month, day, hour, minute } = getBangkokParts(date);
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
};

module.exports = {
  BANGKOK_OFFSET_MINUTES,
  getBangkokParts,
  createBangkokDate,
  formatBangkokDate,
  formatBangkokDateTime
};
