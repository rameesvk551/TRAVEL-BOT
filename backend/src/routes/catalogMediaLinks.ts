// Reel→catalog-item mapping CRUD. Authored on the Property/Package forms; consumed by
// reelResolutionService at comment/DM time. See docs/plans/2026-07-14-reel-catalog-mapping-design.md.

const { Router } = require('express');
const catalogMediaLinkController = require('../controllers/catalogMediaLinkController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

// A reel is linked from a property or package form, so viewing/managing links follows the same
// entitlements as those catalog items.
const viewGuard = requirePermission(PERMISSIONS.PROPERTIES_VIEW, PERMISSIONS.PACKAGES_VIEW);
const manageGuard = requirePermission(PERMISSIONS.PROPERTIES_MANAGE, PERMISSIONS.PACKAGES_MANAGE);

router.get('/', authenticate, viewGuard, catalogMediaLinkController.listLinks);
router.post('/', authenticate, manageGuard, catalogMediaLinkController.createLink);
router.patch('/:id', authenticate, manageGuard, catalogMediaLinkController.updateLink);
router.delete('/:id', authenticate, manageGuard, catalogMediaLinkController.deleteLink);

module.exports = router;
