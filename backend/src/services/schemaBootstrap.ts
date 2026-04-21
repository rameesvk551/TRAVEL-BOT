require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const { sequelize, Sequelize } = require('../models');

async function tableExists(tableName) {
  const [rows] = await sequelize.query(
    `select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = :tableName
    ) as exists`,
    {
      replacements: { tableName },
    }
  );

  return Boolean(rows?.[0]?.exists);
}

async function ensureColumn(tableName, columnName, definition) {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable(tableName);

  if (table[columnName]) {
    return;
  }

  await queryInterface.addColumn(tableName, columnName, definition);
  console.log(`[SchemaBootstrap] Added ${tableName}.${columnName}`);
}

async function ensureEnumValues(typeName, values) {
  for (const value of values) {
    await sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`[SchemaBootstrap] Ensured ${typeName}.${value}`);
  }
}

async function ensureAgenciesSchema() {
  await ensureColumn('agencies', 'auto_review_collection_enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });

  await ensureColumn('agencies', 'auto_review_delay_days', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 2,
  });

  await ensureColumn('agencies', 'follow_up_reminder_enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });

  await ensureColumn('agencies', 'follow_up_reminder_minutes', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 30,
  });
}

async function ensureLeadsSchema() {
  await ensureEnumValues('enum_leads_status', [
    'JUST_CONTACTED',
    'PACKAGE_SEARCHED',
    'PACKAGE_INTERESTED',
    'NEW',
    'ENQUIRY',
    'CONTACTED',
    'QUOTED',
    'NEGOTIATING',
    'BOOKED',
    'CONVERTED',
    'LOST',
    'CANCELLED',
    'UNKNOWN',
  ]);

  await ensureColumn('leads', 'ad_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'ad_headline', {
    type: Sequelize.STRING(500),
    allowNull: true,
  });

  await ensureColumn('leads', 'ad_source_url', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
}

async function ensureCustomersSchema() {
  await ensureColumn('customers', 'email', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('customers', 'is_customer', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  await ensureColumn('customers', 'documents', {
    type: Sequelize.JSON,
    allowNull: false,
    defaultValue: [],
  });
}

async function ensureBookingsSchema() {
  await ensureColumn('bookings', 'itinerary_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  // Bookings can now be created directly from a customer without an originating lead.
  await sequelize.getQueryInterface().changeColumn('bookings', 'lead_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });
  console.log('[SchemaBootstrap] Updated bookings.lead_id to allow null');
}

async function ensureItinerariesSchema() {
  await ensureColumn('itineraries', 'package_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });
}

async function ensureFollowUpsTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists('follow_ups')) {
    await ensureColumn('follow_ups', 'agent_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await ensureColumn('follow_ups', 'notification_sent', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    return;
  }

  await queryInterface.createTable('follow_ups', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    lead_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    agency_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    agent_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    scheduled_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    note: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    status: {
      type: Sequelize.ENUM('Scheduled', 'Done', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Scheduled',
    },
    notification_sent: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('follow_ups', ['lead_id']);
  await queryInterface.addIndex('follow_ups', ['agency_id', 'agent_id']);
  await queryInterface.addIndex('follow_ups', ['scheduled_at', 'status', 'notification_sent']);
  console.log('[SchemaBootstrap] Created follow_ups table');
}

async function ensureLeadNotesTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists('lead_notes')) {
    return;
  }

  await queryInterface.createTable('lead_notes', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    lead_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    agent_id: {
      type: Sequelize.UUID,
      allowNull: true,
    },
    content: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
  });

  await queryInterface.addIndex('lead_notes', ['lead_id']);
  console.log('[SchemaBootstrap] Created lead_notes table');
}

async function ensureProductionSchema() {
  await ensureLeadsSchema();
  await ensureAgenciesSchema();
  await ensureCustomersSchema();
  await ensureBookingsSchema();
  await ensureItinerariesSchema();
  await ensureFollowUpsTable();
  await ensureLeadNotesTable();
}

module.exports = {
  ensureProductionSchema,
};
