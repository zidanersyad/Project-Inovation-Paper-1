// index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const appConfig = require('./src/config/appConfig');
const employeeRoutes = require('./src/routes/employeeRoutes');
const requestRoutes = require('./src/routes/requestRoutes');
const logger = require('./src/middleware/logger');
const errorHandler = require('./src/middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger);

// Serve static files (HTML, CSS, JS frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api', employeeRoutes);
app.use('/api', requestRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'ITOD Services API',
    services: {
      employees: '/api/employees',
      requests: '/api/requests',
      ai: '/api/ai/recommend'
    }
  });
});

// Frontend HTML routes - SEBENARNYA TIDAK PERLU karena express.static sudah handle semua file HTML
// Tapi kita tetap definisikan untuk kejelasan
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/request-form.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'request-form.html'));
});

app.get('/admin-dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// ⭐ TAMBAHKAN ROUTE INI - FILE BARU UNTUK WORKLOAD MONITORING
app.get('/workload-monitoring.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'workload-monitoring.html'));
});

// Error handler
app.use(errorHandler);

const PORT = appConfig.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(70));
  console.log(`🚀 Node.js API Server running on http://localhost:${PORT}`);
  console.log('='.repeat(70));
  console.log('\n📱 Available Frontend Pages:');
  console.log(`    http://localhost:${PORT}/index.html`);
  console.log(`    http://localhost:${PORT}/request-form.html`);
  console.log(`    http://localhost:${PORT}/admin-dashboard.html`);
  console.log(`    http://localhost:${PORT}/workload-monitoring.html`);
  console.log('\n🔌 Available API Endpoints:');
  console.log(`    http://localhost:${PORT}/api/employees`);
  console.log(`    http://localhost:${PORT}/api/requests`);
  console.log(`    http://localhost:${PORT}/api/ai/recommend`);
  console.log(`    http://localhost:${PORT}/api/submit-request`);
  console.log(`    http://localhost:${PORT}/api/reassign`);
  console.log(`    http://localhost:${PORT}/api/complete-request`);
  console.log(`    http://localhost:${PORT}/api/delete-request`);
  console.log(`    http://localhost:${PORT}/api/update-servicecatalog`);
  console.log('\n⚠️  Make sure Python AI Service is running on port 5000!');
  console.log('='.repeat(70) + '\n');
});