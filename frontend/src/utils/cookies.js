export const getCookieValue = (name) => {
  const prefix = name + '=';
  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix))
    ?.slice(prefix.length) || '';
};
