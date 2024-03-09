function calculateSubtotal(cartProducts)
{
    let subtotal=0;
    for(const cartItem of cartProducts)
    {
        const {quantity,product}=cartItem;
        subtotal+=quantity*product.price
    }
    return subtotal
}
module.exports=calculateSubtotal