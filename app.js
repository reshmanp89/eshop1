const express = require("express");
const path = require("path");
const app = express();
const mongoose = require("mongoose");
const flash = require("connect-flash");

const homeRouter = require("./routers/home");
const userRouter = require("./routers/user");
const productRouter = require("./routers/product");
const adminRouter = require("./routers/adminRoute");
const session = require("express-session");
const methodOveride = require("method-override");
// load environment variable from .env file
require("dotenv").config();

// set up Ejs

app.set("view engine", "ejs");

app.use(express.json()); // Parse JSON
app.use(express.urlencoded({ extended: true }));
app.use(methodOveride("_method"));

//session

app.use(
  session({
    secret: "secret1234",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(flash());
//static file
app.use(express.static(path.join(__dirname, "public")));

//routers

app.use("/", homeRouter);
app.use("/user", userRouter);
// app.use('/product',productRouter)
app.use("/admin", adminRouter);
//db connection

mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => {
    console.log("Database connected");
  })
  .catch((err) => {
    console.log(err);
  });

// 404 Error Handling: Page Not Found
app.use((req, res, next) => {
  res.status(404).render("error", {
    status: 404,
    message: "Page Not Found"
  });
});
app.use((err, req, res, next) => {
  // Set default error status

  if (!err.status) {
    err.status = 500; 
    err.message="Internal server error"
  }

  // Render error page
  res.status(err.status);
  res.render("error", {
    message: err.message,
    status: err.status,
  });
});


app.listen(5001

  , () => {
  console.log("server running");
});
