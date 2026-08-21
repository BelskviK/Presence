import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.SUPABASE_DB_HOST,
  port: Number(process.env.SUPABASE_DB_PORT || 5432),
  user: process.env.SUPABASE_DB_USER,
  password: process.env.SUPABASE_DB_PASSWORD,
  database: process.env.SUPABASE_DB_NAME || 'postgres',
  ssl: { rejectUnauthorized: false },
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export const connectDB = async () => {
  try {
    const { rows } = await pool.query('select now()');
    console.log(`✓ Supabase Postgres Connected: ${process.env.SUPABASE_DB_HOST} (server time ${rows[0].now})`);
    return pool;
  } catch (error) {
    console.error(`✗ Supabase Postgres Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await pool.end();
    console.log('✓ Supabase Postgres Disconnected');
  } catch (error) {
    console.error(`✗ Supabase Postgres Disconnection Error: ${error.message}`);
    process.exit(1);
  }
};

export default pool;
