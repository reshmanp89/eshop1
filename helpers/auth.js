
const User=require('../models/user')

const isAuthenticated=async(req,res,next)=>{
    try{
     if(req.session.userLoggedIn)
     {
        next()
     }
    else{
        res.redirect('/user/login')
    }
    }
    catch(error)

    {
        console.log(error);
        res.status(500).send('Internal server error')
    }

}
const isBlockedByAdmin =async(req,res,next)=>{
    try{
         if(req.session.userLoggedIn)
         {
            const loggedInUserId=  req.session.userId ;
            const loggedInUser= await User.findById(loggedInUserId);
            if(loggedInUser.blocked)
            {
                res.redirect('/')
            }
            else{
                next()
            }
         }
         else{
            res.redirect('/user/login')
         }
    }
    catch(error)
    {
        console.log(error);
        res.status(500).send('Internal server error') 
    }
}

module.exports={isAuthenticated,isBlockedByAdmin}