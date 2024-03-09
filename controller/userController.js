const session = require("express-session");
const Cart = require("../models/cart");
const Product = require("../models/product");
const calculateSubtotal = require("../helpers/calculateSubtotal");
const User = require("../models/user");
const sendVerificationEmail = require("../helpers/sendmail");
const moment = require("moment");
const bcrypt = require("bcryptjs");
const isAdminLoggedIn = require("../helpers/adminAuth");
const Order = require("../models/order");
const Address = require("../models/address");
const mongoose = require("mongoose");
const Category = require("../models/category");
const Razorpay = require("razorpay");
require("dotenv").config();
const Coupon = require("../models/coupon");
const PDFDocument = require("pdfkit");
const fs = require("fs");

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.showCart = async (req, res) => {
  try {
    req.session.userLoggedIn = true;
    const userId = req.session.userId;

    const cart = await Cart.findOne({ user: userId }).populate(
      "products.product"
    );
    const coupons = await Coupon.find();
    res.render("cart", { cart, coupons, calculateSubtotal });
  } catch (error) {
    console.log(error);
    res.status(500).send("internal server error");
  }
};

exports.addToCart = async (req, res) => {
  try {
    req.session.userLoggedIn = true;
    const { productId, quantity } = req.body;
    const userId = req.session.userId;

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, products: [] });
    }

    const existingProductIndex = cart.products.findIndex(
      (item) => item.product.toString() === productId
    );

    if (existingProductIndex !== -1) {
      cart.products[existingProductIndex].quantity +=
        parseInt(quantity, 10) || 1;
      //update the quantity of product
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: -(quantity || 1) } },
        { new: true }
      );
    } else {
      const product = await Product.findById(productId);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Add the new product to the cart
      cart.products.push({
        product: productId,
        quantity: parseInt(quantity, 10) || 1,
      });
    }
    //update the quantity of product
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $inc: { quantity: -(quantity || 1) } },
      { new: true }
    );

    await cart.save();

    req.flash("success", "Product Added to the Cart succesfully");
    res.redirect(`/user/cart`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};
//removefromcart
exports.removeFromCart = async (req, res) => {
  try {
    const productId = req.params.id;

    const userId = req.session.userId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      return res.status(400).render("cart", { message: "Cart not found" });
    }
    const productIndex = cart.products.findIndex(
      (item) => item.product.toString() === productId
    );
    if (productIndex === -1) {
      return res
        .status(404)
        .render("cart", { message: "Product not found in the cart" });
    }
    //quantity of the product being removed
    const removedQuantity = cart.products[productIndex].quantity;
    //increment the quantity of product in database
    await Product.findByIdAndUpdate(
      productId,
      { $inc: { quantity: removedQuantity } },
      { new: true }
    );

    cart.products.splice(productIndex, 1);
    await cart.save();
    res.redirect("/user/cart");
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }
};

exports.updateQuantity = async (req, res) => {
  const productId = req.params.productId;
  console.log("productId", productId);
  const quantity = req.body.quantity;
  console.log(quantity);
  try {
    const cartItem = await Cart.findOneAndUpdate(
      { "products.product": productId },
      { $set: { "products.$.quantity": quantity } },
      { new: true }
    );

    console.log(cartItem);

    if (cartItem) {
      res.status(200).json({ message: "Quantity updated successfully" });
    } else {
      res.status(404).json({ error: "Product not found in the cart" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).send("internal server error");
  }
};

//forgot password
exports.forgotPassword = async (req, res) => {
  res.status(200).render("forgotPassword");
};
exports.forgotPassword = async (req, res) => {
  const email = req.body.email;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .render("forgotPassword", { error: "User not found" });
    }
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const expirationTime = moment().add(15, "minutes").toDate();

    user.otp = newOtp;
    user.otpExpires = expirationTime;
    await user.save();
    sendVerificationEmail(user.email, newOtp, expirationTime);
    res.render("resetPassword", { email });
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//resetPassword
exports.resetPassword = async (req, res) => {
  res.render("resetPassword");
};
exports.resetPassword = async (req, res) => {
  const { email, otp, password, confirmPassword } = req.body;
  const errors = {};

  if (!email) {
    errors.email = "Email is required";
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.email = "Inavlid email address";
    }
  }
  if (!password) {
    errors.password = "Password is required";
  } else if (password.length < 4) {
    errors.password = "Password must be at least 4 characters'";
  }
  if (!confirmPassword) {
    errors.confirmPassword = "confirm password is required";
  } else if (confirmPassword !== password) {
    errors.confirmPassword = "Password do not match";
  }
  // check  validation errors
  if (Object.keys(errors).length > 0) {
    return res.status(400).render("resetPassword", { errors });
  }

  try {
    const user = await User.findOne({
      email,
      otp,
      otpExpires: { $gt: new Date() },
    });
    if (!user) {
      return res
        .status(404)
        .render("resetPassword", { error: "User not found" });
    }
    //update password
    user.password = bcrypt.hashSync(password, 10);
    await user.save();
    res.status(200).redirect("/user/login");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//userProfile
exports.userProfile = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res.status(404).render("profile");
    }
    res.render("profile", { user });
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
exports.userManageAddresses = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log("userId", userId);
    const user = await User.findOne({ _id: userId });
    if (user) {
      const addresses = user.addresses;
      res.render("manageAddress", { addresses });
    } else {
      return res
        .status(404)
        .render("manageAddress", { error: "User not found" });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
exports.addAdress = async (req, res) => {
  await res.render("addaddress");
};
exports.addAdress = async (req, res) => {
  const { street, city, state, pincode, mobile, lastname, age, gender } =
    req.body;
  try {
    if (!street || !city || !state || !pincode || !mobile) {
      return res

        .status(500)
        .render("addaddress", { error: "All fields required" });
    }
    const userId = req.session.userId;

    const user = await User.findOne({ _id: userId });

    console.log("user", user);
    user.addresses.push({
      street,
      city,
      state,
      pincode,
      mobile,
    });
    //add other information
    user.lastname = lastname;
    user.age = age;
    user.gender = gender;
    await user.save();

    res.redirect("/user/manageAdresses");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//editAddress

exports.editAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const user = await User.findOne({ _id: userId });
    if (!user) {
      return res
        .status(404)
        .render("userEditAddress", { error: "User not found" });
    }
    const address = user.addresses.find((a) => a._id.toString() === id);
    console.log(address);
    if (!address) {
      return res
        .status(404)
        .render("userEditAddress", { error: "Address not found" });
    }

    res.render("userEditAddress", { address });
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
exports.usereditAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.userId;

    const { street, city, state, pincode, mobile } = req.body;

    const user = await User.findOne({ _id: userId });
    // console.log(user);
    if (!user) {
      return res
        .status(404)
        .render("userEditAddress", { error: "User not found" });
    }
    const addressIndex = user.addresses.findIndex(
      (a) => a._id.toString() === id
    );
    if (addressIndex === -1) {
      return res

        .status(404)
        .render("userEditAddress", { error: "Address not found" });
    }
    user.addresses[addressIndex].street = street;
    user.addresses[addressIndex].city = city;
    user.addresses[addressIndex].state = state;
    user.addresses[addressIndex].pincode = pincode;
    user.addresses[addressIndex].mobile = mobile;
    await user.save();
    res.redirect("/user/manageAdresses");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//delete Address
exports.deleteAddress = async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;
  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res
        .status(404)
        .render("userEditAddress", { error: "User not found" });
    }
    user.addresses = user.addresses.filter(
      (address) => address._id.toString() !== id
    );
    await user.save();
    res.redirect("/user/manageAdresses");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
// editUserdetailsform

exports.editProfile = async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;
  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res.status(404).render("editProfile", { error: "User not found" });
    }
    res.render("editProfile", { user });
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//edituserdetails
exports.editUserDetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.session.userId;
  const { username, lastname, age, gender } = req.body;
  try {
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res.status(404).render("editProfile", { error: "User not found" });
    }
    user.username = username;
    user.lastname = lastname;
    user.age = age;
    user.gender = gender;
    await user.save();
    res.redirect("/user/profile");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//changePassword

exports.changePasswordform = async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findOne({ _id: userId });

  await res.render("changePassword", { user });
};

exports.changePassword = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const user = await User.findOne({ _id: userId });

    if (!user) {
      return res
        .status(404)
        .render("changePassword", { error: "User not found" });
    }
    const passwordMatch = bcrypt.compareSync(currentPassword, user.password);

    if (!passwordMatch) {
      return res
        .status(400)
        .render("changePassword", { error: "Incorrect current password" });
    }
    //validate newpassword and confirmpassword
    if (newPassword !== confirmNewPassword) {
      return res.status(400).render("changePassword", {
        error: "New password and confirmation do not match",
      });
    }
    user.password = bcrypt.hashSync(newPassword, 10);

    await user.save();
    res.redirect("/user/profile");
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};
//proceedto checkout
exports.showCheckOut = async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await User.findById(userId).populate("addresses");
    const cart = await Cart.findOne({ user: userId }).populate(
      "products.product"
    );
    const coupons = await Coupon.find({ deleted: false });

    if (!user || !cart) {
      return res
        .status(400)
        .render("checkout", { error: "User and Cart not found" });
    }
    res.render("checkout", { user, cart, coupons });
  } catch (error) {
    console.log(error);
    return res.status(500).send("internal server error");
  }
};

// place your order
exports.placeOrder = async (req, res) => {
  try {
    console.log(req.body);
    const { addressId, paymentMethod } = req.body;
    const userId = req.session.userId;
    const user = await User.findById(userId);
    const cart = await Cart.findOne({ user: userId }).populate(
      "products.product"
    );

    // Total amount
    let totalAmount = cart.products.reduce(
      (total, item) => total + item.product.price * item.quantity,
      0
    );

    // if (paymentMethod === "COD" && totalAmount > 1000) {
    //   const errorMessage = "COD is not available for orders above Rs 1000.";
    //   return res.status(400).send(errorMessage);
    // }

    // Validate if the provided addressId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).send("Invalid address ID");
    }

    if (req.body.coupon) {
      const selectedCoupon = req.body.coupon;
      const coupon = await Coupon.findOne({
        code: selectedCoupon,
        deleted: false,
      });

      if (!coupon) {
        return res.status(404).send("Coupon not found");
      }

      if (totalAmount >= coupon.minimumPurchase) {
        let discountAmount = 0;
        if (coupon.discountType === "flat") {
          discountAmount = coupon.discountAmount;
        } else if (coupon.discountType === "percentage") {
          discountAmount = (totalAmount * coupon.discountPercentage) / 100;
        } else {
          return res.status(400).send("Invalid discount type");
        }

        totalAmount -= discountAmount;
      }
    }

    const addressInstance = user.addresses.find((address) =>
      address._id.equals(addressId)
    );

    if (!addressInstance) {
      return res.status(404).send("Address not found");
    }

    // Create order
    let order;
    if (paymentMethod === "COD") {
      order = new Order({
        user: userId,
        items: cart.products.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
          price: item.product.price,
        })),
        totalAmount: totalAmount,
        shippingAddress: addressInstance,
        paymentMethod: paymentMethod,
      });
    } else if (paymentMethod === "razorpay") {
      // Create order on Razorpay
      const razorpayOrder = await razorpay.orders.create({
        amount: totalAmount * 100,
        currency: "INR",
        receipt: "order_receipt_" + Math.floor(Math.random() * 1000),
        payment_capture: 1,
      });

      order = new Order({
        user: userId,
        items: cart.products.map((item) => ({
          product: item.product._id,
          quantity: item.quantity,
          subtotal: item.product.price * item.quantity,
          price: item.product.price,
        })),
        totalAmount: totalAmount,
        shippingAddress: addressInstance,
        paymentMethod: paymentMethod,
        razorpayOrderID: razorpayOrder.id,
      });

      await order.save();

      return res.status(200).json({ razorpayOrderID: razorpayOrder.id });
    } else {
      return res.status(400).send("Invalid payment method");
    }

    await order.save();

    return res.status(200).redirect("/user/ordersuccess");
  } catch (error) {
    console.log(error);
    const userId = req.session.userId;
    const orderId = order._id; // Assuming order variable is accessible here
    await Order.findByIdAndUpdate(orderId, { status: "payment pending" });
    return res.status(200).redirect("/user/paymentFailed");
  }
};

//userProfile myorder
exports.myOrder = async (req, res) => {
  try {
    const userId = req.session.userId;

    const user = await User.findOne({ _id: userId });

    const orders = await Order.find({ user: userId }).populate("items.product");

    console.log(orders);

    res.render("myOrder", { user, orders });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//user cancel order

exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId).populate("items.product");

    if (!order) {
      return res.status(404).send("order not found");
    }
    for (const item of order.items) {
      const product = item.product;
      const quantityOrdered = item.quantity;
      product.quantity += quantityOrdered;
      await product.save();
    }
    order.status = "canceled";
    await order.save();
    res.status(200).redirect("/user/myOrder");
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
// user order success page
exports.orderSuccess = async (req, res) => {
  try {
    const userId = req.session.userId;
    console.log(userId);

    const user = await User.findOne({ _id: userId });

    await Cart.findOneAndUpdate({ user: userId }, { $set: { products: [] } });

    const latestOrder = await Order.findOne({ user: userId })
      .sort({ createdDate: -1 })
      .populate("items.product");
    console.log(latestOrder);
    res.render("orderSuccess", { order: latestOrder });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};

//user orderdetails page
exports.viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(orderId);
    const order = await Order.findById(orderId).populate("items.product");
  
    console.log(order);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    res.render("userOrderDetails", { order });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};

//resend otp

exports.resendOtp = async (req, res) => {
  try {
    const userEmail = req.session.userEmail;
    console.log("user", userEmail);
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const user = await User.findOneAndUpdate(
      { email: userEmail },
      { otp: newOtp, otpExpires: moment().add(1, "minutes").toDate() },
      { new: true }
    );
    sendVerificationEmail(user.email, user.otp, user.otpExpires);
    res.status(200).json({ message: "OTP resent successfully" });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//search for a product
exports.search = async (req, res) => {
  const { searchQuery } = req.body;
  try {
    const allProduct = await Product.find();
    let filteredProducts = allProduct;
    if (searchQuery) {
      filteredProducts = filteredProducts.filter((product) =>
        product.productName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (filteredProducts.length === 0) {
      return res.render("product", {
        message: "No products found for the given search.",
      });
    }
    res.render("product", { products: filteredProducts });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//filter based category

exports.categoryProducts = async (req, res) => {
  try {
    const ObjectId = mongoose.Types.ObjectId;
    const categories = await Category.find();
    console.log("categories", categories);

    let products;
    if (req.params.category) {
      const selectedCategory = await Category.findOne({
        name: req.params.category,
      });
      if (selectedCategory) {
        const categoryId = new ObjectId(selectedCategory._id);
        products = await Product.find({ category: categoryId, blocked: false });
        console.log("products", products);
      } else {
        console.log("category is not found");
      }
    } else {
      products = await Product.find({ blocked: false });
    }

    return res.status(200).render("product", { categories, products });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//getallproduct
exports.producthome = async (req, res) => {
  try {
    const products = await Product.find().populate("category");

    console.log(products);

    res.render("productHome", { products });
  } catch (err) {
    console.log(err);
  }
};
//aboutus
exports.getAboutus = (req, res) => {
  res.render("about");
};

exports.getUserCoupon = async (req, res) => {
  try {
    const selectedCoupon = req.query.coupon;
    const totalAmount = parseFloat(req.query.total);
    const coupon = await Coupon.findOne({ code: selectedCoupon });

    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }

    let newTotal;

    // Check if the total amount meets the minimum purchase requirement
    if (totalAmount < coupon.minimumPurchase) {
      return res.status(400).json({
        error:
          "Total amount is less than minimum purchase required for this coupon",
      });
    }

    if (coupon.discountType === "flat") {
      newTotal = totalAmount - coupon.discountAmount;
    } else if (coupon.discountType === "percentage") {
      const discountAmount = (totalAmount * coupon.discountPercentage) / 100;
      newTotal = totalAmount - discountAmount;
    } else {
      return res.status(400).json({ error: "Invalid discount type" });
    }

    const userId = req.session.userId;
    const order = await Order.findOneAndUpdate(
      { user: userId },
      { totalAmount: newTotal },
      { new: true }
    );

    if (!order) {
      return res
        .status(404)
        .json({ error: "Order not found or already processed" });
    }

    res.json({ newTotal });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//user invoice pdf download
exports.invoicePdf = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId).populate(
      "items.product"
    );

    const pdf = await generateOrderInvoicePDF(order);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="orderdetails_report.pdf"'
    );

    res.send(pdf);
  } catch (error) {
    console.error("Error generating PDF invoice:", error);
    res.status(500).send("Internal Server Error");
  }
};
async function generateOrderInvoicePDF(order) {
  // Create a new PDF document
  const pdfDoc = new PDFDocument();
  const fileName = `invoice-${order._id}.pdf`; // Filename for the PDF

  // Add content to the PDF document

  pdfDoc.fontSize(10).text(`Total Amount: $${order.totalAmount}`).moveDown(0.5);
  pdfDoc.text(`Payment Method: ${order.paymentMethod}`).moveDown(0.5);
  pdfDoc.text(`Status: ${order.status}`).moveDown(1);

  pdfDoc.text("Order Details:").moveDown(0.5);
  let totalPrice = 0;
  order.items.forEach((item, index) => {
    pdfDoc.text(`#${index + 1}:`).moveDown(0.25);
    pdfDoc.text(`Product: ${item.product.productName}`).moveDown(0.25);
    pdfDoc.text(`Price: ${item.product.price}`).moveDown(0.25);
    pdfDoc.text(`Quantity: ${item.quantity}`).moveDown(0.25);
    pdfDoc.text(`Subtotal: $${item.subtotal}`).moveDown(0.5);
    totalPrice += item.subtotal;
  });

  pdfDoc.text("----------------------------------").moveDown(0.5);
  pdfDoc.fontSize(12).text(`Total Price: $${totalPrice}`).moveDown(0.5);

  // Finalize the PDF and save to a buffer
  pdfDoc.end();
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    pdfDoc.on("data", (chunk) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return buffer;
}

//return order
exports.returnOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const reason = req.body.reason;
    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {
      return res.status(404).send("order not found");
    }
    for (const item of order.items) {
      const product = item.product;
      const quantityReturned = item.quantity;

      product.quantity += quantityReturned;

      await product.save();
    }
    order.status = "returned";
    order.reason = reason;

    await order.save();
    res.redirect("/user/myOrder");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};
exports.paymentFailed = async (req, res) => {
  const userId = req.session.userId;
  console.log(userId);

  const user = await User.findOne({ _id: userId });

  const orders = await Order.find({ user: userId }).populate("items.product");
  const latestOrder = await Order.findOne({ user: userId })
    .sort({ createdDate: -1 })
    .populate("items.product");
  if (latestOrder) {
    latestOrder.status = "payment pending";
    await latestOrder.save();
  }

  res.render("paymentFailed");
};
//update order status payment pending
exports.updateOrderStatus = async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    // Find the order by ID and update its status
    const order = await Order.findByIdAndUpdate(
      orderId,
      { status: status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    return res.json({
      message: "Order status updated successfully",
      order: order,
    });
  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};
