import { Order } from "../models/Order.js";

// @desc    Get all orders (Managers see all, Operators see assigned or all if none assigned yet)
// @route   GET /api/orders
export const getOrders = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "Operator") {
      // For now, Operators can see all orders or just ones assigned to them. 
      // We will let them see all PENDING or IN_TRANSIT orders so they can manage them.
      query = { status: { $in: ["PENDING", "IN_TRANSIT"] } };
    }
    
    const orders = await Order.find(query)
      .populate("managerId", "name email")
      .populate("operatorId", "name email")
      .sort({ createdAt: -1 });
      
    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Create a new order (Managers only)
// @route   POST /api/orders
export const createOrder = async (req, res) => {
  try {
    const { procurementId, cementType, quantity, destination } = req.body;
    
    if (req.user.role !== "Manager") {
      return res.status(403).json({ message: "Only managers can create orders" });
    }

    const newOrder = await Order.create({
      managerId: req.user._id,
      procurementId,
      cementType,
      quantity,
      destination,
      status: "PENDING"
    });

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Role-based logic
    if (req.user.role === "Operator") {
      // Operators can mark as IN_TRANSIT or DELIVERED
      if (!["IN_TRANSIT", "DELIVERED"].includes(status)) {
         return res.status(403).json({ message: "Operators can only set status to IN_TRANSIT or DELIVERED" });
      }
      order.operatorId = req.user._id; // Assign themselves as the operator
    } else if (req.user.role === "Manager") {
      // Managers can CANCEL or change to anything
    } else {
      return res.status(403).json({ message: "Not authorized" });
    }

    order.status = status;
    const updatedOrder = await order.save();

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};
