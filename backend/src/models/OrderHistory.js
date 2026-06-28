import mongoose from "mongoose";

const orderHistorySchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    location: {
      type: String,
      required: true
    },
    cementType: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

export const OrderHistory = mongoose.model("OrderHistory", orderHistorySchema);
