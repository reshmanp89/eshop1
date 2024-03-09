const express=require('express')
const router=express.Router();
const addd=require('../')

router.get('/',(req,res)=>{
    res.render('home')
})
module.exports=router