const express=require('express')
const router=express.Router()
const adminController=require('../controller/adminController')
const isAdminLoggedIn =require('../helpers/adminAuth')

router.get('/',adminController.adminLogin)
router.post('/',adminController.adminLogin )
router.get('/logout',isAdminLoggedIn,adminController.adminLogout)
router.get('/dashboard',isAdminLoggedIn,adminController.adminDashboard)


router.get('/userManagement',isAdminLoggedIn,adminController.listUser)

router.post('/blockUser/:id',adminController.blockUser)
router.get('/categoryManagement',isAdminLoggedIn,adminController.getCategory)
router.post('/addCategory',adminController.addCategory)
router.get('/editCategory/:id',adminController.getCategoryId)
router.post('/editCategory/:id',adminController.editCategory)
router.post('/deleteCategory/:id',adminController.deleteCategory)
router.get('/product',isAdminLoggedIn,adminController.getProducts)
router.get('/addProduct',adminController.showAddform)
router.post('/addProduct',adminController.uploadOptions.fields([{name:'image',maxCount:1},{name:'images',maxCount:10}]),adminController.addProduct)
router.get('/editProduct/:id',adminController.getProductById)
router.post('/editProduct/:id', adminController.uploadOptions.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 10 }]), adminController.editProduct);
router.post('/deleteProduct/:id',adminController.deleteProduct)
//order management

router.get('/orderManagement',adminController.listOrder)
router.post('/orders/:orderId/change-status',adminController.changeOrderStatus)
router.post('/orders/:orderId/cancel',adminController.adminCancelOrder)
router.get('/orders/:orderId/viewDetail',adminController.viewOrderDetails)
//admin dashboard
router.get('/dashboard',adminController.adminDashboard)
//salesreport
router.get('/sales/:interval',adminController.getsaleData)
//category chart
router.get('/categorysales',adminController.getCategorySales)
//product chart
router.get('/products',adminController.productChart)
//download sales report
router.post('/generate-report',adminController.downloadReport)
//delete image individually
router.post('/deleteImage/:index',adminController.deleteImagesindividual)
//coupon management
router.get('/couponManagement',adminController.couponManagement)
//create coupon
router.post('/coupons/add',adminController.createCoupon)
//delete coupon
router.post('/coupons/delete/:id',adminController.deleteCoupon)
//sale report pdf
router.post('/generate-reportpdf',adminController.downloadPdf)


module.exports=router;
