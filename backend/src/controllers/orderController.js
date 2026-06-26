import { Order } from "../models/Order.js";

// @desc    Get all orders (Managers see all, Operators see assigned or all if none assigned yet)
// @route   GET /api/orders
export const getOrders = async (req, res) => {
  try {
    let query = { plantName: req.user.plantName }; // Filter by user's plant globally
    
    if (req.user.role === "Operator") {
      // Operators see active orders for their plant
      query.status = { $in: ["PENDING", "IN_TRANSIT", "EMERGENCY"] };
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
      plantName: req.user.plantName,
      status: "PENDING"
    });

    res.status(201).json(newOrder);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Create multiple orders in bulk (Managers only)
// @route   POST /api/orders/bulk
export const createOrdersBulk = async (req, res) => {
  try {
    const { orders } = req.body;
    
    if (req.user.role !== "Manager") {
      return res.status(403).json({ message: "Only managers can create orders" });
    }

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({ message: "Orders array is required" });
    }

    const newOrders = orders.map(o => ({
      managerId: req.user._id,
      procurementId: o.procurementId,
      cementType: o.cementType || "OPC 43",
      quantity: o.quantity,
      destination: o.destination,
      plantName: req.user.plantName,
      status: "PENDING"
    }));

    const insertedOrders = await Order.insertMany(newOrders);
    res.status(201).json(insertedOrders);
  } catch (error) {
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, emergencyAlert } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Role-based logic
    if (req.user.role === "Operator") {
      // Operators can mark as IN_TRANSIT, DELIVERED, or EMERGENCY
      if (!["IN_TRANSIT", "DELIVERED", "EMERGENCY"].includes(status)) {
         return res.status(403).json({ message: "Operators can only set status to IN_TRANSIT, DELIVERED, or EMERGENCY" });
      }
      order.operatorId = req.user._id; // Assign themselves as the operator
      if (status === "EMERGENCY" && emergencyAlert) {
         order.emergencyAlert = emergencyAlert;
      }
    } else if (req.user.role === "Manager") {
      // Managers can CANCEL, change to anything, or resolve emergencies
      if (status === "RESOLVED") {
        order.status = "IN_TRANSIT";
        order.emergencyAlert = "";
      } else if (status !== "EMERGENCY") {
        order.emergencyAlert = "";
      }
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
