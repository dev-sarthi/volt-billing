const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');
const upload = require('../middleware/upload');

router.get('/apply', publicController.showApplyForm);
router.post('/apply', upload.array('documents', 5), publicController.submitApplication);

module.exports = router;
