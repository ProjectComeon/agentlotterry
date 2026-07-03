const isActiveAccountStatus = (status) => {
  if (status === undefined || status === null || status === '') {
    return true;
  }

  return String(status).trim().toLowerCase() === 'active';
};

const canAuthenticateAccount = (user) => Boolean(
  user &&
  user.isActive !== false &&
  isActiveAccountStatus(user.status)
);

const getAccountAccessMessage = (user) => {
  if (!user || user.isActive === false) {
    return 'Account is deactivated.';
  }

  if (!isActiveAccountStatus(user.status)) {
    return 'Account is not active.';
  }

  return '';
};

module.exports = {
  canAuthenticateAccount,
  getAccountAccessMessage,
  isActiveAccountStatus
};
