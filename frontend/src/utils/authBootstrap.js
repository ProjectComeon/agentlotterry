export const buildInitialAuthState = ({
  token = '',
  storedUser = '',
  normalizeUser = (user) => user
} = {}) => {
  if (!token) {
    return {
      user: null,
      loading: false,
      shouldRevalidate: false
    };
  }

  try {
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const user = normalizeUser(parsedUser);

    if (user) {
      return {
        user,
        loading: false,
        shouldRevalidate: true
      };
    }
  } catch {
    // fall through to blocking validation
  }

  return {
    user: null,
    loading: true,
    shouldRevalidate: true
  };
};
