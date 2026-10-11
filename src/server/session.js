import { decode } from 'next-auth/jwt';

const SESSION_COOKIES = [
  '__Secure-authjs.session-token',
  'authjs.session-token',
  '__Secure-next-auth.session-token',
  'next-auth.session-token',
];

// Decodes the Auth.js JWT session cookie without going through
// getServerSession(), so any route handler can read the caller's identity.
export async function getSessionUser(req) {
  for (const name of SESSION_COOKIES) {
    const token = req.cookies?.get?.(name)?.value;
    if (!token) continue;
    try {
      const payload = await decode({ token, secret: process.env.AUTH_SECRET });
      if (!payload?.email || !payload.uid) continue;
      return {
        id: payload.uid,
        email: payload.email,
        full_name: payload.name || null,
        image: payload.picture || null,
        role: payload.role === 'admin' ? 'admin' : 'user',
      };
    } catch {
      // try the next cookie name
    }
  }
  return null;
}

export function isAdmin(user) {
  return user?.role === 'admin';
}

export function requireUser(user) {
  if (!user) {
    const err = new Error('You must be signed in to do that.');
    err.status = 401;
    throw err;
  }
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (!isAdmin(user)) {
    const err = new Error('You need an admin account to do that.');
    err.status = 403;
    throw err;
  }
  return user;
}
