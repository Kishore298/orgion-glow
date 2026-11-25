const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');

/**
 * Recalculates ratingAvg (1 decimal), ratingCount, and ratingBreakdown (1..5)
 * on Product from all visible reviews (both 'whatsapp' and 'customer' sources).
 *
 * @param {string|mongoose.Types.ObjectId} productId
 * @param {object} [deps] optional injected models for unit testing
 */
async function recalcProductRating(productId, deps = {}) {
  const ReviewModel = deps.Review || Review;
  const ProductModel = deps.Product || Product;

  const objectId =
    typeof productId === 'string' && mongoose.Types.ObjectId.isValid(productId)
      ? new mongoose.Types.ObjectId(productId)
      : productId;

  const agg = await ReviewModel.aggregate([
    { $match: { product: objectId, status: 'visible' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
  ]);

  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalCount = 0;
  let weightedSum = 0;

  for (const row of agg) {
    const stars = Number(row._id);
    const cnt = Number(row.count || 0);
    if (stars >= 1 && stars <= 5) {
      breakdown[stars] = cnt;
      totalCount += cnt;
      weightedSum += stars * cnt;
    }
  }

  const ratingAvg = totalCount > 0 ? Math.round((weightedSum / totalCount) * 10) / 10 : 0;

  await ProductModel.findByIdAndUpdate(objectId, {
    ratingAvg,
    ratingCount: totalCount,
    ratingBreakdown: breakdown,
  });

  return { ratingAvg, ratingCount: totalCount, ratingBreakdown: breakdown };
}

module.exports = {
  recalcProductRating,
};
