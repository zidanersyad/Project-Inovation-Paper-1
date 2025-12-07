// src/routes/employeeRoutes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controller/employeeController');

// Employees CRUD + flexible filtering
router.get('/employees', ctrl.getAll);
router.get('/employees/:id', ctrl.getById);
router.get('/employees/by-name/:name', ctrl.getByName); // NEW
router.post('/employees', ctrl.create);
router.put('/employees/:id', ctrl.update);
router.delete('/employees/:id', ctrl.remove);

// Explicit filter route (optional)
router.get('/employees/filter', ctrl.filterByYears);

// Attendance endpoints
router.post('/attendance/generate', ctrl.generateAttendance);
router.get('/attendance', ctrl.getAttendance);

// Grouping / aggregation
router.get('/units/group', ctrl.groupByUnit);

module.exports = router;