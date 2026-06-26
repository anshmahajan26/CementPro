import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";
import crypto from "crypto";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const buildToken = (user) =>
  jwt.sign({ id: user._id, role: user.role, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d"
  });

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isBcryptHash = (value) => typeof value === "string" && /^\$2[aby]\$\d{2}\$/.test(value);

const validatePassword = (password) => typeof password === "string" && password.trim().length >= 6;

const verifyAndUpgradePasswordIfNeeded = async (user, inputPassword) => {
  if (isBcryptHash(user.password)) {
    return bcrypt.compare(inputPassword, user.password);
  }

  const matched = String(user.password) === String(inputPassword);
  if (matched) {
    user.password = await bcrypt.hash(inputPassword, 10);
    await user.save();
  }

  return matched;
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, plantName } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password || !plantName) {
      return res.status(400).json({ message: "name, email, password, and plantName are required" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET is missing in backend environment." });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: passwordHash,
      role: role || "Operator",
      plantName
    });

    const token = buildToken(user);

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plantName: user.plantName
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "JWT_SECRET is missing in backend environment." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const matched = await verifyAndUpgradePasswordIfNeeded(user, password);

    if (!matched) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = buildToken(user);

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plantName: user.plantName
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const me = async (req, res) => {
  return res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      plantName: req.user.plantName
    }
  });
};

export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "currentPassword and newPassword are required" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "newPassword must be at least 6 characters" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const matched = await verifyAndUpgradePasswordIfNeeded(user, currentPassword);
    if (!matched) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    const token = buildToken(user);

    return res.json({
      message: "Password changed successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        plantName: user.plantName
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, userId, newPassword } = req.body;

    if ((!email && !userId) || !newPassword) {
      return res.status(400).json({ message: "Provide (email or userId) and newPassword" });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({ message: "newPassword must be at least 6 characters" });
    }

    const query = userId ? { _id: userId } : { email: normalizeEmail(email) };
    const targetUser = await User.findOne(query);

    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    targetUser.password = await bcrypt.hash(newPassword, 10);
    await targetUser.save();

    return res.json({
      message: "Password reset successfully",
      resetUser: {
        id: targetUser._id,
        email: targetUser.email,
        role: targetUser.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ message: "Token is required" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();

    let user = await User.findOne({ email });
    if (user) {
      return res.json({
        token: buildToken(user),
        user: { id: user._id, name: user.name, email: user.email, role: user.role, plantName: user.plantName }
      });
    } else {
      return res.status(202).json({
        requireRole: true,
        email,
        name: payload.name,
      });
    }
  } catch (error) {
    return res.status(401).json({ message: "Invalid Google token" });
  }
};

export const googleRegister = async (req, res) => {
  try {
    const { token, role, plantName } = req.body;
    if (!token || !role || !plantName) return res.status(400).json({ message: "Token, role, and plantName are required" });

    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();

    let user = await User.findOne({ email });
    if (user) {
      return res.status(409).json({ message: "User already exists" });
    }

    const dummyPassword = crypto.randomBytes(16).toString("hex");
    const passwordHash = await bcrypt.hash(dummyPassword, 10);

    user = await User.create({
      name: payload.name,
      email,
      password: passwordHash,
      role: role,
      plantName: plantName,
      isGoogleUser: true
    });

    return res.status(201).json({
      token: buildToken(user),
      user: { id: user._id, name: user.name, email: user.email, role: user.role, plantName: user.plantName }
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: "User not found" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetOtp = otp;
    user.resetOtpExpiresAt = Date.now() + 10 * 60 * 1000;
    await user.save();

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.ethereal.email",
      port: process.env.SMTP_PORT || 587,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: '"Smart RMC" <noreply@smartrmc.com>',
      to: user.email,
      subject: "Password Reset OTP",
      text: `Your password reset OTP is: ${otp}. It expires in 10 minutes.`,
    };

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      await transporter.sendMail(mailOptions);
    } else {
      console.log(`[DEV MODE] Password Reset OTP for ${user.email}: ${otp}`);
    }

    return res.json({ message: "OTP sent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export const resetPasswordWithOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ email: normalizeEmail(email) });
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetOtpExpiresAt < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetOtp = undefined;
    user.resetOtpExpiresAt = undefined;
    await user.save();

    return res.json({ message: "Password reset correctly" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
