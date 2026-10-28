export function errorHandler(err, req, res, next) {
  console.error('[API Error]:', err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ detail: message });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ detail: `Route not found: ${req.method} ${req.path}` });
}

