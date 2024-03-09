const nodemailer = require("nodemailer");
function sendVerificationEmail(email, otp, time) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: 'resbps@gmail.com',
      pass: 'divm qjeo vvab yqbo',
    },
  });

  const mailOptions = {
    from: 'resbps@gmail.com',
    to: email,
    subject: "Email Verification",
    html: `<p>Your one-time password (OTP) for email verification is: <strong>${otp} </strong></p>`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}
module.exports=sendVerificationEmail