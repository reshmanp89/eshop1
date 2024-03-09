
const mongoose = require('mongoose');

const orderaddressSchema = new mongoose.Schema({
  street: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  state: {
    type: String,
    required: true,
  },
  pincode: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
  },
});

const Address = mongoose.model('orderaddress', orderaddressSchema);

module.exports = Address;
