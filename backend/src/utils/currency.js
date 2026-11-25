/**
 * Consistent INR money utilities.
 * DB prices & order totals are stored in INR as Numbers rounded to 2 decimals.
 * Razorpay API calls use integer paise via toPaise() / fromPaise().
 */

function roundMoney(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function toPaise(inrAmount) {
  return Math.round(roundMoney(inrAmount) * 100);
}

function fromPaise(paiseAmount) {
  return roundMoney(Number(paiseAmount || 0) / 100);
}

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatINR(amount) {
  return inrFormatter.format(roundMoney(amount));
}

module.exports = {
  roundMoney,
  toPaise,
  fromPaise,
  formatINR,
};
