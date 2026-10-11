import { timingSafeEqual } from 'node:crypto';
import NextAuthModule from 'next-auth';
import GoogleProviderModule from 'next-auth/providers/google';
import CredentialsProviderModule from 'next-auth/providers/credentials';
import { connectDb } from '../db/index.js';
import { User } from '../db/models.js';

// next-auth v4 ships CommonJS with `exports.default = ...`; unwrap so the
// call works whether the bundler hands back the module object or the function.
const NextAuth = NextAuthModule.default || NextAuthModule;
const GoogleProvider = GoogleProviderModule.default || GoogleProviderModule;
const CredentialsProvider = CredentialsProviderModule.default || CredentialsProviderModule;

export { NextAuth };

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function toPlainUser(doc) {
  return {
    id: String(doc._id),
    email: doc.email,
    full_name: doc.full_name ?? null,
    image: doc.image ?? null,
    role: doc.role,
  };
}

// Every sign-in upserts the local user document; ADMIN_EMAILS decides who gets
// the admin role (an existing admin is never demoted).
export async function upsertUser({ email, full_name, image }) {
  await connectDb();
  const normalized = String(email).toLowerCase();
  const wantsAdmin = adminEmails().includes(normalized);

  const existing = await User.findOne({ email: normalized });
  if (existing) {
    if (full_name != null) existing.full_name = full_name;
    if (image != null) existing.image = image;
    existing.role = wantsAdmin ? 'admin' : existing.role;
    await existing.save();
    return toPlainUser(existing);
  }

  const created = await User.create({
    email: normalized,
    full_name: full_name ?? null,
    image: image ?? null,
    role: wantsAdmin ? 'admin' : 'user',
  });
  return toPlainUser(created);
}

export const authOptions = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: { scope: 'openid email profile', prompt: 'select_account' },
      },
    }),
    // Admin email + shared password (ADMIN_PASSWORD env). Disabled when unset.
    CredentialsProvider({
      id: 'credentials',
      name: 'Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const adminPassword = process.env.ADMIN_PASSWORD;
        if (!adminPassword) return null;

        const email = String(credentials?.email || '').trim().toLowerCase();
        const password = String(credentials?.password || '');
        if (!adminEmails().includes(email)) return null;
        if (!safeEqual(password, adminPassword)) return null;

        const dbUser = await upsertUser({
          email,
          full_name: email.split('@')[0],
        });
        return {
          id: dbUser.id,
          uid: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name,
          image: dbUser.image,
          role: dbUser.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider === 'credentials') return true;
      return !!profile?.email;
    },
    async jwt({ token, account, profile, user }) {
      if (account?.provider === 'credentials') {
        if (user) {
          token.uid = user.uid || user.id;
          token.role = user.role;
          token.name = user.name;
          token.email = user.email;
          token.picture = user.image;
        }
        return token;
      }
      if (account) {
        const email = token.email || profile?.email || user?.email;
        if (email) {
          const dbUser = await upsertUser({
            email,
            full_name: token.name || user?.name || profile?.name,
            image: token.picture || user?.image || profile?.picture,
          });
          token.uid = dbUser.id;
          token.role = dbUser.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.uid;
      session.user.role = token.role;
      return session;
    },
  },
};
