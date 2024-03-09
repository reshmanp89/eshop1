const isAdminLoggedIn =(req,res,next)=>{
    if(req.session && req.session.adminLoggedIn)
    {
        next()
    }
    else
    {
        console.log('Admin not logged in. Redirecting to login page.');
        
        res.redirect('/admin')
    }
}

module.exports=isAdminLoggedIn;
