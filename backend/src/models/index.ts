// FILE: /backend/src/models/index.js
// DEPS: sequelize, pg, pg-hstore
// ENV: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

const { Sequelize } = require('sequelize');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME || 'travelbot',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

// Import models
const Agency = require('./Agency')(sequelize);
const Agent = require('./Agent')(sequelize);
const RefreshToken = require('./RefreshToken')(sequelize);
const Customer = require('./Customer')(sequelize);
const Lead = require('./Lead')(sequelize);
const Package = require('./Package')(sequelize);
const Booking = require('./Booking')(sequelize);
const Payment = require('./Payment')(sequelize);
const Message = require('./Message')(sequelize);
const BotSession = require('./BotSession')(sequelize);
const ScheduledJob = require('./ScheduledJob')(sequelize);

// ===== ASSOCIATIONS =====

// Agency has many
Agency.hasMany(Agent, { foreignKey: 'agencyId', as: 'agents' });
Agency.hasMany(Customer, { foreignKey: 'agencyId', as: 'customers' });
Agency.hasMany(Lead, { foreignKey: 'agencyId', as: 'leads' });
Agency.hasMany(Package, { foreignKey: 'agencyId', as: 'packages' });
Agency.hasMany(Booking, { foreignKey: 'agencyId', as: 'bookings' });
Agency.hasMany(Payment, { foreignKey: 'agencyId', as: 'payments' });
Agency.hasMany(Message, { foreignKey: 'agencyId', as: 'messages' });
Agency.hasMany(BotSession, { foreignKey: 'agencyId', as: 'botSessions' });
Agency.hasMany(ScheduledJob, { foreignKey: 'agencyId', as: 'scheduledJobs' });

// Agent belongs to Agency
Agent.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Agent.hasMany(RefreshToken, { foreignKey: 'agentId', as: 'refreshTokens' });
Agent.hasMany(Lead, { foreignKey: 'assignedAgentId', as: 'assignedLeads' });
Agent.hasMany(Message, { foreignKey: 'agentId', as: 'sentMessages' });

// RefreshToken belongs to Agent
RefreshToken.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// Customer belongs to Agency
Customer.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Customer.hasMany(Lead, { foreignKey: 'customerId', as: 'leads' });
Customer.hasMany(Booking, { foreignKey: 'customerId', as: 'bookings' });
Customer.hasMany(Message, { foreignKey: 'customerId', as: 'messages' });
Customer.hasOne(BotSession, { foreignKey: 'customerId', as: 'botSession' });

// Lead belongs to Customer, Agency, Agent, Package
Lead.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Lead.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Lead.belongsTo(Agent, { foreignKey: 'assignedAgentId', as: 'assignedAgent' });
Lead.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Lead.hasOne(Booking, { foreignKey: 'leadId', as: 'booking' });

// Package belongs to Agency
Package.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Package.hasMany(Lead, { foreignKey: 'packageId', as: 'leads' });
Package.hasMany(Booking, { foreignKey: 'packageId', as: 'bookings' });

// Booking
Booking.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Booking.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Booking.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Booking.belongsTo(Package, { foreignKey: 'packageId', as: 'package' });
Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Booking.hasMany(ScheduledJob, { foreignKey: 'bookingId', as: 'scheduledJobs' });

// Payment
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
Payment.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

// Message
Message.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
Message.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
Message.belongsTo(Agent, { foreignKey: 'agentId', as: 'agent' });

// BotSession
BotSession.belongsTo(Customer, { foreignKey: 'customerId', as: 'customer' });
BotSession.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });
BotSession.belongsTo(Agent, { foreignKey: 'handedOffToId', as: 'handedOffTo' });

// ScheduledJob
ScheduledJob.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });
ScheduledJob.belongsTo(Agency, { foreignKey: 'agencyId', as: 'agency' });

module.exports = {
  sequelize,
  Sequelize,
  Agency,
  Agent,
  RefreshToken,
  Customer,
  Lead,
  Package,
  Booking,
  Payment,
  Message,
  BotSession,
  ScheduledJob,
};
