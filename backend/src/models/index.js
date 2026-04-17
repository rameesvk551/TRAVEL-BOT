// Thin CJS shim so require('/backend/src/models') works in production.
// This avoids MODULE_NOT_FOUND when code resolves the models directory.
module.exports = require('./index.ts');
