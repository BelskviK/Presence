import dotenv from 'dotenv';
import app from './src/app.js';
import { connectDB } from './src/config/database.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`\n✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API URL: http://localhost:${PORT}/api\n`);
    });
  } catch (error) {
    console.error('✗ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n✓ SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n✓ SIGINT received, shutting down gracefully...');
  process.exit(0);
});
