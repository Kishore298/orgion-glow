const { ApiError, asyncHandler, sendSuccess } = require('../utils/apiResponse');

const getAddresses = asyncHandler(async (req, res) => {
  return sendSuccess(res, req.user.addresses || []);
});

const addAddress = asyncHandler(async (req, res) => {
  const payload = req.body;
  if (payload.isDefault || req.user.addresses.length === 0) {
    req.user.addresses.forEach((a) => {
      a.isDefault = false;
    });
    payload.isDefault = true;
  }

  req.user.addresses.push(payload);
  await req.user.save();
  const created = req.user.addresses[req.user.addresses.length - 1];
  return sendSuccess(
    res,
    { address: created, addresses: req.user.addresses },
    'Address added',
    201
  );
});

const updateAddress = asyncHandler(async (req, res) => {
  const addr = req.user.addresses.id(req.params.addressId);
  if (!addr) {
    throw new ApiError(404, 'Address not found');
  }

  if (req.body.isDefault) {
    req.user.addresses.forEach((a) => {
      a.isDefault = false;
    });
  }

  Object.assign(addr, req.body);
  await req.user.save();
  return sendSuccess(res, { address: addr, addresses: req.user.addresses }, 'Address updated');
});

const deleteAddress = asyncHandler(async (req, res) => {
  const addr = req.user.addresses.id(req.params.addressId);
  if (!addr) {
    throw new ApiError(404, 'Address not found');
  }
  const wasDefault = addr.isDefault;
  addr.deleteOne();

  if (wasDefault && req.user.addresses.length > 0) {
    req.user.addresses[0].isDefault = true;
  }

  await req.user.save();
  return sendSuccess(res, req.user.addresses, 'Address deleted');
});

const setDefaultAddress = asyncHandler(async (req, res) => {
  const addr = req.user.addresses.id(req.params.addressId);
  if (!addr) {
    throw new ApiError(404, 'Address not found');
  }
  req.user.addresses.forEach((a) => {
    a.isDefault = String(a._id) === String(req.params.addressId);
  });
  await req.user.save();
  return sendSuccess(res, req.user.addresses, 'Default address updated');
});

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
