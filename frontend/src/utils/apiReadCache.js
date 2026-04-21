export const stableStringify = (value = {}) => {
  if (!value || typeof value !== 'object') return String(value);

  return JSON.stringify(
    Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const nextValue = value[key];
        if (nextValue !== undefined && nextValue !== null && nextValue !== '') {
          acc[key] = nextValue;
        }
        return acc;
      }, {})
  );
};

export const buildReadCacheKey = ({ token = '', url = '', params = {} } = {}) =>
  `${token}:${url}:${stableStringify(params)}`;
