const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'travelbot',
});

async function checkBookingsTable() {
  try {
    const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'bookings'");
    console.log(res.rows.map(r => r.column_name));
    pool.end();
  } catch (err) {
    console.error(err);
    pool.end();
  }
}

checkBookingsTable();
