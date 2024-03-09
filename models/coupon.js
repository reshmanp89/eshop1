const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    discountPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    expiryDate: {
        type: Date,
        required: true
    },
    discountType:{
        type:String,
        enum:['flat','percentage']
    },
    discountAmount:{
        type:Number,
        min:0
    },
    minimumPurchase:{
        type:Number,
        min:0,
    },
    deleted:{
        type:Boolean,
        default:false
    }
 
});

const Coupon = mongoose.model('Coupon', couponSchema);

module.exports = Coupon;
