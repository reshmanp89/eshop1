const Category = require("../models/category");
const User = require("../models/user");
const Product = require("../models/product");
const multer = require("multer");
const Order = require("../models/order");
const ExcelJS = require("exceljs");
const Jimp=require('jimp')
const Coupon=require('../models/coupon')
const PDFDocument =require('pdfkit')
const FILE_TYPE = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isValid = FILE_TYPE[file.mimetype];
    let uploaderror = new Error("invalid image type");
    if (isValid) {
      uploaderror = null;
    }

    cb(uploaderror, "public/uploads");
  },
  filename: function (req, file, cb) {
    const extension = FILE_TYPE[file.mimetype];
    cb(null, Date.now() + "--" + file.originalname + extension);
  },
});

exports.uploadOptions = multer({ storage: storage });

exports.adminLogin = (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  res.setHeader("Pragma", "no-cache");

  res.render("admin");
};

exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email === "npreshmanp@gmail.com" && password === "reshma123") {
      req.session.adminLoggedIn = true;
      res.redirect("/admin/dashboard");
    } else {
      res.render("admin");
    }
  } catch (err) {
    res.status(500).render("admin", { error: "server error" });
  }
};
exports.adminLogout = async (req, res) => {
  req.session.adminLoggedIn = false;
  res.redirect("/admin");
};


exports.adminDashboard= async(req,res)=>{
  try{

    const totalSale= await calculateTotalSale();
    const totalOrders= await  countTotalOrders();
    const canceledOrders = await countCanceledOrders();
  const topProducts= await Product.find({deleted:false}).sort({quantity:-1}).limit(10)
  //top selling category
  const topCategories= await Category.aggregate([
    {$match:{blocked:false}},
    {
      $lookup:{
        from:'products',
        localField:'_id',
        foreignField:'category',
        as:'products',
      }
    },
    {
      $project:{
        name:1,
        productCount:{$size:'$products'}
      }
    },
    {$sort:{productCount:-1}},
    {$limit:10}
  ])
  
    res.render("adminDashboard", {
      totalSale,
      totalOrders,
      canceledOrders,topProducts,topCategories
    });


  }
  catch(error)
  {
    console.error('Error fetching data for admin dashboard:', error);
    res.status(500).send('Internal Server Error');
  }
};
//function to calculate total sale
async function calculateTotalSale(){
  try{
   const orders= await Order.find({})
   const totalSale=orders.reduce((total,order)=>total+order.totalAmount,0)
   return totalSale
  }
  catch(error)
  {
    console.error('Error calculating total sale:', error);
    throw error;
  }
}
//function to calculate total orders
async function  countTotalOrders()
{
  try{
    const orders= await Order.find({})
    const totalOrders=orders.length;
    return totalOrders;
  }
  catch(error)
  {
    console.error('Error counting total orders:', error);
    throw error;
  }
}
//function to calculate canceledorder
async function countCanceledOrders() {
  try {
    // Query canceled orders from the database
    const canceledOrders = await Order.find({ status: 'canceled' });

    // Count canceled orders
    const canceledOrderCount = canceledOrders.length;

    return canceledOrderCount;
  } catch (error) {
    console.error('Error counting canceled orders:', error);
    throw error;
  }
}
//user management // list user

exports.listUser = async (req, res) => {
  try {
    const users = await User.find();
    if (users) {
      const verifiedUser = users.filter((user) => user.is_varified === true);
      res.render("userManagement", { users: verifiedUser });
    }
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }
};
//block unblock user

exports.blockUser = async (req, res) => {
  const userId = req.params.id;
  console.log(userId);
  try {
    const user = await User.findById(userId);
    user.blocked = !user.blocked;
    await user.save();
    res.status(200).redirect("/admin/userManagement");
  } catch (err) {
    res.status(500).send("internal server error");
  }
};


//addcategory
exports.addCategory = async (req, res) => {
  const { name } = req.body;
  try {
    const existCategory = await Category.findOne({
      name: { $regex: new RegExp("^" + name + "$"), $options: "i" },
    });
    if (existCategory) {
      const categories = await Category.find();
      return res.status(400).render("category", {
        categories,
        message: "The category already exist",
      });
    }
    const newCategory = new Category({ name });
    await newCategory.save();
    const categories = await Category.find();
    return res.status(200).render("category", {
      categories,
      message: "Category added successfully",
    });
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }
};

//getcategory
exports.getCategory = async (req, res) => {
  try {
    const categories = await Category.find();
    return res.render("category", { categories });
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }

  res.render("category");
};
//getcategorybyId
exports.getCategoryId = async (req, res) => {
 
  try {
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    return res.status(200).render("editCategory", { category });
  } catch (err) {
    console.log(err);
    return res.status(500).send("internal server error");
  }
};

//editcategory

exports.editCategory = async (req, res) => {
  console.log(req.body);
  const categoryId = req.params.id;
  console.log(categoryId);
  const name = req.body.name;
  console.log(name);
  try {
    const existCategory = await Category.findOne({
      name: { $regex: new RegExp("^" + name + "$"), $options: "i" },
    });
    if (existCategory) {
      return res.redirect("/admin/categoryManagement");
    }
    const updatedCategory = {
      name,
    };

    const category = await Category.findByIdAndUpdate(
      categoryId,
      updatedCategory,
      { new: true }
    );

   
    res.status(200).redirect("/admin/categoryManagement");
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }
};
//list and unlist category

exports.deleteCategory = async (req, res) => {
  const categoryId = req.params.id;
  try {
    const category = await Category.findById(categoryId);
    category.blocked = !category.blocked;
    await category.save();
    res.status(200).redirect("/admin/categoryManagement");
  } catch (err) {
    res.status(500).send("internal server error");
  }
};

exports.getProducts = async (req, res) => {
  try {
    const product = await Product.find().populate("category");

    // console.log(product);

    res.render("productManagement", { product });
  } catch (err) {
    console.log(err);
  }
};

exports.showAddform = async (req, res) => {
  try {
    const categories = await Category.find({ blocked: false });

    res.render("addProduct", { categories });
  } catch (err) {
    console.log(err);
    res.status(500).send("internal server error");
  }
};

exports.addProduct = async (req, res) => {
  try {
    const basePath = `/uploads/`;
    
    // Find the category by name
    const category = await Category.findOne({ name: req.body.category });

    if (!category) {
      return res.status(400).render("product", { data: "Category not found" });
    }

    // Process single main image
    const mainImage = req.files.image[0];
    const mainImagePath = basePath + mainImage.filename;
    await Jimp.read(mainImage.path)
      .then(image => {
        return image
          .resize(800, 600) 
          .crop(0, 0, 800, 600) 
          .write(`public/${mainImagePath}`); 
      });

    // Process multiple images
    const imagesPromises = req.files.images.map(async (file) => {
      const imagePath = basePath + file.filename;
      await Jimp.read(file.path)
        .then(image => {
          return image
            .resize(800, 600) 
            .crop(0, 0, 800, 600) 
            .write(`public/${imagePath}`); 
        });
      return imagePath;
    });
    const images = await Promise.all(imagesPromises);

    const product = {
      productName: req.body.productName,
      description: req.body.description,
      image: mainImagePath,
      images: images,
      brand: req.body.brand,
      price: req.body.price,
      category: category._id,
      quantity: req.body.quantity,
      rating: req.body.rating,
      dateCreated: req.body.dateCreated,
    };

    const newProduct = await Product.create(product);

    if (!newProduct) {
      return res.status(500).render("addProduct", { data: "Product could not be created" });
    }

    res.status(200).redirect("/admin/product");
  } catch (error) {
    console.error(error.message);
    if (error.message === "Invalid image type") {
      res.status(400).render("addProduct", { error: "Invalid image type" });
    } else {
      res.status(500).render("addProduct", { error: "Internal server error" });
    }
  }
};
// get the product by id
exports.getProductById = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("category");
    const categories = await Category.find({ blocked: false });

    if (!product) {
      // Handle case where product is not found
      return res.redirect("/admin/productManagement");
    }

    res.render("editProduct", { product, categories });
  } catch (err) {
    console.error(err);
    res.status(500).render("error", { error: "Internal Server Error" });
  }
};


exports.editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const basePath = "/uploads/";
    const existingProduct = await Product.findById(productId);

    const existingImages = existingProduct.images || [];
    const imagesToDelete = req.body.deleteImages || []; 
    // Filter out the images marked for deletion
    const updatedImages = existingImages.filter(
      (image, index) => !imagesToDelete.includes(index.toString()) 
    );

    // Process new images
    const newImages =
      req.files && req.files.images
        ? req.files.images.map((file) => basePath + file.filename)
        : [];

    // Combine existing and new images
    const allImages = [...updatedImages, ...newImages];

    // Process single main image
    const mainImage = req.files.image && req.files.image[0];
    const image = mainImage ? basePath + mainImage.filename : existingProduct.image; 

   
    if (mainImage) {
      await Jimp.read(mainImage.path)
        .then(image => {
          return image
            .resize(800, 600) // Resize the image
            .crop(0, 0, 800, 600) // Crop the image to 800x600 pixels
            .write(`public/${basePath}${mainImage.filename}`); // Save the image
        });
    }

    const updatedProduct = {
      productName: req.body.productName,
      description: req.body.description,
      image: image,
      images: allImages,
      brand: req.body.brand,
      price: req.body.price,
      category: req.body.category,
      quantity: req.body.quantity,
      rating: req.body.rating,
      dateCreated: req.body.dateCreated,
    };

    const result = await Product.findByIdAndUpdate(productId, updatedProduct);

    if (!result) {
      return res.status(500).render("editProduct", { data: "Product is not updated" });
    }
    res.status(200).redirect("/admin/product");
  } catch (err) {
    console.error(err);
    res.status(500).render("editProduct", { data: "Error editing product" });
  }
};



exports.deleteProduct = async (req, res) => {
  const productId = req.params.id;
  try {
    const product = await Product.findById(productId);
    product.deleted = !product.deleted;
    await product.save();
    res.redirect("/admin/product");
  } catch (err) {
    console.log(err);
    res.status(500).send("internal erver error");
  }
};
//order management
exports.listOrder = async (req, res) => {
  try {
    const orders = await Order.find();


    res.render("orderManagement", { orders });
  } catch (error) {
    console.log(err);
    res.status(500).send("internal erver error");
  }
};
exports.changeOrderStatus = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const newStatus = req.body.newStatus;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("order not found");
    }
    order.status = newStatus;
    await order.save();
    res.redirect("/admin/orderManagement");
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//admin cancel order
exports.adminCancelOrder = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    order.adminDeleted = true;
    await order.save();
    res.status(200).render("orderManagement", {
      error: "Order cancelled by admin successfully",
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};
//view orderdetails
exports.viewOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log(orderId);
    const order = await Order.findById(orderId).populate("items.product");
    // const orders= await Order.find({user:userId}).populate('items.product')
    console.log(order);
    if (!order) {
      return res.status(404).send("Order not found");
    }
    res.render("adminorderDetails", { order });
  } catch (error) {
    console.log(error);
    return res.status(500).send("Internal server error");
  }
};

//admin dashboard

exports.admindashbord = async (req, res) => {
  return res.render("dashboard");
};
exports.getsaleData = async (req, res) => {
  try {
    const interval = req.params.interval;
    let salesData;
    switch (interval) {
      case "daily":
        salesData = await getDailySalesData();
        break;
      case "weekly":
        salesData = await getWeeklySalesData();
        break;
      case "yearly":
        salesData = await getYearlySalesData();
        break;
        deafult: throw new Error("invalid interval");
    }

    res.json({ sales: salesData });
    
  } catch (error) {
    console.log(error);
    return res.status(500).json("Internal server error");
  }
};
async function getDailySalesData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailySales = await Order.find({ createdDate: { $gte: today } });
  return dailySales;
}
async function getWeeklySalesData() {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  const weekSales = await Order.find({
    createdDate: { $gte: startOfWeek, $lte: endOfWeek },
  });
  return weekSales;
}

async function getYearlySalesData() {
  const currentYear = new Date().getFullYear();

  const yearlySales = await Order.find({
    createdDate: {
      $gte: new Date(currentYear, 0, 1),
      $lte: new Date(currentYear, 11, 31),
    },
  });

  return yearlySales;
}
//category chart

exports.getCategorySales = async (req, res) => {
  try {
    const categorySales = await Order.aggregate([
      { $unwind: "$items" }, // Flatten the items array
      {
        $lookup: {
         
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" }, 
      {
        $lookup: {
       
          from: "categories",
          localField: "product.category", 
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" }, 
      {
        $group: {
         
          _id: "$category.name", 
          totalAmount: { $sum: "$items.subtotal" },
        },
      },
      {
        $project: {
        
          category: "$_id",
          totalAmount: 1,
          _id: 0,
        },
      },
    ]);
    console.log("category sale", categorySales);
    res.json({ categorySales });
  } catch (error) {
    console.error("Error fetching category sales:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
//products quantity piechart

exports.productChart = async (req, res) => {
  try {
    const products = await Product.find();
    res.json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
//download salesreport
exports.downloadReport = async (req, res) => {
  const { startDate, endDate, reportType } = req.body;
 

  try {
    let salesData;
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    switch (reportType) {
      case "daily":
        salesData = await Order.find({
          createdDate: { $gte: parsedStartDate },
        });

        break;
      case "weekly":
        const startOfWeek = new Date(parsedStartDate);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        const endOfWeek = new Date(parsedEndDate);
        endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()));
        salesData = await Order.find({
          createdDate: { $gte: startOfWeek, $lte: endOfWeek },
        });

        break;
      case "yearly":
        const startOfYear = new Date(parsedStartDate.getFullYear(), 0, 1);
        const endOfYear = new Date(parsedEndDate);
        endOfYear.setFullYear(endOfYear.getFullYear(), 11, 31);
        salesData = await Order.find({
          createdDate: { $gte: startOfYear, $lte: endOfYear },
        });
        break;
      default:
        throw new Error("Invalid report type");
    }
    
    //excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");
    worksheet.columns = [
      { header: "Order ID", key: "orderId", width: 15 },
      { header: "Total Amount", key: "totalAmount", width: 15 },
      { header: "Payment Method", key: "paymentMethod", width: 20 },
    ];
    salesData.forEach((order) => {
      worksheet.addRow({
        orderId: order._id,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="sales_report.xlsx"'
    );

    await workbook.xlsx.write(res);
  } catch (error) {
    console.error("Error generating sales report:", error);
    res
      .status(500)
      .send("An error occurred while generating the sales report.");
  }
};
//dlete individual image
exports.deleteImagesindividual=async(req,res)=>{
  try{
    const { index } = req.params;
    const productId = req.params.id;
    const existingProduct = await Product.findById(productId);

    // Ensure the index is within bounds
    if (index < 0 || index >= existingProduct.images.length) {
        return res.status(400).send('Invalid image index');
    }

    // Remove the image file from the server
    const imagePath = existingProduct.images[index];
    fs.unlinkSync(path.join(__dirname, '..', imagePath));



    // Remove the image from the product images array
    existingProduct.images.splice(index, 1);

    // Update the product in the database
    await existingProduct.save();

    res.render('editProduct')
  }
  catch(error)
  {
    console.error("Error generating sales report:", error);
    res
      .status(500)
      .send("An error occurred while generating the sales report.");
  }
}
//coupon management
exports.couponManagement= async(req,res)=>{
  try{
    const coupons= await Coupon.find()
    
    res.render("couponmanagement",{coupons})
  }
  catch(error)
  {
    res.status(500).json({ error: "Internal server error" }); 
  }


}
//create coupn
exports.createCoupon = async (req, res) => {
  try {
      const { code, discountPercentage, expiryDate, discountType, discountAmount, minimumPurchase, maxDiscount } = req.body;
    
      
      let newCoupon;
      if (discountType === 'flat') {
          newCoupon = new Coupon({
              code,
              discountPercentage: 0,
              expiryDate,
              discountType,
              discountAmount,
              minimumPurchase,
              maxDiscount
          });
      } else if (discountType === 'percentage') {
          newCoupon = new Coupon({
              code,
              discountPercentage,
              expiryDate,
              discountType,
              discountAmount: 0, // Set discount amount to 0 when discount type is percentage
              minimumPurchase,
              maxDiscount
          });
      } else {
          return res.status(400).json({ error: "Invalid discount type" });
      }

      
      await newCoupon.save();

      res.redirect('/admin/couponManagement');
  } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Internal server error" });
  }
}


exports.deleteCoupon = async (req, res) => {

      const couponId= req.params.id;
  try {
    const coupon =await Coupon.findByIdAndUpdate(couponId)
    coupon.deleted = !coupon.deleted;
    await coupon.save();
    res.status(200).redirect("/admin/couponManagement");
  } catch (err) {
    res.status(500).send("internal server error");
  }
};

  //seles report pdf

  exports.downloadPdf= async(req,res)=>{
    try{

const orders = await Order.find({
  createdDate: { $gte: req.body.startDate, $lte: req.body.endDate }
});


const doc = new PDFDocument();


res.setHeader('Content-Type', 'application/pdf');
res.setHeader('Content-Disposition', 'attachment; filename="sales_report.pdf"');

// Pipe the PDF document to the response
doc.pipe(res);

// Add content to the PDF document
doc.fontSize(16).text('Sales Report', { align: 'center' }).moveDown();

// Add data from orders to the PDF document
orders.forEach((order, index) => {
  doc.text(`Order ID: ${order._id}`, { continued: true }).text(`Total Amount: ${order.totalAmount}`).moveDown();
});


doc.end();
    }
    catch(error)
    {
      console.error('Error generating sales report:', error);
      res.status(500).send('Internal Server Error');
    }
  }