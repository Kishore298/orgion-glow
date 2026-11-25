const Category = require('../models/Category');
const Product = require('../models/Product');
const Review = require('../models/Review');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const listCategories = asyncHandler(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.featured === 'true') {
    filter.isFeatured = true;
  }
  const categories = await Category.find(filter).sort({ sortOrder: 1, name: 1 }).lean();
  return sendSuccess(res, categories);
});

const getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true }).lean();
  if (!category) throw new ApiError(404, 'Category not found');
  return sendSuccess(res, category);
});

const listProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    inStock,
    featured,
    bestseller,
    sort = 'featured',
    page = '1',
    limit = '12',
  } = req.query;

  const filter = { status: 'active' };

  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { shortDescription: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ];
  }

  if (category) {
    const slugs = String(category)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (slugs.length > 0) {
      const cats = await Category.find({ slug: { $in: slugs }, isActive: true }).select('_id');
      filter.category = { $in: cats.map((c) => c._id) };
    }
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined && minPrice !== '') filter.price.$gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== '') filter.price.$lte = Number(maxPrice);
  }

  if (inStock === 'true') filter.inStock = true;
  if (featured === 'true') filter.isFeatured = true;
  if (bestseller === 'true') filter.isBestseller = true;

  const sortMap = {
    featured: { isBestseller: -1, isFeatured: -1, createdAt: -1 },
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    newest: { createdAt: -1 },
    rating: { ratingAvg: -1, ratingCount: -1 },
  };
  const sortOrder = sortMap[sort] || sortMap.featured;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(48, Math.max(1, parseInt(limit, 10) || 12));
  const skip = (pageNum - 1) * limitNum;

  const [items, total, maxPriceDoc] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort(sortOrder)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
    Product.findOne({ status: 'active' }).sort({ price: -1 }).select('price').lean(),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
    catalogMaxPrice: maxPriceDoc?.price || 2000,
  });
});

const getProductBySlug = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: 'active' })
    .populate('category', 'name slug')
    .populate({
      path: 'relatedProducts',
      match: { status: 'active' },
      select: 'name slug price mrp images inStock ratingAvg ratingCount shortDescription',
    })
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  // Fallback related products from same category if relatedProducts not explicitly assigned
  if (!product.relatedProducts || product.relatedProducts.length === 0) {
    product.relatedProducts = await Product.find({
      category: product.category?._id,
      _id: { $ne: product._id },
      status: 'active',
    })
      .select('name slug price mrp images inStock ratingAvg ratingCount shortDescription')
      .limit(4)
      .lean();
  }

  return sendSuccess(res, product);
});

const getProductReviews = asyncHandler(async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, status: 'active' })
    .select('_id name slug ratingAvg ratingCount ratingBreakdown')
    .lean();
  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const pageNum = Math.max(1, parseInt(req.query.page || '1', 10));
  const limitNum = Math.min(30, Math.max(1, parseInt(req.query.limit || '10', 10)));
  const sortKey = req.query.sort || 'newest';
  const sortMap = {
    newest: { reviewDate: -1, createdAt: -1 },
    highest: { rating: -1, reviewDate: -1 },
    lowest: { rating: 1, reviewDate: -1 },
  };

  const filter = { product: product._id, status: 'visible' };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort(sortMap[sortKey] || sortMap.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('-createdBy -user -order')
      .lean(),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    summary: {
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      ratingBreakdown: product.ratingBreakdown,
    },
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

const listPublicReviews = asyncHandler(async (req, res) => {
  const { product, featured, page = '1', limit = '12' } = req.query;
  const filter = { status: 'visible' };
  if (product) {
    if (/^[0-9a-fA-F]{24}$/.test(String(product))) {
      filter.product = product;
    } else {
      const prodDoc = await Product.findOne({ slug: product }).select('_id').lean();
      filter.product = prodDoc ? prodDoc._id : null;
    }
  }
  if (featured === 'true') {
    filter.isFeatured = true;
    filter.source = 'whatsapp';
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('product', 'name slug images')
      .sort({ reviewDate: -1, createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .select('-createdBy -user -order')
      .lean(),
    Review.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

module.exports = {
  listCategories,
  getCategoryBySlug,
  listProducts,
  getProductBySlug,
  getProductReviews,
  listPublicReviews,
};
