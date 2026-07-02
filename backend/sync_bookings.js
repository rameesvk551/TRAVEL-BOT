const { sequelize, Booking } = require('./src/models');

async function sync() {
  try {
    await Booking.sync({ alter: true });
    console.log('✅ Bookings table synced successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error syncing Bookings table:', err);
    process.exit(1);
  }
}

sync();
