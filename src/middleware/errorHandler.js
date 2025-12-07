// src/middleware/errorHandler.js
module.exports = (err, req, res, next) => {
  console.error('[ERROR Handler]', err);
  
  // Ensure we always return JSON
  res.setHeader('Content-Type', 'application/json');
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({ 
    status: 'error', 
    message: message,
    timestamp: new Date().toISOString()
  });
};