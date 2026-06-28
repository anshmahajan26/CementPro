import { Router } from "express";
import { createOrder, createOrdersBulk, getOrders, updateOrderStatus, getOrderHistory } from "../controllers/orderController.js";
import { authorize, protect } from "../middlewares/auth.js";

const router = Router();

router.route("/")
  .get(protect, getOrders)
  .post(protect, authorize("Manager"), createOrder);

router.route("/bulk")
  .post(protect, authorize("Manager"), createOrdersBulk);

router.route("/history")
  .get(protect, authorize("Manager"), getOrderHistory);

router.route("/:id/status")
  .put(protect, authorize("Manager", "Operator"), updateOrderStatus);

export default router;
