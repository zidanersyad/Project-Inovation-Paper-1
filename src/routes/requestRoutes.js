// src/routes/requestRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controller/requestController');

// Request CRUD
router.post('/submit-request', ctrl.submitRequest);
router.get('/requests', ctrl.getAllRequests);
router.get('/requests/:id', ctrl.getRequestById);
router.post('/reassign', ctrl.reassignRequest);
router.post('/complete-request', ctrl.completeRequest);
router.post('/delete-request', ctrl.deleteRequest);

// Admin: Update Service Catalog
router.post('/manual-assignment', ctrl.manualAssignment);
router.post('/update-servicecatalog', ctrl.updateServiceCatalog);

// AI Integration
router.post('/ai/recommend', ctrl.aiRecommend);
router.post('/ai/assign-single', ctrl.aiAssignSingle);

// Debug: get last request created (useful for frontend troubleshooting)
router.get('/debug/last-request', ctrl.getLastRequest);

module.exports = router;