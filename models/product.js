const mongoose=require('mongoose')

 
 const productSchema = new mongoose.Schema({

     productName:{
        type:String,
        required:true
     },
     description:{
        type:String,
        required:true
     },
     image:{
        type:String,
        default:''
     },
     images:[{
        type:String,
        default:''
     }],
     brand:{
        type:String,
        default:''
     },
     price:{
        type:Number,
        default:0
     },
     category:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'category',
        required:true

     },
     quantity:{
        type:Number,
        default:0
     },
     rating:{
        type:Number,
        default:0
     },
     dateCreated:{
        type:Date,
        default:Date.now,
     },
     deleted:{
        type:Boolean,
        default:false
     }

 })
const Product=mongoose.model('product',productSchema)
module.exports=Product;