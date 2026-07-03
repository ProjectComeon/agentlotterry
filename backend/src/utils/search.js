const DEFAULT_MAX_SEARCH_LENGTH = 80;
const REGEXP_SPECIAL_CHARS = new Set(['\\', '^', '$', '*', '+', '?', '.', '(', ')', '|', '{', '}', '[', ']']);

const escapeRegExp = (value) => String(value).replace(/./g, (char) => (
  REGEXP_SPECIAL_CHARS.has(char) ? '\\' + char : char
));

const toSearchText = (value, maxLength = DEFAULT_MAX_SEARCH_LENGTH) => {
  const normalized = String(value || '').trim();
  const safeMaxLength = Math.max(1, Number(maxLength) || DEFAULT_MAX_SEARCH_LENGTH);
  return normalized.slice(0, safeMaxLength);
};

const buildLiteralSearchRegex = (value, maxLength = DEFAULT_MAX_SEARCH_LENGTH) => {
  const searchText = toSearchText(value, maxLength);
  return searchText ? new RegExp(escapeRegExp(searchText), 'i') : null;
};

module.exports = {
  DEFAULT_MAX_SEARCH_LENGTH,
  buildLiteralSearchRegex,
  escapeRegExp,
  toSearchText
};
