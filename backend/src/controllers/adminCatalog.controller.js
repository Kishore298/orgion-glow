const Category = require('../models/Category');
const Product = require('../models/Product');
const { slugify } = require('../utils/strings');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

// --- CATEGORIES ---
const listAdminCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
  const enriched = categories.map((c) => ({
    ...c,
    productCount: countMap.get(String(c._id)) || 0,
  }));
  return sendSuccess(res, enriched);
});

const createCategory = asyncHandler(async (req, res) => {
  const { name, slug, image, description, isActive, isFeatured, sortOrder } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'Category name is required');
  const finalSlug = slugify(slug || name);
  const exists = await Category.findOne({ slug: finalSlug });
  if (exists) throw new ApiError(409, 'A category with this slug already exists');

  const category = await Category.create({
    name: name.trim(),
    slug: finalSlug,
    image: image || '',
    description: description || '',
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    isFeatured: Boolean(isFeatured),
    sortOrder: Number(sortOrder || 0),
  });
  return sendSuccess(res, category, 'Category created', 201);
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  const { name, slug, image, description, isActive, isFeatured, sortOrder } = req.body;
  if (name !== undefined) category.name = name.trim();
  if (slug !== undefined) {
    const newSlug = slugify(slug);
    const conflict = await Category.findOne({ slug: newSlug, _id: { $ne: category._id } });
    if (conflict) throw new ApiError(409, 'Category slug already in use');
    category.slug = newSlug;
  }
  if (image !== undefined) category.image = image;
  if (description !== undefined) category.description = description;
  if (isActive !== undefined) category.isActive = Boolean(isActive);
  if (isFeatured !== undefined) category.isFeatured = Boolean(isFeatured);
  if (sortOrder !== undefined) category.sortOrder = Number(sortOrder);

  await category.save();
  return sendSuccess(res, category, 'Category updated');
});

const reorderCategories = asyncHandler(async (req, res) => {
  const { items } = req.body; // [{ id, sortOrder }]
  if (!Array.isArray(items)) throw new ApiError(400, 'Invalid reorder payload');
  await Promise.all(
    items.map((item) =>
      Category.findByIdAndUpdate(item.id, { sortOrder: Number(item.sortOrder || 0) })
    )
  );
  const updated = await Category.find().sort({ sortOrder: 1, name: 1 }).lean();
  return sendSuccess(res, updated, 'Category order saved');
});

const deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);
  if (!category) throw new ApiError(404, 'Category not found');

  const productCount = await Product.countDocuments({ category: category._id });
  if (productCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category with ${productCount} linked product(s). Reassign those products or deactivate the category instead.`
    );
  }

  await category.deleteOne();
  return sendSuccess(res, null, 'Category deleted');
});

// --- PRODUCTS ---
const listAdminProducts = asyncHandler(async (req, res) => {
  const { search, category, inStock, status, page = '1', limit = '20' } = req.query;
  const filter = {};
  if (search && search.trim()) {
    const q = search.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ];
  }
  if (category) filter.category = category;
  if (inStock === 'true') filter.inStock = true;
  if (inStock === 'false') filter.inStock = false;
  if (status) filter.status = status;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    items,
    total,
    page: pageNum,
    totalPages: Math.max(1, Math.ceil(total / limitNum)),
  });
});

const getAdminProduct = asyncHandler(async (req, res) => {
  const ref = req.params.id;
  const query = /^[0-9a-fA-F]{24}$/.test(String(ref)) ? { _id: ref } : { slug: ref };
  const product = await Product.findOne(query)
    .populate('category', 'name slug')
    .populate('relatedProducts', 'name slug price images')
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');
  return sendSuccess(res, product);
});

const createProduct = asyncHandler(async (req, res) => {
  const body = req.body;
  if (!body.name || !body.category || body.price === undefined) {
    throw new ApiError(400, 'Name, category, and price are required');
  }
  const finalSlug = slugify(body.slug || body.name);
  const exists = await Product.findOne({ slug: finalSlug });
  if (exists) throw new ApiError(409, 'A product with this slug already exists');

  const dynamicSeo = {
    title: `${body.name.trim()} — ORGION`,
    description:
      body.shortDescription ||
      String(body.description || '').replace(/\s+/g, ' ').slice(0, 160),
  };

  const product = await Product.create({
    name: body.name.trim(),
    slug: finalSlug,
    category: body.category,
    price: Number(body.price),
    mrp: body.mrp ? Number(body.mrp) : undefined,
    shortDescription: body.shortDescription || '',
    description: body.description || '',
    benefits: Array.isArray(body.benefits) ? body.benefits.filter(Boolean) : [],
    keyIngredients: Array.isArray(body.keyIngredients) ? body.keyIngredients.filter(Boolean) : [],
    howToUse: body.howToUse || '',
    images: Array.isArray(body.images) ? body.images : [],
    weight: body.weight ? Number(body.weight) : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter(Boolean) : [],
    isBestseller: Boolean(body.isBestseller),
    isFeatured: Boolean(body.isFeatured),
    isOffer: Boolean(body.isOffer),
    relatedProducts: Array.isArray(body.relatedProducts) ? body.relatedProducts : [],
    inStock: body.inStock !== undefined ? Boolean(body.inStock) : true,
    status: body.status || 'active',
    seo: dynamicSeo,
    details: body.details || {},
  });

  return sendSuccess(res, product, 'Product created', 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const ref = req.params.id;
  const query = /^[0-9a-fA-F]{24}$/.test(String(ref)) ? { _id: ref } : { slug: ref };
  const product = await Product.findOne(query);
  if (!product) throw new ApiError(404, 'Product not found');

  const body = req.body;
  if (body.slug !== undefined) {
    const newSlug = slugify(body.slug);
    const conflict = await Product.findOne({ slug: newSlug, _id: { $ne: product._id } });
    if (conflict) throw new ApiError(409, 'Product slug already in use');
    product.slug = newSlug;
  }

  const fields = [
    'name',
    'category',
    'price',
    'mrp',
    'shortDescription',
    'description',
    'benefits',
    'keyIngredients',
    'howToUse',
    'images',
    'weight',
    'tags',
    'isBestseller',
    'isFeatured',
    'isOffer',
    'relatedProducts',
    'inStock',
    'status',
    'seo',
    'details',
  ];

  for (const key of fields) {
    if (body[key] !== undefined) {
      product[key] = body[key];
    }
  }

  product.seo = {
    title: `${product.name} — ORGION`,
    description:
      product.shortDescription ||
      String(product.description || '').replace(/\s+/g, ' ').slice(0, 160),
  };

  await product.save();
  return sendSuccess(res, product, 'Product updated');
});

const toggleProductStock = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  product.inStock = req.body.inStock !== undefined ? Boolean(req.body.inStock) : !product.inStock;
  await product.save();
  return sendSuccess(res, product, `Marked as ${product.inStock ? 'In Stock' : 'Out of Stock'}`);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) throw new ApiError(404, 'Product not found');
  await product.deleteOne();
  return sendSuccess(res, null, 'Product deleted');
});

module.exports = {
  listAdminCategories,
  createCategory,
  updateCategory,
  reorderCategories,
  deleteCategory,
  listAdminProducts,
  getAdminProduct,
  createProduct,
  updateProduct,
  toggleProductStock,
  deleteProduct,
};
