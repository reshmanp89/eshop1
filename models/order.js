const mongoose = require("mongoose");
const Address = require("../models/address");

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user",
    required: true,
  },
  shippingAddress: {
    type: Address.schema,
    required: true,
  },
  totalAmount: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    required: true,
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        required: true,
      },
      quantity: {
        type: Number,
        required: true,
      },
      subtotal: {
        type: Number,
        required: true,
      },
      price: {
        type: Number,
        required: true,
      },
    },
  ],
  deleted: {
    type: Boolean,

    default: false,
  },

  createdDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: [
      "ordered",
      "shipped",
      "delivered",
      "canceled",
      "returned",
      "payment pending",
    ],
    default: "ordered",
  },
  razorpayOrderID: {
    type: String,
  },
  reason: {
    type: String,
  },
});

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;


