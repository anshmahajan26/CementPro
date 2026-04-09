import { Router } from "express";
import { changePassword, login, me, register, resetPassword, googleLogin, googleRegister, forgotPassword, resetPasswordWithOtp } from "../controllers/authController.js";
import { authorize, protect } from "../middlewares/auth.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);
router.post("/change-password", protect, changePassword);
router.post("/reset-password", protect, authorize("Admin", "Manager"), resetPassword);

router.post("/google-login", googleLogin);
router.post("/google-register", googleRegister);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password-otp", resetPasswordWithOtp);

export default router;
