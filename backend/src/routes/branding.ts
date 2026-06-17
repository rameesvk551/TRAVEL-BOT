const { Router } = require('express');
const brandingController = require('../controllers/brandingController');

const router = Router();

// Public — frontend fetches this on boot to theme the app.
router.get('/', brandingController.getBranding);

module.exports = router;
