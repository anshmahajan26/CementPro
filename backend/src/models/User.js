import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["Manager", "Operator"],
      default: "Operator"
    },
    isGoogleUser: { type: Boolean, default: false },
    resetOtp: { type: String },
    resetOtpExpiresAt: { type: Date }
  },
  { timestamps: true }
);

export const User = mongoose.model("User", userSchema);
