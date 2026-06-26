import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    procurementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SavedProcurement",
      required: false
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false
    },
    plantName: {
      type: String,
      required: true
    },
    cementType: {
      type: String,
      required: true,
      default: "OPC 43"
    },
    quantity: {
      type: Number,
      required: true,
      default: 0
    },
    destination: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["PENDING", "IN_TRANSIT", "DELIVERED", "CANCELLED", "EMERGENCY"],
      default: "PENDING"
    },
    emergencyAlert: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", orderSchema);
