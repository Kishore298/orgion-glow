const { z } = require('zod');

const mobileRegex = /^[6-9]\d{9}$/;
const pincodeRegex = /^[1-9]\d{5}$/;

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  mobile: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit Indian mobile number'),
  email: z.string().trim().email('Enter a valid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  mobile: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(1, 'Password is required'),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email('Enter a valid email address').toLowerCase().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

const forgotPasswordSchema = z.object({
  mobile: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit mobile number'),
});

const resetPasswordSchema = z.object({
  mobile: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit mobile number'),
  otp: z.string().trim().length(6, 'Enter the 6-digit OTP'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const addressSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  mobile: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit mobile number'),
  line1: z.string().trim().min(3, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional().default(''),
  landmark: z.string().trim().max(120).optional().default(''),
  city: z.string().trim().min(2, 'City is required').max(80),
  state: z.string().trim().min(2, 'State is required').max(80),
  pincode: z.string().trim().regex(pincodeRegex, 'Enter a valid 6-digit pincode'),
  type: z.enum(['Home', 'Work', 'Other']).optional().default('Home'),
  isDefault: z.boolean().optional().default(false),
});

const cartItemSchema = z.object({
  productId: z.string().min(1),
  qty: z.number().int().min(1).max(20),
});

const checkoutSchema = z.object({
  cartItems: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(20),
      })
    )
    .min(1, 'Your bag is empty'),
  addressId: z.string().optional(),
  address: addressSchema.optional(),
  saveAddress: z.boolean().optional().default(true),
  email: z.string().trim().email().optional(),
  coupon_code: z.string().trim().max(30).optional(),
  couponCode: z.string().trim().max(30).optional(),
});

const couponValidateSchema = z.object({
  code: z.string().trim().min(1, 'Please enter a coupon code').max(30),
  cart: z
    .array(
      z.object({
        productId: z.string().min(1),
        qty: z.number().int().min(1).max(20),
      })
    )
    .min(1, 'Your bag is empty'),
});

const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

const customerReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500, 'Comment cannot exceed 500 characters').optional().default(''),
});

const contactSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(100),
  email: z.string().trim().email('Valid email is required'),
  mobile: z.string().trim().optional().default(''),
  subject: z.string().trim().max(150).optional().default('Store Inquiry'),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(2000),
});

module.exports = {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  addressSchema,
  cartItemSchema,
  checkoutSchema,
  couponValidateSchema,
  verifyPaymentSchema,
  customerReviewSchema,
  contactSchema,
};
