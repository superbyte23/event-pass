const isNode = typeof window === 'undefined';

const isClearAccessTokenRequested = () =>
  !isNode &&
  new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

const clearStoredAccessToken = () => {
  if (isNode) return;
  window.localStorage.removeItem('base44_access_token');
  window.localStorage.removeItem('token');
};

const getAppParams = () => {
  if (isClearAccessTokenRequested()) {
    clearStoredAccessToken();
  }
  return {
    appId: null,
    // The Auth.js session lives in an httpOnly cookie that JavaScript cannot
    // read, so we cannot detect it here. Assume a session might exist and let
    // /api/auth/me be the source of truth (anonymous callers get 401).
    token: true,
    functionsVersion: null,
    appBaseUrl: null,
  };
};

export const appParams = {
  ...getAppParams(),
};
