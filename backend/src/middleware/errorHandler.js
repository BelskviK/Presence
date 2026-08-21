export const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Postgres unique constraint violation
  if (err.code === '23505') {
    return res.status(400).json({
      success: false,
      message: `${err.constraint || 'Value'} already exists`,
    });
  }

  // Postgres check/not-null constraint violation
  if (err.code === '23514' || err.code === '23502') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Default error
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
};

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
