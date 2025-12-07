// src/controller/employeeController.js
const employees = require('../data/employees');

// GET /api/employees
exports.getAll = (req, res) => {
  // optional query: ?unit=... or ?attendance=... or years filters
  const { unit, attendance, years, min_years, max_years } = req.query;
  let data = employees;

  if (unit) {
    data = data.filter(e => e.unit.toLowerCase().includes(String(unit).toLowerCase()));
  }
  if (attendance) {
    data = data.filter(e => e.attendance === attendance);
  }

  if (years) {
    const y = Number(years);
    data = data.filter(e => Number(e.years_of_service) === y);
  }
  if (min_years) {
    const minY = Number(min_years);
    data = data.filter(e => Number(e.years_of_service) >= minY);
  }
  if (max_years) {
    const maxY = Number(max_years);
    data = data.filter(e => Number(e.years_of_service) <= maxY);
  }

  res.json({ status: 'success', count: data.length, data });
};

// GET /api/employees/:id
exports.getById = (req, res) => {
  const id = Number(req.params.id);
  const item = employees.find(e => e.id === id);
  if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
  res.json({ status: 'success', data: item });
};

// GET /api/employees/by-name/:name
exports.getByName = (req, res) => {
  const name = req.params.name;
  const item = employees.find(e => e.name.toLowerCase().includes(name.toLowerCase()));
  if (!item) return res.status(404).json({ status: 'error', message: 'Not found' });
  res.json({ status: 'success', data: item });
};

// POST /api/employees
// body: { name, unit, attendance(optional) }
exports.create = (req, res) => {
  const { name, unit, attendance } = req.body;
  if (!name || !unit) return res.status(400).json({ status: 'error', message: 'name and unit required' });
  const id = employees.length ? Math.max(...employees.map(e=>e.id)) + 1 : 1;
  const newItem = { id, name, unit, attendance: attendance || 'bekerja' };
  employees.push(newItem);
  res.status(201).json({ status: 'created', data: newItem });
};

// PUT /api/employees/:id
exports.update = (req, res) => {
  const id = Number(req.params.id);
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Not found' });
  const { name, unit, attendance } = req.body;
  if (name) employees[idx].name = name;
  if (unit) employees[idx].unit = unit;
  if (attendance) employees[idx].attendance = attendance;
  res.json({ status: 'updated', data: employees[idx] });
};

// DELETE /api/employees/:id
exports.remove = (req, res) => {
  const id = Number(req.params.id);
  const idx = employees.findIndex(e => e.id === id);
  if (idx === -1) return res.status(404).json({ status: 'error', message: 'Not found' });
  const removed = employees.splice(idx, 1)[0];
  res.json({ status: 'deleted', data: removed });
};

// POST /api/attendance/generate
// body optional: { seedRandomChance: 0.5 } -> chance to be 'cuti' (0..1)
exports.generateAttendance = (req, res) => {
  const chance = typeof req.body?.seedRandomChance === 'number' ? req.body.seedRandomChance : 0.5;
  employees.forEach(e => {
    e.attendance = (Math.random() < chance) ? 'cuti' : 'bekerja';
  });
  res.json({ status: 'ok', message: 'Attendance regenerated', count: employees.length });
};

// GET /api/attendance
// returns summary counts + optionally list (?attendance=bekerja)
exports.getAttendance = (req, res) => {
  const { attendance } = req.query; // optional filter
  const list = attendance ? employees.filter(e => e.attendance === attendance) : employees;
  const counts = employees.reduce((acc, cur) => {
    acc[cur.attendance] = (acc[cur.attendance] || 0) + 1;
    return acc;
  }, {});
  res.json({ status: 'success', counts, list });
};

// NEW: explicit filter and grouping helpers
// GET /api/employees/filter?years=5
exports.filterByYears = (req, res) => {
  const { years, min, max } = req.query;
  let data = employees;

  if (years) {
    const y = Number(years);
    data = data.filter(e => Number(e.years_of_service) === y);
  } else {
    if (min) {
      const minY = Number(min);
      data = data.filter(e => Number(e.years_of_service) >= minY);
    }
    if (max) {
      const maxY = Number(max);
      data = data.filter(e => Number(e.years_of_service) <= maxY);
    }
  }

  res.json({ status: 'success', count: data.length, data });
};

// GET /api/units/group
exports.groupByUnit = (req, res) => {
  const { list } = req.query;
  const groups = employees.reduce((acc, cur) => {
    const key = cur.unit || 'Unknown';
    if (!acc[key]) acc[key] = { count: 0, items: [] };
    acc[key].count += 1;
    acc[key].items.push(cur);
    return acc;
  }, {});

  if (list === 'true') {
    res.json({ status: 'success', groups });
    return;
  }

  const summary = Object.keys(groups).map(u => ({ unit: u, count: groups[u].count }));
  res.json({ status: 'success', count: summary.length, data: summary });
};