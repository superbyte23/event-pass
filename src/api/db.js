const API_BASE = '/api';

// ---------------------------------------------------------------------------
// Low-level fetch: same error shape the Base44 SDK threw ({ status, message })
// so existing catch blocks keep working.
// ---------------------------------------------------------------------------
async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status}).`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function query(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, typeof value === 'string' ? value : JSON.stringify(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

function entityUrl(entity, suffix = '') {
  return `${API_BASE}/entities/${encodeURIComponent(entity)}${suffix}`;
}

function entityApi(entity) {
  return {
    list: (sort, limit) => request(entityUrl(entity, query({ sort, limit }))),
    filter: (filter, sort, limit) =>
      request(entityUrl(entity, query({ filter, sort, limit }))),
    get: (id) => request(entityUrl(entity, `/${encodeURIComponent(id)}`)),
    create: (data) =>
      request(entityUrl(entity), { method: 'POST', body: JSON.stringify({ data }) }),
    bulkCreate: (items) =>
      request(entityUrl(entity), { method: 'POST', body: JSON.stringify({ items }) }),
    update: (id, data) =>
      request(entityUrl(entity, `/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        body: JSON.stringify({ data }),
      }),
    delete: (id) =>
      request(entityUrl(entity, `/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    deleteMany: (filter) =>
      request(entityUrl(entity, query({ filter })), { method: 'DELETE' }),
  };
}

// Auth callbacks may arrive with absolute URLs; the SPA only navigates by path.
function toPath(value) {
  if (!value) return '/';
  try {
    const url = new URL(value, window.location.origin);
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}

async function signOutRequest() {
  try {
    const csrf = await fetch('/api/auth/csrf', { credentials: 'same-origin' }).then((res) =>
      res.ok ? res.json() : null,
    );
    await fetch('/api/auth/signout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken: csrf?.csrfToken || '' }),
    });
  } catch {
    // best effort — the cookie is cleared server-side or on the next request
  }
}

async function uploadFile({ file }) {
  if (!file) throw new Error('No file provided.');
  const form = new FormData();
  form.append('file', file);
  return request(`${API_BASE}/uploads`, { method: 'POST', body: form });
}

export const db = {
  entities: /** @type {any} */ (
    new Proxy(
      {},
      {
        get: (_target, entity) =>
          typeof entity === 'string' && !entity.startsWith('_')
            ? entityApi(entity)
            : undefined,
      },
    )
  ),

  auth: {
    isAuthenticated: async () => {
      try {
        await request(`${API_BASE}/auth/me`);
        return true;
      } catch {
        return false;
      }
    },
    me: () => request(`${API_BASE}/auth/me`),
    // NextAuth v4 only initiates OAuth on POST (with a CSRF token); a plain
    // GET to /api/auth/signin/:provider just bounces back to /login. So this
    // submits a hidden form, exactly like next-auth/react's signIn() does.
    loginWithProvider: async (provider, returnTo) => {
      const csrf = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'same-origin' }).then((res) =>
        res.ok ? res.json() : null,
      );
      if (!csrf?.csrfToken) {
        const error = new Error('Could not start Google sign-in. Please try again.');
        error.status = 500;
        throw error;
      }
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${API_BASE}/auth/signin/${encodeURIComponent(provider)}`;
      const add = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      };
      add('csrfToken', csrf.csrfToken);
      add('callbackUrl', toPath(returnTo));
      document.body.appendChild(form);
      form.submit();
    },
    loginWithCredentials: async (email, password, returnTo) => {
      const { signIn } = await import('next-auth/react');
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        const error = new Error('Invalid admin email or password.');
        error.status = 401;
        throw error;
      }
      // Full reload so AuthProvider re-runs /api/auth/me with the new session.
      window.location.href = toPath(returnTo);
    },
    redirectToLogin: (returnTo) => {
      window.location.href = `/login?returnTo=${encodeURIComponent(toPath(returnTo))}`;
    },
    logout: async (redirectTo) => {
      await signOutRequest();
      if (redirectTo) window.location.href = redirectTo;
    },
    resetPasswordRequest: async (...args) => {
      void args;
      throw new Error('Password reset is not enabled for this app.');
    },
    resetPassword: async (...args) => {
      void args;
      throw new Error('Password reset is not enabled for this app.');
    },
  },

  app: {
    getPublicSettings: () => request(`${API_BASE}/public-settings`),
  },

  integrations: {
    Core: {
      UploadPublicFile: uploadFile,
      UploadFile: uploadFile,
    },
  },
};

export const base44 = db;
export default db;
