import mongoose from 'mongoose';

let connecting = null;

// Lazily created so `next build` (which loads route handlers without env vars)
// never touches the database. Mongoose buffers model calls until connected.
export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error('MONGODB_URI is not configured.');
    err.status = 500;
    throw err;
  }

  if (!connecting) {
    connecting = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }).catch((error) => {
      connecting = null;
      throw error;
    });
  }
  await connecting;
  return mongoose.connection;
}

export function getDb() {
  return connectDb();
}
