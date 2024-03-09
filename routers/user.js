const express = require("express");
const app = express();
const router = express.Router();
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const moment = require("moment");
const sendVerificationEmail = require("../helpers/sendmail");
const authMiddleware = require("../helpers/auth");
const userController = require("../controller/userController");
const Product = require("../models/product");
const { isAuthenticated, isBlockedByAdmin } = require("../helpers/auth");
const Category = require("../models/category");

app.use(express.json());
// router.use(authMiddleware.authenticateUser)
//usr login
router.get("/login", (req, res) => {
  res.setHeader("Cache-Control", "no-store, private, must-revalidate");

  res.render("login");
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).render("login", { error: "All field required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res
        .status(400)
        .render("login", { error: "Invalid email or Password" });
    }
    if (user.blocked) {
      return res
        .status(400)
        .render("login", { error: "The account is blocked" });
    }
    const passwordMatch = await bcrypt.compareSync(password, user.password);
    if (passwordMatch) {
      if (user.is_varified) {
        console.log("user logged in", user.username);
        req.session.userLoggedIn = true;
        req.session.username = user.username;
        req.session.userId = user._id;
        res.status(200).redirect("/user/product");
      } else {
        res.render("login", { error: "Please verify your mail" });
      }
    } else {
      return res
        .status(400)
        .render("login", { error: "Invalid email or password" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).render("login", { error: "Internal server error" });
  }
});

router.get("/signup", (req, res) => {
  res.render("signup");
});
router.post("/signup", async (req, res) => {
  //   console.log(req.body);
  const { username, email, password, confirmPassword } = req.body;

  //validate the fields
  const errors = {};

  if (!username) {
    errors.username = "Username is required";
  } else if (username.length < 3) {
    errors.username = "Username must be atleast 3 character";
  }
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
    return res.status(400).render("signup", { errors });
  }

  //check the user already exist

  const existUser = await User.findOne({ email });

  if (existUser) {
    return res
      .status(400)
      .render("signup", { error: "User already exist", errors });
  }

  try {
    //generate a otp
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    //expiration time

    const expirationTime = moment().add(1, "minutes").toDate();

    let user = new User({
      username: username,
      email: email,
      password: bcrypt.hashSync(password, 10),
      confirmPassword: bcrypt.hashSync(confirmPassword, 10),
      otp,
      otpExpires: expirationTime,
    });

    user = await user.save();
    req.session.userEmail = user.email;
    sendVerificationEmail(user.email, user.otp, user.otpExpires);
    res
      .status(200)
      .render("verifyOtp", {
        successMessage: "Verification email sent. Check your inbox.",
      });

    // console.log(user);
  } catch (err) {
    console.log(err);
    res.status(500).render("signup", { error: "Internal server error" });
  }
});
//verifymail

router.post("/verify", async (req, res) => {
  const { otp } = req.body;

  try {
    const user = await User.findOne({ otp });
    const currentTime = new Date();
    const otpExpires = user.otpExpires;
    if (user) {
      if (currentTime < otpExpires) {
        user.is_varified = true;
        await user.save();

        return res
          .status(200)
          .render("login", {
            successMessage:
              "Email verification successful. You can now log in.",
          });
      } else {
        return res
          .status(400)
          .render("verifyOtp", {
            error: "OTP has expired. Please request a new one.",
          });
      }
    } else {
      return res
        .status(400)
        .render("verifyOtp", { error: "Invalid OTP. Please try again." });
    }
  } catch (err) {
    console.log(err);
    res.status(500).render("signup", { error: "Internal server error" });
  }
});
//route for displaying product

router.get("/product", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, private, must-revalidate");

  try {
    if (req.session.userLoggedIn) {
      const userId = req.session.userId;
      const user = await User.findOne({ _id: userId });
      let products;

      if (req.query.category) {
        // Filter products based on the selected category
        const category = await Category.findOne({ name: req.query.category });
        if (category) {
          products = await Product.find({
            category: category._id,
            deleted: false,
          }).populate("category");
        } else {
          console.log("Selected category not found");
        }
      } else {
        // Retrieve all products if no category is selected
        products = await Product.find({ deleted: false }).populate("category");
        // const product = await Product.find().populate("category");
      }
      //filter by price
      if (req.query.priceRange) {
        const priceRange = req.query.priceRange.split("-");
        products = products.filter((product) => {
          const productPrice = product.price;
          return productPrice >= priceRange[0] && productPrice <= priceRange[1];
        });
      }

      const categories = await Category.find({ blocked: false });

      return res.status(200).render("product", { products, user, categories });
    } else {
      return res.redirect("/");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Internal error");
  }
});

//product details
router.get("/product/:id", async (req, res) => {
  const productId = req.params.id;
  try {
    if (req.session.userLoggedIn) {
      //check the user is blocked
      const userId = req.session.userId;
      const user = await User.findOne({ _id: userId });
      const loggedInuserId = req.session.userId;

      const loggedInUser = await User.findById(loggedInuserId);
      if (loggedInUser.blocked) {
        return res.status(404).redirect("/");
      }
      const product = await Product.findById(productId).populate("category");

      return res.status(200).render("productDetail", { product, user });
    } else {
      return res.redirect("/");
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("Interanl server error");
  }
});
//user logout

router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});
router.get("/cart", isAuthenticated, isBlockedByAdmin, userController.showCart);
//addtocart
router.post("/cart", userController.addToCart);
//removefromcart
router.get("/cart/remove/:id", userController.removeFromCart);
//update the cartquantity
router.post("/cart/updateQuantity/:productId", userController.updateQuantity);
//forgotPassword
router.get("/forgot-password", userController.forgotPassword);
router.post("/forgot-password", userController.forgotPassword);
//resetPassword
router.get("/reset-password", userController.resetPassword);
router.post("/reset-password", userController.resetPassword);

//userProfile
router.get("/profile", userController.userProfile);
router.get("/manageAdresses", userController.userManageAddresses);
router.get("/addAddress", userController.addAdress);
router.post("/addAddress", userController.addAdress);
router.get("/editAddress/:id", userController.editAddress);
router.post("/editAddress/:id", userController.usereditAddress);
router.get("/deleteAddress/:id", userController.deleteAddress);
router.get("/editProfile/:id", userController.editProfile);
router.post("/edit/:id", userController.editUserDetails);
router.get("/change-password/:id", userController.changePasswordform);
router.post("/change-password/:id", userController.changePassword);
//checkout

router.get("/checkout", userController.showCheckOut);
router.post("/placeorder", userController.placeOrder);

//userprofile myorder
router.get("/myOrder", userController.myOrder);
router.post("/cancel-order/:orderId", userController.cancelOrder);

//ordesuccess page
router.get("/ordersuccess", userController.orderSuccess);
//view orderdetailas
router.get("/viewDetails/:orderId", userController.viewOrderDetails);
//resendotp
router.post("/resend-otp", userController.resendOtp);

//search products

router.post("/search", userController.search);
//filter product based on categories
router.get("/product", userController.categoryProducts);

//display product in home page
router.get("/getAllproducts", userController.producthome);

//about-us
router.get("/about-us", userController.getAboutus);
//user selsect the coupon
router.get("/applyCoupon", userController.getUserCoupon);
//user invoice pdfDownload
router.get("/orderDetails/pdf/:orderId", userController.invoicePdf);
//return order
router.post("/return-order/:orderId", userController.returnOrder);
//paymentFailed
router.get('/paymentFailed',userController.paymentFailed)
module.exports = router;
