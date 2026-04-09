import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is missing in environment variables.");
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,  // Fail fast if MongoDB is unreachable
    socketTimeoutMS: 45000,          // Close idle sockets after 45s
    maxPoolSize: 10                  // Limit connection pool to prevent exhaustion
  });

  // eslint-disable-next-line no-console
  console.log("MongoDB connected successfully");
};
