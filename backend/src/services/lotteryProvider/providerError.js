class LotteryProviderError extends Error {
  constructor(message, {
    code = 'LOTTERY_PROVIDER_ERROR',
    status = 502,
    cause = null
  } = {}) {
    super(message);
    this.name = 'LotteryProviderError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

const toSafeProviderError = (error) => {
  if (error instanceof LotteryProviderError) {
    return {
      status: error.status,
      body: {
        message: error.message,
        code: error.code
      }
    };
  }

  return {
    status: 502,
    body: {
      message: 'Lottery provider request failed',
      code: 'LOTTERY_PROVIDER_ERROR'
    }
  };
};

module.exports = {
  LotteryProviderError,
  toSafeProviderError
};
