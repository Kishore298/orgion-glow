const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { roundMoney } = require('../utils/currency');
const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

async function buildValidatedCartResponse(cartItems, clientSnapshot = []) {
  const ids = cartItems.map((i) => i.product);
  const products = await Product.find({ _id: { $in: ids } }).lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const snapshotMap = new Map(clientSnapshot.map((s) => [String(s.productId), s]));

  const items = [];
  const notices = [];
  let subtotal = 0;
  let totalWeight = 0;

  for (const entry of cartItems) {
    const pid = String(entry.product);
    const prod = productMap.get(pid);
    if (!prod || prod.status !== 'active') {
      notices.push('An item in your bag is no longer available and was removed.');
      continue;
    }

    const snap = snapshotMap.get(pid);
    if (snap && snap.price !== undefined && Number(snap.price) !== Number(prod.price)) {
      notices.push(`Price for "${prod.name}" updated to ₹${prod.price}.`);
    }
    if (!prod.inStock) {
      notices.push(`"${prod.name}" is currently out of stock.`);
    }

    const primaryImage =
      prod.images?.find((img) => img.isPrimary)?.url || prod.images?.[0]?.url || '';
    const lineTotal = prod.inStock ? roundMoney(prod.price * entry.qty) : 0;
    subtotal = roundMoney(subtotal + lineTotal);
    totalWeight += Number(prod.weight || 0) * entry.qty;

    items.push({
      productId: prod._id,
      slug: prod.slug,
      name: prod.name,
      price: prod.price,
      mrp: prod.mrp,
      image: primaryImage,
      inStock: prod.inStock,
      weight: prod.weight || 0,
      qty: entry.qty,
      lineTotal,
    });
  }

  return { items, subtotal, totalWeight, notices };
}

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return sendSuccess(res, { items: [], subtotal: 0, totalWeight: 0, notices: [] });
  }
  const validated = await buildValidatedCartResponse(cart.items);
  return sendSuccess(res, validated);
});

const validateGuestCart = asyncHandler(async (req, res) => {
  const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];
  const mapped = rawItems
    .filter((i) => i.productId && Number(i.qty) > 0)
    .map((i) => ({ product: i.productId, qty: Math.min(20, Math.max(1, Number(i.qty))) }));
  const validated = await buildValidatedCartResponse(mapped, rawItems);
  return sendSuccess(res, validated);
});

const syncCart = asyncHandler(async (req, res) => {
  const guestItems = Array.isArray(req.body?.items) ? req.body.items : [];
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  for (const g of guestItems) {
    if (!g.productId || Number(g.qty) <= 0) continue;
    const existing = cart.items.find((i) => String(i.product) === String(g.productId));
    if (existing) {
      existing.qty = Math.min(20, existing.qty + Number(g.qty));
    } else {
      cart.items.push({ product: g.productId, qty: Math.min(20, Number(g.qty)) });
    }
  }

  // Keep only active products
  const validProducts = await Product.find({
    _id: { $in: cart.items.map((i) => i.product) },
    status: 'active',
  }).select('_id');
  const validSet = new Set(validProducts.map((p) => String(p._id)));
  cart.items = cart.items.filter((i) => validSet.has(String(i.product)));
  await cart.save();

  const validated = await buildValidatedCartResponse(cart.items, guestItems);
  return sendSuccess(res, validated, 'Bag synced');
});

const addToCart = asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const product = await Product.findOne({ _id: productId, status: 'active' });
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.inStock) throw new ApiError(400, 'This product is currently out of stock');
  if (Number(product.price) <= 0) throw new ApiError(400, 'Pricing for this product is coming soon');

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = new Cart({ user: req.user._id, items: [] });
  }

  const existing = cart.items.find((i) => String(i.product) === String(productId));
  if (existing) {
    existing.qty = Math.min(20, existing.qty + qty);
  } else {
    cart.items.push({ product: productId, qty });
  }
  await cart.save();

  const validated = await buildValidatedCartResponse(cart.items);
  return sendSuccess(res, validated, 'Added to bag');
});

const updateCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const qty = Number(req.body.qty);

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    return sendSuccess(res, { items: [], subtotal: 0, totalWeight: 0, notices: [] });
  }

  if (qty <= 0) {
    cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
  } else {
    const item = cart.items.find((i) => String(i.product) === String(productId));
    if (item) {
      item.qty = Math.min(20, qty);
    }
  }
  await cart.save();

  const validated = await buildValidatedCartResponse(cart.items);
  return sendSuccess(res, validated, 'Bag updated');
});

const removeCartItem = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const cart = await Cart.findOne({ user: req.user._id });
  if (cart) {
    cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
    await cart.save();
  }
  const validated = cart
    ? await buildValidatedCartResponse(cart.items)
    : { items: [], subtotal: 0, totalWeight: 0, notices: [] };
  return sendSuccess(res, validated, 'Item removed from bag');
});

module.exports = {
  getCart,
  validateGuestCart,
  syncCart,
  addToCart,
  updateCartItem,
  removeCartItem,
};
