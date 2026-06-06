const NETWORK_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET',
  'ENOTFOUND', 'ENETUNREACH', 'ENETDOWN',
  'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN',
]);

export function classifyError(error) {
  if (!error) {
    return { kind: 'unknown', message: 'An unexpected error occurred.' };
  }

  if (isTimeoutError(error)) {
    return { kind: 'timeout', message: 'The server took too long to respond.' };
  }

  if (isNetworkError(error)) {
    return { kind: 'network', message: 'Could not connect to the CommitQuest server.' };
  }

  const status = error.response?.status;

  if (status === 401) {
    return { kind: 'auth', message: 'Your session has expired or you are not logged in.' };
  }

  if (status === 403) {
    return {
      kind: 'forbidden',
      message: 'You do not have permission. Your GitHub authorization may need to be refreshed.',
    };
  }

  if (status === 404) {
    return { kind: 'notFound', message: 'The requested resource was not found.' };
  }

  if (status === 429) {
    return { kind: 'rateLimited', message: 'Too many requests. Please wait a moment and try again.' };
  }

  if (status >= 500) {
    return { kind: 'server', message: 'The CommitQuest server encountered an error. Please try again later.' };
  }

  const apiMessage = error.response?.data?.error || error.response?.data?.details;
  if (apiMessage && typeof apiMessage === 'string') {
    return { kind: 'validation', message: apiMessage };
  }

  return { kind: 'unknown', message: error.message || 'An unexpected error occurred.' };
}

export function isNetworkError(error) {
  if (NETWORK_CODES.has(error.code)) return true;
  if (error.message === 'Network Error') return true;
  if (!error.response && error.isAxiosError) return true;
  return false;
}

export function isTimeoutError(error) {
  if (error.code === 'ECONNABORTED' && /timeout/i.test(error.message)) return true;
  if (error.code === 'ERR_CANCELED') return true;
  return false;
}

export function isAuthError(error) {
  return error.response?.status === 401;
}
