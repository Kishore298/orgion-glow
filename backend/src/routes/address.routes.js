const express = require('express');
const addressController = require('../controllers/address.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { addressSchema } = require('../validators/schemas');

const router = express.Router();

router.use(authenticate);
router.get('/', addressController.getAddresses);
router.post('/', validate(addressSchema), addressController.addAddress);
router.patch('/:addressId', validate(addressSchema.partial()), addressController.updateAddress);
router.patch('/:addressId/default', addressController.setDefaultAddress);
router.delete('/:addressId', addressController.deleteAddress);

module.exports = router;
