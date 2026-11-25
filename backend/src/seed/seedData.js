const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Review = require('../models/Review');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const NotificationLog = require('../models/NotificationLog');

async function seed() {
  await connectDB();

  console.log('[Seed] Cleaning existing mock products, customers, orders, carts, and reviews...');
  await Promise.all([
    Product.deleteMany({}),
    Review.deleteMany({}),
    Order.deleteMany({}),
    Cart.deleteMany({}),
    NotificationLog.deleteMany({}),
    User.deleteMany({ role: 'customer' }),
  ]);

  console.log('[Seed] Replacing admin & ensuring staff accounts...');
  await User.deleteMany({ role: 'admin' });
  const [adminHash, staffHash] = await Promise.all([
    bcrypt.hash('Admin@12345', 12),
    bcrypt.hash('Staff@12345', 12),
  ]);

  await User.create({
    name: 'ORGION Admin',
    mobile: '9360910640',
    email: 'orgion.we@gmail.com',
    passwordHash: adminHash,
    role: 'admin',
    isBlocked: false,
  });

  await User.findOneAndUpdate(
    { mobile: '9876500002' },
    {
      name: 'Fulfilment Staff',
      mobile: '9876500002',
      email: 'staff@orgion.in',
      passwordHash: staffHash,
      role: 'staff',
      isBlocked: false,
    },
    { upsert: true, new: true }
  );

  console.log('[Seed] Upserting categories (using logo fallback until admin uploads images)...');
  const skinCare = await Category.findOneAndUpdate(
    { slug: 'skin-care' },
    {
      name: 'Skin Care',
      slug: 'skin-care',
      description:
        'Handmade skincare crafted with carefully selected natural ingredients for daily radiance.',
      image: '',
      isActive: true,
      isFeatured: true,
      sortOrder: 0,
    },
    { upsert: true, new: true }
  );

  const lipCare = await Category.findOneAndUpdate(
    { slug: 'lip-care' },
    {
      name: 'Lip Care',
      slug: 'lip-care',
      description:
        'Pure handmade lip balms crafted with gentle botanicals for soft, nourished lips.',
      image: '',
      isActive: true,
      isFeatured: true,
      sortOrder: 1,
    },
    { upsert: true, new: true }
  );

  console.log('[Seed] Inserting ORGION products...');
  const glowxSoap = await Product.create({
    name: 'GlowX – Saffron & Licorice Glow Soap',
    slug: 'glowx-saffron-licorice-glow-soap',
    category: skinCare._id,
    price: 139,
    mrp: 169,
    shortDescription:
      'Thoughtfully crafted bathing bar enriched with Saffron, Licorice (Mulethi), Vitamin E Oil, and nourishing Butter.',
    description:
      "Reveal your skin's natural radiance with Orgion GlowX Soap, a thoughtfully crafted bathing bar enriched with the goodness of Saffron, Licorice (Mulethi), Vitamin E Oil, and nourishing Butter.\n\nIts skin-loving ingredients help cleanse the skin while keeping it feeling soft, smooth, and refreshed. Saffron and Licorice are traditionally valued in skincare for promoting a brighter-looking, more even-looking complexion.",
    benefits: [
      'Helps improve the appearance of dull skin.',
      'Supports a brighter and more radiant-looking complexion.',
      'Helps improve the appearance of uneven skin tone.',
      'Keeps skin feeling soft, smooth, and nourished.',
      "Helps maintain skin's natural freshness.",
    ],
    keyIngredients: [
      'Saffron Extract',
      'Licorice (Mulethi)',
      'Vitamin E Oil',
      'Nourishing Butter',
    ],
    howToUse:
      "Wet your skin, gently apply GlowX Soap to create a rich lather, and rinse thoroughly with water. Suitable for daily use, depending on your skin's tolerance.",
    images: [],
    weight: 100,
    tags: ['soap', 'saffron', 'licorice', 'glow', 'bestseller'],
    isBestseller: true,
    isFeatured: true,
    inStock: true,
    status: 'active',
    details: {
      brand: 'Orgion',
      productName: 'GlowX Soap',
      skinType: 'Suitable for all skin types',
      closingLine: 'Glow naturally. Shine confidently. GlowX by Orgion!',
    },
  });

  const avoglowCream = await Product.create({
    name: 'Avoglow Night Cream',
    slug: 'avoglow-night-cream-25g',
    category: skinCare._id,
    price: 0,
    shortDescription: 'Handmade nourishing night cream (25g). Price and full details coming soon.',
    description:
      'Handmade botanical night cream (25g) formulated by Orgion. Full description and pricing will be updated shortly.',
    benefits: [],
    keyIngredients: [],
    howToUse: '',
    images: [],
    weight: 25,
    tags: ['night cream', 'skincare', 'avoglow'],
    isBestseller: false,
    isFeatured: true,
    inStock: true,
    status: 'active',
    details: {
      brand: 'Orgion',
      productName: 'Avoglow Night Cream',
      skinType: 'Suitable for all skin types',
      closingLine: '',
    },
  });

  const pigmentFreeLipbalm = await Product.create({
    name: 'Pigment Free Lip Balm',
    slug: 'pigment-free-lipbalm',
    category: lipCare._id,
    price: 0,
    shortDescription: 'Gentle handmade lip balm with zero added pigments. Price and full details coming soon.',
    description:
      'Handmade pigment-free lip balm crafted by Orgion. Full description and pricing will be updated shortly.',
    benefits: [],
    keyIngredients: [],
    howToUse: '',
    images: [],
    weight: 15,
    tags: ['lip balm', 'pigment free', 'lip care'],
    isBestseller: false,
    isFeatured: true,
    inStock: true,
    status: 'active',
    details: {
      brand: 'Orgion',
      productName: 'Pigment Free Lip Balm',
      skinType: 'Suitable for all skin types',
      closingLine: '',
    },
  });

  // Link pairings
  await Product.findByIdAndUpdate(glowxSoap._id, {
    relatedProducts: [avoglowCream._id, pigmentFreeLipbalm._id],
  });

  console.log('[Seed] Done! Mock customers/products cleared. Added 3 ORGION products.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
