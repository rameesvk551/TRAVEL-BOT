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

async function ensureIndex(indexName, createSql) {
  const [rows] = await sequelize.query(
    `select exists (
      select 1
      from pg_indexes
      where schemaname = 'public' and indexname = :indexName
    ) as exists`,
    { replacements: { indexName } }
  );

  if (rows?.[0]?.exists) return;
  await sequelize.query(createSql);
  console.log(`[SchemaBootstrap] Created index ${indexName}`);
}

// Adds a foreign-key constraint if absent. Defensive: if existing data violates it
// (e.g. legacy orphan rows), it logs and continues rather than crashing boot — the
// integrity audit script surfaces such rows separately.
async function ensureForeignKey(constraintName, createSql) {
  const [rows] = await sequelize.query(
    `select exists (select 1 from pg_constraint where conname = :name) as exists`,
    { replacements: { name: constraintName } }
  );
  if (rows?.[0]?.exists) return;
  try {
    await sequelize.query(createSql);
    console.log(`[SchemaBootstrap] Added FK ${constraintName}`);
  } catch (err) {
    console.warn(`[SchemaBootstrap] Skipped FK ${constraintName}: ${err.message}`);
  }
}

async function ensureEnumValues(typeName, values) {
  const [existsRows] = await sequelize.query(
    `select exists (select 1 from pg_type where typname = :typeName) as exists`,
    { replacements: { typeName } }
  );

  if (!existsRows?.[0]?.exists) {
    const valueList = values.map((value) => `'${value}'`).join(', ');
    await sequelize.query(`CREATE TYPE "${typeName}" AS ENUM (${valueList})`);
    console.log(`[SchemaBootstrap] Created ${typeName}`);
    return;
  }

  for (const value of values) {
    await sequelize.query(`ALTER TYPE "${typeName}" ADD VALUE IF NOT EXISTS '${value}'`);
    console.log(`[SchemaBootstrap] Ensured ${typeName}.${value}`);
  }
}

async function ensureAgenciesSchema() {
  await ensureEnumValues('enum_agencies_industry', [
    'TRAVEL',
    'RESORT',
    'CLEANING',
    'LAUNDRY',
  ]);

  await ensureEnumValues('enum_agencies_website_theme', [
    'MODERN',
    'CLASSIC',
    'MINIMAL',
    'VIBRANT',
    'LUXURY_ESCAPE',
    'ADVENTURE_TREK',
    'FAMILY_HOLIDAY',
    'HONEYMOON',
    'CORPORATE_TRAVEL',
    'PILGRIMAGE',
  ]);

  await ensureColumn('agencies', 'industry', {
    type: Sequelize.ENUM('TRAVEL', 'RESORT', 'CLEANING', 'LAUNDRY'),
    allowNull: false,
    defaultValue: 'TRAVEL',
  });

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

  await ensureColumn('agencies', 'welcome_message', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'whatsapp_menu_labels', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'whatsapp_menu_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('agencies', 'whatsapp_flow_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'instagram_flow_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'sidebar_preferences', {
    type: Sequelize.JSONB,
    allowNull: true,
  });

  await ensureColumn('agencies', 'lead_routing_strategy', {
    type: Sequelize.STRING(20),
    allowNull: false,
    defaultValue: 'INTENT',
  });

  await ensureColumn('agencies', 'round_robin_cursor_agent_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('agencies', 'gstin', {
    type: Sequelize.STRING(32),
    allowNull: true,
  });

  await ensureColumn('agencies', 'upi_id', {
    type: Sequelize.STRING(120),
    allowNull: true,
  });

  await ensureColumn('agencies', 'state_code', {
    type: Sequelize.STRING(2),
    allowNull: true,
  });

  await ensureColumn('agencies', 'accounting_settings', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'document_settings', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'company_logo_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });

  await ensureColumn('agencies', 'company_seal_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });

  await ensureColumn('agencies', 'authorized_signature_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });

  await ensureColumn('agencies', 'subdomain', {
    type: Sequelize.STRING(80),
    allowNull: true,
  });

  await ensureColumn('agencies', 'custom_domain', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('message_templates', 'variable_map', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('agencies', 'website_enabled', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });

  await ensureColumn('agencies', 'website_theme', {
    type: Sequelize.ENUM(
      'MODERN',
      'CLASSIC',
      'MINIMAL',
      'VIBRANT',
      'LUXURY_ESCAPE',
      'ADVENTURE_TREK',
      'FAMILY_HOLIDAY',
      'HONEYMOON',
      'CORPORATE_TRAVEL',
      'PILGRIMAGE'
    ),
    allowNull: false,
    defaultValue: 'MODERN',
  });

  await ensureColumn('agencies', 'website_title', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_description', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_logo_url', {
    type: Sequelize.STRING(512),
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_primary_color', {
    type: Sequelize.STRING(7),
    allowNull: true,
    defaultValue: '#00A884',
  });

  await ensureColumn('agencies', 'website_hero_image_url', {
    type: Sequelize.STRING(512),
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_contact_phone', {
    type: Sequelize.STRING(20),
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_contact_email', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_social_links', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'website_seo_meta', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('agencies', 'website_custom_css', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('agencies', 'website_published_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureColumn('agencies', 'lead_form_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureIndex(
    'agencies_subdomain_unique',
    'CREATE UNIQUE INDEX agencies_subdomain_unique ON agencies (subdomain) WHERE subdomain IS NOT NULL'
  );
  await ensureIndex(
    'agencies_custom_domain_unique',
    'CREATE UNIQUE INDEX agencies_custom_domain_unique ON agencies (custom_domain) WHERE custom_domain IS NOT NULL'
  );
}

async function ensurePackagesSchema() {
  await ensureColumn('packages', 'tour_type', {
    type: Sequelize.STRING(80),
    allowNull: true,
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

  // The entry stage is now represented by an empty (null) status. Drop the old
  // 'JUST_CONTACTED' column default and null-out existing entry-stage leads.
  // Idempotent: re-running has no effect once rows are migrated.
  await sequelize.query('ALTER TABLE leads ALTER COLUMN status DROP DEFAULT');
  await sequelize.query("UPDATE leads SET status = NULL WHERE status = 'JUST_CONTACTED'");

  await ensureEnumValues('enum_leads_item_type', [
    'PACKAGE',
    'PROPERTY',
    'SERVICE',
    'VISA',
    'CRUISE',
    'CUSTOM_TRIP',
  ]);

  await ensureColumn('leads', 'place', {
    type: Sequelize.STRING(500),
    allowNull: true,
  });

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

  await ensureColumn('leads', 'property_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'service_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'visa_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'cruise_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE', 'CUSTOM_TRIP'),
    allowNull: true,
  });

  await ensureColumn('leads', 'campaign_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'campaign_name', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'campaign_action', {
    type: Sequelize.STRING(100),
    allowNull: true,
  });

  await ensureColumn('leads', 'tags', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('leads', 'selected_items', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('leads', 'custom_trip_details', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('leads', 'meta_leadgen_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_form_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_page_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_ad_account_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_campaign_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_campaign_name', {
    type: Sequelize.STRING(500),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_ad_set_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_ad_set_name', {
    type: Sequelize.STRING(500),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_ad_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_ad_name', {
    type: Sequelize.STRING(500),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_platform', {
    type: Sequelize.STRING(50),
    allowNull: true,
  });

  await ensureColumn('leads', 'meta_raw_payload', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureIndex(
    'leads_agency_meta_leadgen_unique',
    'CREATE UNIQUE INDEX leads_agency_meta_leadgen_unique ON leads (agency_id, meta_leadgen_id) WHERE meta_leadgen_id IS NOT NULL'
  );
  await ensureIndex(
    'leads_agency_meta_campaign_id_idx',
    'CREATE INDEX leads_agency_meta_campaign_id_idx ON leads (agency_id, meta_campaign_id)'
  );
  await ensureIndex(
    'leads_agency_meta_form_id_idx',
    'CREATE INDEX leads_agency_meta_form_id_idx ON leads (agency_id, meta_form_id)'
  );
}

async function ensureLeadSourcesSchema() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('lead_sources'))) {
    await queryInterface.createTable('lead_sources', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'agencies',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
    console.log('[SchemaBootstrap] Created lead_sources');
  }

  await ensureIndex(
    'lead_sources_agency_id_idx',
    'CREATE INDEX lead_sources_agency_id_idx ON lead_sources (agency_id)'
  );
  await ensureIndex(
    'lead_sources_agency_id_name_unique',
    'CREATE UNIQUE INDEX lead_sources_agency_id_name_unique ON lead_sources (agency_id, name)'
  );
}

async function ensureCustomersSchema() {
  await ensureColumn('customers', 'channel_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('customers', 'email', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('customers', 'gstin', {
    type: Sequelize.STRING(32),
    allowNull: true,
  });

  await ensureColumn('customers', 'ledger_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('customers', 'state_code', {
    type: Sequelize.STRING(2),
    allowNull: true,
  });

  await ensureColumn('customers', 'contact_phone', {
    type: Sequelize.STRING(50),
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

  await ensureIndex(
    'customers_agency_channel_id_idx',
    'CREATE INDEX customers_agency_channel_id_idx ON customers (agency_id, channel_id) WHERE channel_id IS NOT NULL'
  );
  await ensureIndex(
    'customers_ledger_id_idx',
    'CREATE INDEX customers_ledger_id_idx ON customers (ledger_id) WHERE ledger_id IS NOT NULL'
  );
}

async function ensureAgencyChannelsSchema() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('agency_channels'))) {
    await queryInterface.createTable('agency_channels', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      label: { type: Sequelize.STRING(100), allowNull: true },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      whatsapp_number: { type: Sequelize.STRING(30), allowNull: true, unique: true },
      whatsapp_provider: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'SELF_HOSTED' },
      whatsapp_phone_number_id: { type: Sequelize.STRING(255), allowNull: true },
      whatsapp_business_account_id: { type: Sequelize.STRING(255), allowNull: true },
      whatsapp_display_phone_number: { type: Sequelize.STRING(30), allowNull: true },
      whatsapp_access_token: { type: Sequelize.TEXT, allowNull: true },
      whatsapp_catalog_id: { type: Sequelize.STRING(255), allowNull: true },
      whatsapp_onboarding_mode: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'STANDARD' },
      whatsapp_connection_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NOT_CONNECTED' },
      whatsapp_coexistence_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NOT_ENABLED' },
      whatsapp_contact_sync_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
      whatsapp_history_sync_status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
      whatsapp_coexistence_last_synced_at: { type: Sequelize.DATE, allowNull: true },
      whatsapp_connection_error: { type: Sequelize.TEXT, allowNull: true },
      whatsapp_last_synced_at: { type: Sequelize.DATE, allowNull: true },
      marketing_os_tenant_id: { type: Sequelize.STRING(255), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    console.log('[SchemaBootstrap] Created agency_channels table');
  }

  await ensureColumn('agency_channels', 'label', {
    type: Sequelize.STRING(100),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'is_default', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
  await ensureColumn('agency_channels', 'is_active', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_number', {
    type: Sequelize.STRING(30),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_provider', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'SELF_HOSTED',
  });
  await ensureColumn('agency_channels', 'whatsapp_phone_number_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_business_account_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_display_phone_number', {
    type: Sequelize.STRING(30),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_access_token', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_catalog_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_onboarding_mode', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'STANDARD',
  });
  await ensureColumn('agency_channels', 'whatsapp_connection_status', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'NOT_CONNECTED',
  });
  await ensureColumn('agency_channels', 'whatsapp_coexistence_status', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'NOT_ENABLED',
  });
  await ensureColumn('agency_channels', 'whatsapp_contact_sync_status', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'NOT_STARTED',
  });
  await ensureColumn('agency_channels', 'whatsapp_history_sync_status', {
    type: Sequelize.STRING(30),
    allowNull: false,
    defaultValue: 'NOT_STARTED',
  });
  await ensureColumn('agency_channels', 'whatsapp_coexistence_last_synced_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_connection_error', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'whatsapp_last_synced_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn('agency_channels', 'marketing_os_tenant_id', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureIndex(
    'agency_channels_agency_id_idx',
    'CREATE INDEX agency_channels_agency_id_idx ON agency_channels (agency_id)'
  );
  await ensureIndex(
    'agency_channels_agency_default_idx',
    'CREATE INDEX agency_channels_agency_default_idx ON agency_channels (agency_id, is_default)'
  );
  await ensureIndex(
    'agency_channels_phone_number_id_idx',
    'CREATE INDEX agency_channels_phone_number_id_idx ON agency_channels (whatsapp_phone_number_id) WHERE whatsapp_phone_number_id IS NOT NULL'
  );

}

async function ensureAgentsSchema() {
  await ensureColumn('agents', 'reset_password_token_hash', {
    type: Sequelize.STRING(64),
    allowNull: true,
  });

  await ensureColumn('agents', 'reset_password_expires_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureIndex(
    'agents_reset_password_token_hash_idx',
    'CREATE INDEX agents_reset_password_token_hash_idx ON agents (reset_password_token_hash) WHERE reset_password_token_hash IS NOT NULL'
  );
}

async function ensurePropertiesSchema() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('properties'))) {
    await queryInterface.createTable('properties', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      property_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'Hotel',
      },
      location: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      amenities: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      price_per_night: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      image_url: {
        type: Sequelize.STRING(1000),
        allowNull: true,
      },
      images: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('properties', ['agency_id']);
    await queryInterface.addIndex('properties', ['agency_id', 'is_active']);
    console.log('[SchemaBootstrap] Created properties table');
    return;
  }

  await ensureColumn('properties', 'agency_id', {
    type: Sequelize.UUID,
    allowNull: false,
  });
  await ensureColumn('properties', 'name', {
    type: Sequelize.STRING(255),
    allowNull: false,
  });
  await ensureColumn('properties', 'property_type', {
    type: Sequelize.STRING(50),
    allowNull: false,
    defaultValue: 'Hotel',
  });
  await ensureColumn('properties', 'location', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
  await ensureColumn('properties', 'address', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
  await ensureColumn('properties', 'amenities', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });
  await ensureColumn('properties', 'description', {
    type: Sequelize.TEXT,
    allowNull: true,
  });
  await ensureColumn('properties', 'price_per_night', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });
  await ensureColumn('properties', 'image_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });
  await ensureColumn('properties', 'images', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });
  await ensureColumn('properties', 'brochure_url', {
    type: Sequelize.STRING(1000),
    allowNull: true,
  });
  await ensureColumn('properties', 'brochure_file_name', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });
  await ensureColumn('properties', 'is_active', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
}

async function ensureBookingsSchema() {
  await ensureEnumValues('enum_bookings_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CRUISE',
    'VISA',
    'SERVICE',
    'CUSTOM'
  ]);

  await ensureEnumValues('enum_bookings_payment_mode', [
    'FULL',
    'ADVANCE',
    'NO_PAYMENT'
  ]);

  await ensureColumn('bookings', 'itinerary_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('bookings', 'item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'),
    allowNull: false,
    defaultValue: 'PACKAGE',
  });

  await ensureColumn('bookings', 'property_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('bookings', 'cruise_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('bookings', 'visa_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('bookings', 'service_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('bookings', 'custom_item_name', {
    type: Sequelize.STRING(255),
    allowNull: true,
  });

  await ensureColumn('bookings', 'custom_item_description', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('bookings', 'payment_mode', {
    type: Sequelize.ENUM('FULL', 'ADVANCE', 'NO_PAYMENT'),
    allowNull: false,
    defaultValue: 'FULL',
  });

  await ensureColumn('bookings', 'base_price', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  await ensureColumn('bookings', 'settlement_type', {
    type: Sequelize.ENUM('FULL_COLLECTION', 'COMMISSION_ONLY'),
    allowNull: false,
    defaultValue: 'FULL_COLLECTION',
  });

  await ensureColumn('bookings', 'commission_amount', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  const queryInterface = sequelize.getQueryInterface();

  // Bookings can now be created directly from a customer without an originating lead.
  await queryInterface.changeColumn('bookings', 'lead_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await queryInterface.changeColumn('bookings', 'travel_date', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await queryInterface.changeColumn('bookings', 'return_date', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await queryInterface.changeColumn('bookings', 'travellers', {
    type: Sequelize.INTEGER,
    allowNull: true,
  });

  console.log('[SchemaBootstrap] Updated bookings columns for flexible items');
}

async function ensureItinerariesSchema() {
  await ensureColumn('itineraries', 'package_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });
  // Itinerary-builder fields (themed PDF + rich content blocks).
  await ensureColumn('itineraries', 'template_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('itineraries', 'product_code', { type: Sequelize.STRING(120), allowNull: true });
  await ensureColumn('itineraries', 'summary', { type: Sequelize.STRING(500), allowNull: true });
  await ensureColumn('itineraries', 'hotels', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });
  await ensureColumn('itineraries', 'vehicle', { type: Sequelize.JSONB, allowNull: true, defaultValue: {} });
  await ensureColumn('itineraries', 'price_rooms', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });
  await ensureColumn('itineraries', 'pricing', { type: Sequelize.JSONB, allowNull: true, defaultValue: {} });
  await ensureColumn('itineraries', 'inclusions', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });
  await ensureColumn('itineraries', 'exclusions', { type: Sequelize.JSONB, allowNull: true, defaultValue: [] });
}

async function ensureCampaignsSchema() {
  await ensureEnumValues('enum_campaigns_type', [
    'BROADCAST',
    'PROMOTIONAL',
    'RE_ENGAGEMENT',
    'SEASONAL',
    'REVIEW_COLLECTION',
  ]);

  await ensureEnumValues('enum_campaigns_format', [
    'STANDARD',
    'SECTION_CTA',
    'ITEM_CAROUSEL',
  ]);

  await ensureEnumValues('enum_campaigns_media_type', [
    'NONE',
    'IMAGE',
    'VIDEO',
  ]);

  await ensureColumn('campaigns', 'format', {
    type: Sequelize.ENUM('STANDARD', 'SECTION_CTA', 'ITEM_CAROUSEL'),
    allowNull: false,
    defaultValue: 'STANDARD',
  });

  await ensureColumn('campaigns', 'media_type', {
    type: Sequelize.ENUM('NONE', 'IMAGE', 'VIDEO'),
    allowNull: false,
    defaultValue: 'NONE',
  });

  await ensureColumn('campaigns', 'media_url', {
    type: Sequelize.TEXT,
    allowNull: true,
  });

  await ensureColumn('campaigns', 'channel_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureIndex(
    'campaigns_agency_channel_id_idx',
    'CREATE INDEX campaigns_agency_channel_id_idx ON campaigns (agency_id, channel_id) WHERE channel_id IS NOT NULL'
  );

  await ensureColumn('campaigns', 'linked_package_ids', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('campaigns', 'campaign_sections', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureColumn('campaigns', 'carousel_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureColumn('campaigns', 'cta_config', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: {},
  });

  await ensureEnumValues('enum_message_templates_template_type', [
    'STANDARD',
    'CAROUSEL',
  ]);

  await ensureColumn('message_templates', 'template_type', {
    type: Sequelize.ENUM('STANDARD', 'CAROUSEL'),
    allowNull: false,
    defaultValue: 'STANDARD',
  });

  await ensureColumn('message_templates', 'carousel_cards', {
    type: Sequelize.JSONB,
    allowNull: false,
    defaultValue: [],
  });

  await ensureEnumValues('enum_campaign_recipients_selected_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CUSTOM_TRIP',
  ]);

  await ensureColumn('campaign_recipients', 'clicked_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });

  await ensureColumn('campaign_recipients', 'clicked_action', {
    type: Sequelize.STRING(100),
    allowNull: true,
  });

  await ensureColumn('campaign_recipients', 'selected_item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP'),
    allowNull: true,
  });

  await ensureColumn('campaign_recipients', 'selected_item_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('campaign_recipients', 'lead_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('campaign_recipients', 'flow_submitted_at', {
    type: Sequelize.DATE,
    allowNull: true,
  });
}

async function ensureWhatsAppFlowsSchema() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('whatsapp_flows'))) {
    await queryInterface.createTable('whatsapp_flows', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      flow_type: {
        type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'VISA', 'CRUISE', 'SERVICE', 'CUSTOM_TRIP', 'REVIEW', 'GENERIC'),
        allowNull: false,
        defaultValue: 'GENERIC',
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'FAILED', 'ARCHIVED'),
        allowNull: false,
        defaultValue: 'DRAFT',
      },
      meta_flow_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      endpoint_uri: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      first_screen_id: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      categories: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: ['OTHER'],
      },
      json_definition: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      validation_errors: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      health_status: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      last_synced_at: {
        type: Sequelize.DATE,
        allowNull: true,
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
    await queryInterface.addIndex('whatsapp_flows', ['agency_id']);
    await queryInterface.addIndex('whatsapp_flows', ['agency_id', 'status']);
    await queryInterface.addIndex('whatsapp_flows', ['agency_id', 'flow_type']);
    await queryInterface.addIndex('whatsapp_flows', ['meta_flow_id']);
    await queryInterface.addIndex('whatsapp_flows', ['agency_id', 'name'], { unique: true });
    console.log('[SchemaBootstrap] Created whatsapp_flows table');
  } else {
    await ensureEnumValues('enum_whatsapp_flows_flow_type', ['PACKAGE', 'PROPERTY', 'VISA', 'CRUISE', 'SERVICE', 'CUSTOM_TRIP', 'REVIEW', 'GENERIC']);
  }
}

async function ensureServiceRoutingRulesTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('service_routing_rules'))) {
    await queryInterface.createTable('service_routing_rules', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      agency_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      intent_key: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      agent_id: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 100,
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.addIndex('service_routing_rules', ['agency_id']);
    await queryInterface.addIndex('service_routing_rules', ['agency_id', 'intent_key']);
    await queryInterface.addIndex('service_routing_rules', ['agency_id', 'intent_key', 'agent_id'], { unique: true });
    console.log('[SchemaBootstrap] Created service_routing_rules table');
    return;
  }

  await ensureColumn('service_routing_rules', 'agency_id', {
    type: Sequelize.UUID,
    allowNull: false,
  });
  await ensureColumn('service_routing_rules', 'intent_key', {
    type: Sequelize.STRING(80),
    allowNull: false,
  });
  await ensureColumn('service_routing_rules', 'agent_id', {
    type: Sequelize.UUID,
    allowNull: false,
  });
  await ensureColumn('service_routing_rules', 'priority', {
    type: Sequelize.INTEGER,
    allowNull: false,
    defaultValue: 100,
  });
  await ensureColumn('service_routing_rules', 'is_active', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  });
}

async function ensureFollowUpsTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (await tableExists('follow_ups')) {
    await ensureColumn('follow_ups', 'agent_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });

    await ensureColumn('follow_ups', 'type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Call, WhatsApp, Email, Meeting, etc.',
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

async function ensureCallLogsTable() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_call_logs_status', [
    'initiated',
    'queued',
    'ringing',
    'agent_answered',
    'customer_ringing',
    'in_progress',
    'completed',
    'busy',
    'failed',
    'no_answer',
    'canceled',
  ]);

  if (await tableExists('call_logs')) {
    return;
  }

  await queryInterface.createTable('call_logs', {
    id: {
      type: Sequelize.UUID,
      defaultValue: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },
    agency_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    lead_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    customer_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    agent_id: {
      type: Sequelize.UUID,
      allowNull: false,
    },
    agent_phone: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    customer_phone: {
      type: Sequelize.STRING(50),
      allowNull: false,
    },
    parent_call_sid: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    agent_call_sid: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    customer_call_sid: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    status: {
      type: Sequelize.ENUM(
        'initiated',
        'queued',
        'ringing',
        'agent_answered',
        'customer_ringing',
        'in_progress',
        'completed',
        'busy',
        'failed',
        'no_answer',
        'canceled'
      ),
      allowNull: false,
      defaultValue: 'initiated',
    },
    started_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    agent_answered_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    customer_answered_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    completed_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    duration_seconds: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    recording_sid: {
      type: Sequelize.STRING(64),
      allowNull: true,
    },
    recording_url: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    recording_duration: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    failure_reason: {
      type: Sequelize.TEXT,
      allowNull: true,
    },
    raw_events: {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
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

  await queryInterface.addIndex('call_logs', ['agency_id', 'lead_id']);
  await queryInterface.addIndex('call_logs', ['agency_id', 'agent_id']);
  await queryInterface.addIndex('call_logs', ['agent_call_sid']);
  await queryInterface.addIndex('call_logs', ['customer_call_sid']);
  await queryInterface.addIndex('call_logs', ['parent_call_sid']);
  await queryInterface.addIndex('call_logs', ['created_at']);
  console.log('[SchemaBootstrap] Created call_logs table');
}

async function ensureInstagramAutomationTables() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_instagram_automations_match_type', ['EXACT', 'CONTAINS', 'ANY']);
  await ensureEnumValues('enum_instagram_automations_action_type', ['PACKAGE_FLOW', 'PROPERTY_FLOW', 'BROCHURE_LINK', 'AGENT_HANDOFF']);
  await ensureEnumValues('enum_instagram_automations_follow_prompt_mode', ['OFF', 'BEFORE_DETAILS', 'AFTER_DETAILS']);
  await ensureEnumValues('enum_instagram_automations_duplicate_policy', ['USER_PER_POST', 'COMMENT', 'USER_24H']);
  await ensureEnumValues('enum_instagram_automation_logs_status', [
    'MATCHED',
    'PRIVATE_REPLY_SENT',
    'PUBLIC_REPLY_SENT',
    'WAITING_FOR_REPLY',
    'CONVERTED_TO_DM',
    'DUPLICATE_SKIPPED',
    'TOO_OLD',
    'NO_MATCH',
    'FAILED',
  ]);

  if (!(await tableExists('instagram_automations'))) {
    await queryInterface.createTable('instagram_automations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      account_id: { type: Sequelize.STRING(255), allowNull: false },
      media_id: { type: Sequelize.STRING(255), allowNull: true },
      media_title: { type: Sequelize.STRING(255), allowNull: true },
      media_thumbnail_url: { type: Sequelize.TEXT, allowNull: true },
      name: { type: Sequelize.STRING(255), allowNull: false, defaultValue: 'Comment to DM' },
      trigger_keywords: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      match_type: { type: Sequelize.ENUM('EXACT', 'CONTAINS', 'ANY'), allowNull: false, defaultValue: 'CONTAINS' },
      action_type: { type: Sequelize.ENUM('PACKAGE_FLOW', 'PROPERTY_FLOW', 'BROCHURE_LINK', 'AGENT_HANDOFF'), allowNull: false, defaultValue: 'PACKAGE_FLOW' },
      linked_package_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      linked_property_ids: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      private_reply_message: { type: Sequelize.TEXT, allowNull: false, defaultValue: 'Thanks for commenting. I can send the details here.' },
      quick_replies: { type: Sequelize.JSONB, allowNull: false, defaultValue: ['Show Packages', 'Talk to Agent'] },
      follow_prompt_mode: { type: Sequelize.ENUM('OFF', 'BEFORE_DETAILS', 'AFTER_DETAILS'), allowNull: false, defaultValue: 'OFF' },
      public_reply_enabled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      public_reply_message: { type: Sequelize.TEXT, allowNull: true, defaultValue: 'Sent you details in DM.' },
      duplicate_policy: { type: Sequelize.ENUM('USER_PER_POST', 'COMMENT', 'USER_24H'), allowNull: false, defaultValue: 'USER_PER_POST' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      stats: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      last_triggered_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('instagram_automations', ['agency_id', 'account_id']);
    await queryInterface.addIndex('instagram_automations', ['agency_id', 'is_active']);
    await queryInterface.addIndex('instagram_automations', ['account_id', 'media_id']);
    console.log('[SchemaBootstrap] Created instagram_automations table');
  }

  if (!(await tableExists('instagram_automation_logs'))) {
    await queryInterface.createTable('instagram_automation_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      automation_id: { type: Sequelize.UUID, allowNull: true },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      account_id: { type: Sequelize.STRING(255), allowNull: false },
      media_id: { type: Sequelize.STRING(255), allowNull: true },
      comment_id: { type: Sequelize.STRING(255), allowNull: false },
      commenter_id: { type: Sequelize.STRING(255), allowNull: true },
      commenter_username: { type: Sequelize.STRING(255), allowNull: true },
      comment_text: { type: Sequelize.TEXT, allowNull: true },
      matched_keyword: { type: Sequelize.STRING(255), allowNull: true },
      status: {
        type: Sequelize.ENUM('MATCHED', 'PRIVATE_REPLY_SENT', 'PUBLIC_REPLY_SENT', 'WAITING_FOR_REPLY', 'CONVERTED_TO_DM', 'DUPLICATE_SKIPPED', 'TOO_OLD', 'NO_MATCH', 'FAILED'),
        allowNull: false,
        defaultValue: 'MATCHED',
      },
      private_reply_message_id: { type: Sequelize.STRING(255), allowNull: true },
      public_reply_message_id: { type: Sequelize.STRING(255), allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('instagram_automation_logs', ['agency_id', 'account_id']);
    await queryInterface.addIndex('instagram_automation_logs', ['automation_id']);
    await queryInterface.addIndex('instagram_automation_logs', ['comment_id']);
    await queryInterface.addIndex('instagram_automation_logs', ['status']);
    console.log('[SchemaBootstrap] Created instagram_automation_logs table');
  }
}

async function ensureMetaAdsTables() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_meta_lead_sync_events_event_type', ['WEBHOOK', 'BACKFILL', 'MANUAL']);
  await ensureEnumValues('enum_meta_lead_sync_events_status', ['RECEIVED', 'IMPORTED', 'DUPLICATE', 'FAILED']);

  if (!(await tableExists('meta_ad_campaigns'))) {
    await queryInterface.createTable('meta_ad_campaigns', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      meta_campaign_id: { type: Sequelize.STRING(255), allowNull: false },
      meta_ad_account_id: { type: Sequelize.STRING(255), allowNull: true },
      name: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.STRING(80), allowNull: true },
      objective: { type: Sequelize.STRING(120), allowNull: true },
      platform: { type: Sequelize.STRING(50), allowNull: true },
      last_insights: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      raw_payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      last_synced_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('meta_ad_campaigns', ['agency_id', 'meta_campaign_id'], { unique: true });
    await queryInterface.addIndex('meta_ad_campaigns', ['agency_id', 'meta_ad_account_id']);
    await queryInterface.addIndex('meta_ad_campaigns', ['agency_id', 'status']);
    console.log('[SchemaBootstrap] Created meta_ad_campaigns table');
  }

  if (!(await tableExists('meta_lead_forms'))) {
    await queryInterface.createTable('meta_lead_forms', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      meta_form_id: { type: Sequelize.STRING(255), allowNull: false },
      meta_page_id: { type: Sequelize.STRING(255), allowNull: true },
      meta_ad_account_id: { type: Sequelize.STRING(255), allowNull: true },
      name: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.STRING(80), allowNull: true },
      platform: { type: Sequelize.STRING(50), allowNull: true },
      is_subscribed: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      raw_payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      last_synced_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('meta_lead_forms', ['agency_id', 'meta_form_id'], { unique: true });
    await queryInterface.addIndex('meta_lead_forms', ['agency_id', 'meta_page_id']);
    await queryInterface.addIndex('meta_lead_forms', ['agency_id', 'status']);
    console.log('[SchemaBootstrap] Created meta_lead_forms table');
  }

  if (!(await tableExists('meta_lead_sync_events'))) {
    await queryInterface.createTable('meta_lead_sync_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      event_type: { type: Sequelize.ENUM('WEBHOOK', 'BACKFILL', 'MANUAL'), allowNull: false, defaultValue: 'WEBHOOK' },
      status: { type: Sequelize.ENUM('RECEIVED', 'IMPORTED', 'DUPLICATE', 'FAILED'), allowNull: false, defaultValue: 'RECEIVED' },
      meta_leadgen_id: { type: Sequelize.STRING(255), allowNull: true },
      meta_form_id: { type: Sequelize.STRING(255), allowNull: true },
      meta_campaign_id: { type: Sequelize.STRING(255), allowNull: true },
      lead_id: { type: Sequelize.UUID, allowNull: true },
      error_message: { type: Sequelize.TEXT, allowNull: true },
      payload: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('meta_lead_sync_events', ['agency_id', 'created_at']);
    await queryInterface.addIndex('meta_lead_sync_events', ['agency_id', 'status']);
    await queryInterface.addIndex('meta_lead_sync_events', ['meta_leadgen_id']);
    await queryInterface.addIndex('meta_lead_sync_events', ['lead_id']);
    console.log('[SchemaBootstrap] Created meta_lead_sync_events table');
  }
}

async function ensurePlatformAdminTables() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_platform_admins_role', ['OWNER', 'SUPPORT']);

  if (!(await tableExists('platform_admins'))) {
    await queryInterface.createTable('platform_admins', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      email: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING(255), allowNull: false },
      role: { type: Sequelize.ENUM('OWNER', 'SUPPORT'), allowNull: false, defaultValue: 'OWNER' },
      last_login_at: { type: Sequelize.DATE, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('platform_admins', ['is_active']);
    console.log('[SchemaBootstrap] Created platform_admins table');
  }

  if (!(await tableExists('platform_admin_sessions'))) {
    await queryInterface.createTable('platform_admin_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      admin_id: { type: Sequelize.UUID, allowNull: false },
      token: { type: Sequelize.STRING(255), allowNull: false, unique: true },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('platform_admin_sessions', ['token']);
    await queryInterface.addIndex('platform_admin_sessions', ['admin_id']);
    console.log('[SchemaBootstrap] Created platform_admin_sessions table');
  }

  if (!(await tableExists('platform_audit_logs'))) {
    await queryInterface.createTable('platform_audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      admin_id: { type: Sequelize.UUID, allowNull: true },
      action: { type: Sequelize.STRING(120), allowNull: false },
      target_type: { type: Sequelize.STRING(80), allowNull: true },
      target_id: { type: Sequelize.UUID, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ip_address: { type: Sequelize.STRING(80), allowNull: true },
      user_agent: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('platform_audit_logs', ['admin_id']);
    await queryInterface.addIndex('platform_audit_logs', ['action']);
    await queryInterface.addIndex('platform_audit_logs', ['target_type', 'target_id']);
    await queryInterface.addIndex('platform_audit_logs', ['created_at']);
    console.log('[SchemaBootstrap] Created platform_audit_logs table');
  }
}

async function ensurePartnersSchema() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_partners_billing_model', ['REV_SHARE', 'MARKUP', 'FLAT']);
  await ensureEnumValues('enum_partners_billing_status', ['ACTIVE', 'PAST_DUE', 'SUSPENDED']);
  await ensureEnumValues('enum_partner_invoices_status', ['DRAFT', 'ISSUED', 'PAID', 'VOID']);

  if (!(await tableExists('partners'))) {
    await queryInterface.createTable('partners', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      slug: { type: Sequelize.STRING(80), allowNull: false, unique: true },
      custom_domain: { type: Sequelize.STRING(255), allowNull: true, unique: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      brand_name: { type: Sequelize.STRING(120), allowNull: true },
      logo_url: { type: Sequelize.STRING(1000), allowNull: true },
      favicon_url: { type: Sequelize.STRING(1000), allowNull: true },
      primary_color: { type: Sequelize.STRING(7), allowNull: true, defaultValue: '#00A884' },
      accent_color: { type: Sequelize.STRING(7), allowNull: true },
      login_tagline: { type: Sequelize.STRING(255), allowNull: true },
      login_image_url: { type: Sequelize.STRING(1000), allowNull: true },
      support_email: { type: Sequelize.STRING(255), allowNull: true },
      support_url: { type: Sequelize.STRING(1000), allowNull: true },
      email_from_name: { type: Sequelize.STRING(120), allowNull: true },
      email_reply_to: { type: Sequelize.STRING(255), allowNull: true },
      email_footer_text: { type: Sequelize.STRING(500), allowNull: true },
      billing_model: { type: Sequelize.ENUM('REV_SHARE', 'MARKUP', 'FLAT'), allowNull: false, defaultValue: 'REV_SHARE' },
      revenue_share_percent: { type: Sequelize.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
      per_agency_fee: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      billing_status: { type: Sequelize.ENUM('ACTIVE', 'PAST_DUE', 'SUSPENDED'), allowNull: false, defaultValue: 'ACTIVE' },
      created_by_admin_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('partners', ['slug'], { unique: true });
    await queryInterface.addIndex('partners', ['is_active']);
    console.log('[SchemaBootstrap] Created partners table');
  }

  if (!(await tableExists('partner_invoices'))) {
    await queryInterface.createTable('partner_invoices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      partner_id: { type: Sequelize.UUID, allowNull: false },
      period_start: { type: Sequelize.DATEONLY, allowNull: false },
      period_end: { type: Sequelize.DATEONLY, allowNull: false },
      agency_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      subtotal: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      revenue_share_amount: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      amount_due: { type: Sequelize.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID'), allowNull: false, defaultValue: 'DRAFT' },
      line_items: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      issued_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('partner_invoices', ['partner_id']);
    await queryInterface.addIndex('partner_invoices', ['partner_id', 'status']);
    console.log('[SchemaBootstrap] Created partner_invoices table');
  }

  // Link agencies to their reseller. Null = direct agency owned by the platform.
  await ensureColumn('agencies', 'partner_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });
  await ensureIndex(
    'agencies_partner_id_idx',
    'CREATE INDEX agencies_partner_id_idx ON agencies (partner_id) WHERE partner_id IS NOT NULL'
  );
}

async function ensureAccountingTables() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_accounting_ledgers_type', ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']);
  await ensureEnumValues('enum_accounting_ledgers_group_type', ['DIRECT', 'INDIRECT']);
  await ensureEnumValues('enum_accounting_ledgers_financial_statement', ['BALANCE_SHEET', 'PROFIT_AND_LOSS']);
  await ensureEnumValues('enum_accounting_payment_methods_method_type', ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER']);
  await ensureEnumValues('enum_journal_entries_type', [
    'JOURNAL',
    'INVOICE',
    'RECEIPT',
    'PAYMENT',
    'EXPENSE_VOUCHER',
    'OTHER_PURCHASE',
    'OTHER_SALE',
    'INTERNAL_FUND_TRANSFER',
    'CREDIT_NOTE',
  ]);
  await ensureEnumValues('enum_account_invoices_status', ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID']);
  await ensureEnumValues('enum_account_reminders_related_type', ['LEDGER', 'INVOICE', 'JOURNAL_ENTRY']);
  await ensureEnumValues('enum_account_reminders_status', ['PENDING', 'DONE', 'CANCELLED']);
  await ensureEnumValues('enum_credit_notes_status', ['ISSUED', 'VOID']);

  if (!(await tableExists('accounting_ledgers'))) {
    await queryInterface.createTable('accounting_ledgers', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      parent_id: { type: Sequelize.UUID, allowNull: true },
      code: { type: Sequelize.STRING(40), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      type: { type: Sequelize.ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'), allowNull: false },
      group_type: { type: Sequelize.ENUM('DIRECT', 'INDIRECT'), allowNull: true },
      financial_statement: { type: Sequelize.ENUM('BALANCE_SHEET', 'PROFIT_AND_LOSS'), allowNull: false },
      is_group: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      system_created: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'INR' },
      gstin: { type: Sequelize.STRING(32), allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('accounting_ledgers', ['agency_id', 'code'], { unique: true });
    await queryInterface.addIndex('accounting_ledgers', ['agency_id', 'parent_id']);
    await queryInterface.addIndex('accounting_ledgers', ['agency_id', 'type']);
    console.log('[SchemaBootstrap] Created accounting_ledgers table');
  }

  if (!(await tableExists('accounting_payment_methods'))) {
    await queryInterface.createTable('accounting_payment_methods', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      ledger_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false },
      method_type: { type: Sequelize.ENUM('CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'), allowNull: false, defaultValue: 'BANK' },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('accounting_payment_methods', ['agency_id']);
    await queryInterface.addIndex('accounting_payment_methods', ['agency_id', 'ledger_id']);
    await queryInterface.addIndex('accounting_payment_methods', ['agency_id', 'is_active']);
    await queryInterface.addIndex('accounting_payment_methods', ['agency_id', 'name'], { unique: true });
    console.log('[SchemaBootstrap] Created accounting_payment_methods table');
  }

  if (!(await tableExists('journal_entries'))) {
    await queryInterface.createTable('journal_entries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      created_by_agent_id: { type: Sequelize.UUID, allowNull: true },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      reference_number: { type: Sequelize.STRING(40), allowNull: false },
      type: {
        type: Sequelize.ENUM('JOURNAL', 'INVOICE', 'RECEIPT', 'PAYMENT', 'EXPENSE_VOUCHER', 'OTHER_PURCHASE', 'OTHER_SALE', 'INTERNAL_FUND_TRANSFER', 'CREDIT_NOTE'),
        allowNull: false,
        defaultValue: 'JOURNAL',
      },
      source_type: { type: Sequelize.STRING(80), allowNull: true },
      source_id: { type: Sequelize.STRING(80), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('journal_entries', ['agency_id', 'reference_number'], { unique: true });
    await queryInterface.addIndex('journal_entries', ['agency_id', 'source_type', 'source_id', 'type'], { unique: true });
    await queryInterface.addIndex('journal_entries', ['agency_id', 'date']);
    await queryInterface.addIndex('journal_entries', ['agency_id', 'type']);
    console.log('[SchemaBootstrap] Created journal_entries table');
  }

  if (!(await tableExists('journal_lines'))) {
    await queryInterface.createTable('journal_lines', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      journal_entry_id: { type: Sequelize.UUID, allowNull: false },
      ledger_id: { type: Sequelize.UUID, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      debit: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      credit: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      is_reconciled: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      reconciled_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('journal_lines', ['agency_id', 'journal_entry_id']);
    await queryInterface.addIndex('journal_lines', ['agency_id', 'ledger_id']);
    await queryInterface.addIndex('journal_lines', ['agency_id', 'is_reconciled']);
    console.log('[SchemaBootstrap] Created journal_lines table');
  }

  // Party dimension: tags a line to a customer/supplier so per-party statements can be
  // derived without creating a ledger per entity. Added here so existing tables migrate too.
  await ensureColumn('journal_lines', 'party_type', { type: Sequelize.STRING(20), allowNull: true });
  await ensureColumn('journal_lines', 'party_id', { type: Sequelize.UUID, allowNull: true });

  // Gap-free voucher/invoice/credit-note numbering. One row per (agency, scope) holds the
  // current high-water mark; nextSequentialNumber() increments it atomically under a row lock.
  if (!(await tableExists('accounting_counters'))) {
    await queryInterface.createTable('accounting_counters', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      scope_key: { type: Sequelize.STRING(80), allowNull: false },
      value: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    console.log('[SchemaBootstrap] Created accounting_counters table');
  }
  // Unique index backs the ON CONFLICT (agency_id, scope_key) upsert in nextSequentialNumber.
  await ensureIndex(
    'accounting_counters_agency_scope_unique',
    'CREATE UNIQUE INDEX accounting_counters_agency_scope_unique ON accounting_counters (agency_id, scope_key)'
  );

  // Referential integrity / immutability backstop: a journal line cannot be orphaned, and a
  // journal entry that still has lines cannot be hard-deleted (RESTRICT) — entries must be
  // reversed, never destroyed.
  await ensureForeignKey(
    'journal_lines_entry_fk',
    'ALTER TABLE journal_lines ADD CONSTRAINT journal_lines_entry_fk FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE RESTRICT'
  );

  if (!(await tableExists('account_invoices'))) {
    await queryInterface.createTable('account_invoices', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      customer_id: { type: Sequelize.UUID, allowNull: true },
      booking_id: { type: Sequelize.UUID, allowNull: true },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      invoice_number: { type: Sequelize.STRING(40), allowNull: false },
      invoice_date: { type: Sequelize.DATEONLY, allowNull: false },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'), allowNull: false, defaultValue: 'ISSUED' },
      taxable_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      gst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      cgst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      sgst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      igst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      total_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      paid_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      gstin: { type: Sequelize.STRING(32), allowNull: true },
      supplier_gstin: { type: Sequelize.STRING(32), allowNull: true },
      supplier_state_code: { type: Sequelize.STRING(2), allowNull: true },
      place_of_supply_state_code: { type: Sequelize.STRING(2), allowNull: true },
      gst_treatment: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'UNREGISTERED' },
      tax_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'NONE' },
      gst_rate_bps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      tax_breakup: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      narration: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      pdf_url: { type: Sequelize.STRING(1000), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('account_invoices', ['agency_id', 'invoice_number'], { unique: true });
    await queryInterface.addIndex('account_invoices', ['agency_id', 'customer_id']);
    await queryInterface.addIndex('account_invoices', ['agency_id', 'booking_id']);
    await queryInterface.addIndex('account_invoices', ['agency_id', 'status']);
    console.log('[SchemaBootstrap] Created account_invoices table');
  }
  await ensureColumn('account_invoices', 'pdf_url', { type: Sequelize.STRING(1000), allowNull: true });
  await ensureColumn('account_invoices', 'cgst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('account_invoices', 'sgst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('account_invoices', 'igst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('account_invoices', 'supplier_gstin', { type: Sequelize.STRING(32), allowNull: true });
  await ensureColumn('account_invoices', 'supplier_state_code', { type: Sequelize.STRING(2), allowNull: true });
  await ensureColumn('account_invoices', 'place_of_supply_state_code', { type: Sequelize.STRING(2), allowNull: true });
  await ensureColumn('account_invoices', 'gst_treatment', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'UNREGISTERED' });
  await ensureColumn('account_invoices', 'tax_type', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'NONE' });
  await ensureColumn('account_invoices', 'gst_rate_bps', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
  await ensureColumn('account_invoices', 'tax_breakup', { type: Sequelize.JSONB, allowNull: false, defaultValue: {} });

  // One auto-invoice per booking — closes the concurrent post race (webhook + booking-confirm).
  await ensureIndex(
    'account_invoices_agency_booking_unique',
    'CREATE UNIQUE INDEX account_invoices_agency_booking_unique ON account_invoices (agency_id, booking_id) WHERE booking_id IS NOT NULL'
  );
  // An invoice cannot dangle off a deleted journal entry.
  await ensureForeignKey(
    'account_invoices_entry_fk',
    'ALTER TABLE account_invoices ADD CONSTRAINT account_invoices_entry_fk FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id) ON DELETE RESTRICT'
  );

  if (!(await tableExists('account_reminders'))) {
    await queryInterface.createTable('account_reminders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      related_type: { type: Sequelize.ENUM('LEDGER', 'INVOICE', 'JOURNAL_ENTRY'), allowNull: false },
      related_id: { type: Sequelize.UUID, allowNull: false },
      title: { type: Sequelize.STRING(255), allowNull: false },
      note: { type: Sequelize.TEXT, allowNull: true },
      due_at: { type: Sequelize.DATE, allowNull: false },
      status: { type: Sequelize.ENUM('PENDING', 'DONE', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('account_reminders', ['agency_id', 'status', 'due_at']);
    await queryInterface.addIndex('account_reminders', ['agency_id', 'related_type', 'related_id']);
    console.log('[SchemaBootstrap] Created account_reminders table');
  }

  if (!(await tableExists('credit_notes'))) {
    await queryInterface.createTable('credit_notes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      invoice_id: { type: Sequelize.UUID, allowNull: true },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      credit_note_number: { type: Sequelize.STRING(40), allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      taxable_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      gst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      cgst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      sgst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      igst_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      total_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      tax_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'NONE' },
      gst_rate_bps: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      tax_breakup: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      reason: { type: Sequelize.TEXT, allowNull: true },
      status: { type: Sequelize.ENUM('ISSUED', 'VOID'), allowNull: false, defaultValue: 'ISSUED' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('credit_notes', ['agency_id', 'credit_note_number'], { unique: true });
    await queryInterface.addIndex('credit_notes', ['agency_id', 'invoice_id']);
    console.log('[SchemaBootstrap] Created credit_notes table');
  }
  await ensureColumn('credit_notes', 'cgst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('credit_notes', 'sgst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('credit_notes', 'igst_amount', { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 });
  await ensureColumn('credit_notes', 'tax_type', { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'NONE' });
  await ensureColumn('credit_notes', 'gst_rate_bps', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
  await ensureColumn('credit_notes', 'tax_breakup', { type: Sequelize.JSONB, allowNull: false, defaultValue: {} });

  if (await tableExists('payments')) {
    await ensureColumn('payments', 'payment_method_id', { type: Sequelize.UUID, allowNull: true });
    await ensureIndex(
      'payments_payment_method_id_idx',
      'CREATE INDEX payments_payment_method_id_idx ON payments (payment_method_id) WHERE payment_method_id IS NOT NULL'
    );
  }
}

async function ensureCruisesTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('cruises'))) {
    await queryInterface.createTable('cruises', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      cruise_line: { type: Sequelize.STRING(255), allowNull: true },
      departure_port: { type: Sequelize.STRING(255), allowNull: true },
      destinations: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
      duration: { type: Sequelize.STRING(100), allowNull: true },
      cabin_types: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      inclusions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      exclusions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      base_price: { type: Sequelize.INTEGER, allowNull: true },
      image_url: { type: Sequelize.STRING(1000), allowNull: true },
      departure_date: { type: Sequelize.DATE, allowNull: true },
      capacity: { type: Sequelize.INTEGER, allowNull: true },
      summary: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('cruises', ['agency_id']);
    await queryInterface.addIndex('cruises', ['agency_id', 'is_active']);
    console.log('[SchemaBootstrap] Created cruises table');
  }
}

async function ensureServicesTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('services'))) {
    await queryInterface.createTable('services', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      category: { type: Sequelize.STRING(100), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      icon: { type: Sequelize.STRING(100), allowNull: true },
      base_price: { type: Sequelize.INTEGER, allowNull: true },
      image_url: { type: Sequelize.STRING(1000), allowNull: true },
      pricing_type: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'FIXED' },
      features: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      display_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('services', ['agency_id']);
    await queryInterface.addIndex('services', ['agency_id', 'is_active']);
    console.log('[SchemaBootstrap] Created services table');
  }
  await ensureColumn('services', 'image_url', { type: Sequelize.STRING(1000), allowNull: true });
}

async function ensureInvoiceTemplatesTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('invoice_templates'))) {
    await queryInterface.createTable('invoice_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      html_content: { type: Sequelize.TEXT, allowNull: false },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('invoice_templates', ['agency_id']);
    console.log('[SchemaBootstrap] Created invoice_templates table');
  }

  await ensureColumn('invoice_templates', 'config', {
    type: Sequelize.JSONB,
    allowNull: true,
    defaultValue: {},
  });
}

// Ensures the quotation/receipt builder tables exist. These power the document
// template builders and per-document PDF generation.
async function ensureDocumentTemplatesSchema() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('quotation_templates'))) {
    await queryInterface.createTable('quotation_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      html_content: { type: Sequelize.TEXT, allowNull: false },
      config: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('quotation_templates', ['agency_id']);
    console.log('[SchemaBootstrap] Created quotation_templates table');
  }
  await ensureColumn('quotation_templates', 'config', { type: Sequelize.JSONB, allowNull: true, defaultValue: {} });

  if (!(await tableExists('receipt_templates'))) {
    await queryInterface.createTable('receipt_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      html_content: { type: Sequelize.TEXT, allowNull: false },
      config: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('receipt_templates', ['agency_id']);
    console.log('[SchemaBootstrap] Created receipt_templates table');
  }

  if (!(await tableExists('itinerary_templates'))) {
    await queryInterface.createTable('itinerary_templates', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      html_content: { type: Sequelize.TEXT, allowNull: false },
      config: { type: Sequelize.JSONB, allowNull: true, defaultValue: {} },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('itinerary_templates', ['agency_id']);
    console.log('[SchemaBootstrap] Created itinerary_templates table');
  }

  if (!(await tableExists('quotations'))) {
    await queryInterface.createTable('quotations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      lead_id: { type: Sequelize.UUID, allowNull: true },
      customer_id: { type: Sequelize.UUID, allowNull: true },
      template_id: { type: Sequelize.UUID, allowNull: true },
      quotation_number: { type: Sequelize.STRING(40), allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: true },
      items: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      sub_total: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      total_amount: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      amount_in_words: { type: Sequelize.STRING(255), allowNull: true },
      status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: 'DRAFT' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('quotations', ['agency_id']);
    console.log('[SchemaBootstrap] Created quotations table');
  }
}

async function ensureVisasTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('visas'))) {
    await queryInterface.createTable('visas', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      country: { type: Sequelize.STRING(255), allowNull: false },
      visa_type: { type: Sequelize.STRING(50), allowNull: true },
      price: { type: Sequelize.INTEGER, allowNull: true },
      processing_time: { type: Sequelize.STRING(100), allowNull: true },
      validity_period: { type: Sequelize.STRING(100), allowNull: true },
      required_documents: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url: { type: Sequelize.STRING(1000), allowNull: true },
      eligibility_notes: { type: Sequelize.TEXT, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('visas', ['agency_id']);
    await queryInterface.addIndex('visas', ['agency_id', 'is_active']);
    console.log('[SchemaBootstrap] Created visas table');
  }
}

async function ensureVendorsTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('vendors'))) {
    await queryInterface.createTable('vendors', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      type: { type: Sequelize.STRING(50), allowNull: false, defaultValue: 'OTHER' },
      email: { type: Sequelize.STRING(255), allowNull: true },
      phone: { type: Sequelize.STRING(30), allowNull: true },
      gstin: { type: Sequelize.STRING(32), allowNull: true },
      address: { type: Sequelize.TEXT, allowNull: true },
      ledger_id: { type: Sequelize.UUID, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('vendors', ['agency_id']);
    await queryInterface.addIndex('vendors', ['agency_id', 'type']);
    await queryInterface.addIndex('vendors', ['ledger_id']);
    console.log('[SchemaBootstrap] Created vendors table');
  }
}

async function ensureVendorTypesTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('vendor_types'))) {
    await queryInterface.createTable('vendor_types', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      ledger_group_id: { type: Sequelize.UUID, allowNull: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('vendor_types', ['agency_id']);
    await queryInterface.addIndex('vendor_types', ['agency_id', 'name'], { unique: true });
    await queryInterface.addIndex('vendor_types', ['ledger_group_id']);
    console.log('[SchemaBootstrap] Created vendor_types table');
  }
}

async function ensureVendorPaymentsTable() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureEnumValues('enum_vendor_payments_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CRUISE',
    'VISA',
    'SERVICE',
    'CUSTOM',
  ]);

  if (!(await tableExists('vendor_payments'))) {
    await queryInterface.createTable('vendor_payments', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      vendor_id: { type: Sequelize.UUID, allowNull: false },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      vendor_bill_id: { type: Sequelize.UUID, allowNull: true },
      item_type: { type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'), allowNull: true },
      package_id: { type: Sequelize.UUID, allowNull: true },
      property_id: { type: Sequelize.UUID, allowNull: true },
      cruise_id: { type: Sequelize.UUID, allowNull: true },
      visa_id: { type: Sequelize.UUID, allowNull: true },
      service_id: { type: Sequelize.UUID, allowNull: true },
      custom_item_name: { type: Sequelize.STRING(255), allowNull: true },
      custom_item_description: { type: Sequelize.TEXT, allowNull: true },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      payment_date: { type: Sequelize.DATEONLY, allowNull: false },
      payment_mode: { type: Sequelize.STRING(50), allowNull: false },
      payment_method_id: { type: Sequelize.UUID, allowNull: true },
      reference_number: { type: Sequelize.STRING(255), allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('vendor_payments', ['agency_id']);
    await queryInterface.addIndex('vendor_payments', ['vendor_id']);
    await queryInterface.addIndex('vendor_payments', ['journal_entry_id']);
    await queryInterface.addIndex('vendor_payments', ['vendor_bill_id']);
    await queryInterface.addIndex('vendor_payments', ['payment_method_id']);
    await queryInterface.addIndex('vendor_payments', ['agency_id', 'item_type']);
    console.log('[SchemaBootstrap] Created vendor_payments table');
  }

  await ensureColumn('vendor_payments', 'item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'),
    allowNull: true,
  });
  await ensureColumn('vendor_payments', 'package_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'property_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'cruise_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'visa_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'service_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'custom_item_name', { type: Sequelize.STRING(255), allowNull: true });
  await ensureColumn('vendor_payments', 'custom_item_description', { type: Sequelize.TEXT, allowNull: true });
  await ensureColumn('vendor_payments', 'vendor_bill_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_payments', 'payment_method_id', { type: Sequelize.UUID, allowNull: true });
  await ensureIndex(
    'vendor_payments_vendor_bill_id_idx',
    'CREATE INDEX vendor_payments_vendor_bill_id_idx ON vendor_payments (vendor_bill_id) WHERE vendor_bill_id IS NOT NULL'
  );
  await ensureIndex(
    'vendor_payments_payment_method_id_idx',
    'CREATE INDEX vendor_payments_payment_method_id_idx ON vendor_payments (payment_method_id) WHERE payment_method_id IS NOT NULL'
  );
  await ensureIndex(
    'vendor_payments_agency_id_item_type',
    'CREATE INDEX vendor_payments_agency_id_item_type ON vendor_payments (agency_id, item_type)'
  );
}

async function ensureVendorBillsTable() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureEnumValues('enum_vendor_bills_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CRUISE',
    'VISA',
    'SERVICE',
    'CUSTOM',
  ]);
  await ensureEnumValues('enum_vendor_bills_status', [
    'ISSUED',
    'PARTIALLY_PAID',
    'PAID',
    'VOID',
  ]);

  if (!(await tableExists('vendor_bills'))) {
    await queryInterface.createTable('vendor_bills', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      vendor_id: { type: Sequelize.UUID, allowNull: false },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      item_type: { type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'), allowNull: true },
      package_id: { type: Sequelize.UUID, allowNull: true },
      property_id: { type: Sequelize.UUID, allowNull: true },
      cruise_id: { type: Sequelize.UUID, allowNull: true },
      visa_id: { type: Sequelize.UUID, allowNull: true },
      service_id: { type: Sequelize.UUID, allowNull: true },
      custom_item_name: { type: Sequelize.STRING(255), allowNull: true },
      custom_item_description: { type: Sequelize.TEXT, allowNull: true },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      paid_amount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      bill_date: { type: Sequelize.DATEONLY, allowNull: false },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      status: { type: Sequelize.ENUM('ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'), allowNull: false, defaultValue: 'ISSUED' },
      reference_number: { type: Sequelize.STRING(255), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('vendor_bills', ['agency_id']);
    await queryInterface.addIndex('vendor_bills', ['vendor_id']);
    await queryInterface.addIndex('vendor_bills', ['journal_entry_id']);
    await queryInterface.addIndex('vendor_bills', ['agency_id', 'status']);
    await queryInterface.addIndex('vendor_bills', ['agency_id', 'vendor_id', 'status']);
    await queryInterface.addIndex('vendor_bills', ['agency_id', 'item_type']);
    console.log('[SchemaBootstrap] Created vendor_bills table');
  }

  await ensureColumn('vendor_bills', 'item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE', 'CUSTOM'),
    allowNull: true,
  });
  await ensureColumn('vendor_bills', 'package_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_bills', 'property_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_bills', 'cruise_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_bills', 'visa_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_bills', 'service_id', { type: Sequelize.UUID, allowNull: true });
  await ensureColumn('vendor_bills', 'custom_item_name', { type: Sequelize.STRING(255), allowNull: true });
  await ensureColumn('vendor_bills', 'custom_item_description', { type: Sequelize.TEXT, allowNull: true });
  await ensureColumn('vendor_bills', 'paid_amount', { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 });
  await ensureColumn('vendor_bills', 'due_date', { type: Sequelize.DATEONLY, allowNull: true });
  await ensureColumn('vendor_bills', 'metadata', { type: Sequelize.JSONB, allowNull: false, defaultValue: {} });
  await ensureIndex(
    'vendor_bills_agency_status_idx',
    'CREATE INDEX vendor_bills_agency_status_idx ON vendor_bills (agency_id, status)'
  );
  await ensureIndex(
    'vendor_bills_agency_vendor_status_idx',
    'CREATE INDEX vendor_bills_agency_vendor_status_idx ON vendor_bills (agency_id, vendor_id, status)'
  );
  await ensureIndex(
    'vendor_bills_agency_item_type_idx',
    'CREATE INDEX vendor_bills_agency_item_type_idx ON vendor_bills (agency_id, item_type)'
  );
}

async function ensurePackageVendorCostsTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('package_vendor_costs'))) {
    await queryInterface.createTable('package_vendor_costs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      package_id: { type: Sequelize.UUID, allowNull: false },
      vendor_id: { type: Sequelize.UUID, allowNull: false },
      service_label: { type: Sequelize.STRING(120), allowNull: false },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('package_vendor_costs', ['agency_id']);
    await queryInterface.addIndex('package_vendor_costs', ['agency_id', 'package_id']);
    await queryInterface.addIndex('package_vendor_costs', ['vendor_id']);
    await queryInterface.addIndex('package_vendor_costs', ['due_date']);
    console.log('[SchemaBootstrap] Created package_vendor_costs table');
  }
}

async function ensureItemVendorCostsTable() {
  const queryInterface = sequelize.getQueryInterface();
  await ensureEnumValues('enum_item_vendor_costs_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CRUISE',
    'VISA',
    'SERVICE',
  ]);

  if (!(await tableExists('item_vendor_costs'))) {
    await queryInterface.createTable('item_vendor_costs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      item_type: { type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CRUISE', 'VISA', 'SERVICE'), allowNull: false },
      package_id: { type: Sequelize.UUID, allowNull: true },
      property_id: { type: Sequelize.UUID, allowNull: true },
      cruise_id: { type: Sequelize.UUID, allowNull: true },
      visa_id: { type: Sequelize.UUID, allowNull: true },
      service_id: { type: Sequelize.UUID, allowNull: true },
      vendor_id: { type: Sequelize.UUID, allowNull: false },
      service_label: { type: Sequelize.STRING(120), allowNull: false },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      due_date: { type: Sequelize.DATEONLY, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      journal_entry_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('item_vendor_costs', ['agency_id']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type', 'package_id']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type', 'property_id']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type', 'cruise_id']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type', 'visa_id']);
    await queryInterface.addIndex('item_vendor_costs', ['agency_id', 'item_type', 'service_id']);
    await queryInterface.addIndex('item_vendor_costs', ['vendor_id']);
    await queryInterface.addIndex('item_vendor_costs', ['due_date']);
    console.log('[SchemaBootstrap] Created item_vendor_costs table');
  }

  await ensureColumn('item_vendor_costs', 'journal_entry_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });
  await ensureIndex(
    'idx_item_vendor_costs_journal_entry_id',
    'CREATE INDEX idx_item_vendor_costs_journal_entry_id ON item_vendor_costs (journal_entry_id)'
  );
}

async function ensurePipelineStagesTable() {
  const queryInterface = sequelize.getQueryInterface();

  await ensureEnumValues('enum_pipeline_stages_kind', ['OPEN', 'WON', 'LOST']);

  if (await tableExists('pipeline_stages')) {
    return;
  }

  await queryInterface.createTable('pipeline_stages', {
    id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
    agency_id: { type: Sequelize.UUID, allowNull: false },
    name: { type: Sequelize.STRING(80), allowNull: false },
    position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    color: { type: Sequelize.STRING(9), allowNull: false, defaultValue: '#5b7c99' },
    lead_statuses: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
    kind: { type: Sequelize.ENUM('OPEN', 'WON', 'LOST'), allowNull: false, defaultValue: 'OPEN' },
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  });

  await queryInterface.addIndex('pipeline_stages', ['agency_id']);
  await queryInterface.addIndex('pipeline_stages', ['agency_id', 'position']);
  console.log('[SchemaBootstrap] Created pipeline_stages table');
}

async function ensureHrmTables() {
  const queryInterface = sequelize.getQueryInterface();
  const ts = {
    created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
  };

  if (!(await tableExists('employee_profiles'))) {
    await queryInterface.createTable('employee_profiles', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      agent_id: { type: Sequelize.UUID, allowNull: false },
      employee_code: { type: Sequelize.STRING(40), allowNull: true },
      department: { type: Sequelize.STRING(100), allowNull: true },
      designation: { type: Sequelize.STRING(100), allowNull: true },
      employment_type: { type: Sequelize.ENUM('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'), allowNull: false, defaultValue: 'FULL_TIME' },
      joining_date: { type: Sequelize.DATEONLY, allowNull: true },
      monthly_salary: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      weekly_off_days: { type: Sequelize.JSONB, allowNull: false, defaultValue: [0] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('employee_profiles', ['agency_id', 'agent_id'], { unique: true });
    await queryInterface.addIndex('employee_profiles', ['agency_id']);
    console.log('[SchemaBootstrap] Created employee_profiles table');
  }

  if (!(await tableExists('attendances'))) {
    await queryInterface.createTable('attendances', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      agent_id: { type: Sequelize.UUID, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      punch_in_at: { type: Sequelize.DATE, allowNull: true },
      punch_out_at: { type: Sequelize.DATE, allowNull: true },
      punch_in_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      punch_in_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      punch_in_accuracy: { type: Sequelize.INTEGER, allowNull: true },
      punch_out_lat: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      punch_out_lng: { type: Sequelize.DECIMAL(10, 7), allowNull: true },
      punch_out_accuracy: { type: Sequelize.INTEGER, allowNull: true },
      status: { type: Sequelize.ENUM('PRESENT', 'HALF_DAY', 'ABSENT', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY'), allowNull: false, defaultValue: 'PRESENT' },
      is_late: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      worked_minutes: { type: Sequelize.INTEGER, allowNull: true },
      source: { type: Sequelize.ENUM('SELF', 'ADMIN'), allowNull: false, defaultValue: 'SELF' },
      notes: { type: Sequelize.STRING(500), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('attendances', ['agency_id', 'agent_id', 'date'], { unique: true });
    await queryInterface.addIndex('attendances', ['agency_id', 'date']);
    console.log('[SchemaBootstrap] Created attendances table');
  }

  // Punch geolocation — added to existing attendances tables.
  await ensureColumn('attendances', 'punch_in_lat', { type: Sequelize.DECIMAL(10, 7), allowNull: true });
  await ensureColumn('attendances', 'punch_in_lng', { type: Sequelize.DECIMAL(10, 7), allowNull: true });
  await ensureColumn('attendances', 'punch_in_accuracy', { type: Sequelize.INTEGER, allowNull: true });
  await ensureColumn('attendances', 'punch_out_lat', { type: Sequelize.DECIMAL(10, 7), allowNull: true });
  await ensureColumn('attendances', 'punch_out_lng', { type: Sequelize.DECIMAL(10, 7), allowNull: true });
  await ensureColumn('attendances', 'punch_out_accuracy', { type: Sequelize.INTEGER, allowNull: true });

  if (!(await tableExists('leave_types'))) {
    await queryInterface.createTable('leave_types', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      name: { type: Sequelize.STRING(80), allowNull: false },
      code: { type: Sequelize.STRING(20), allowNull: false },
      is_paid: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      annual_quota: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      color: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '#6366f1' },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('leave_types', ['agency_id', 'code'], { unique: true });
    await queryInterface.addIndex('leave_types', ['agency_id']);
    console.log('[SchemaBootstrap] Created leave_types table');
  }

  if (!(await tableExists('leave_requests'))) {
    await queryInterface.createTable('leave_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      agent_id: { type: Sequelize.UUID, allowNull: false },
      leave_type_id: { type: Sequelize.UUID, allowNull: false },
      start_date: { type: Sequelize.DATEONLY, allowNull: false },
      end_date: { type: Sequelize.DATEONLY, allowNull: false },
      is_half_day: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      day_count: { type: Sequelize.DECIMAL(4, 1), allowNull: false, defaultValue: 1 },
      reason: { type: Sequelize.STRING(500), allowNull: true },
      status: { type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'), allowNull: false, defaultValue: 'PENDING' },
      reviewed_by_agent_id: { type: Sequelize.UUID, allowNull: true },
      reviewed_at: { type: Sequelize.DATE, allowNull: true },
      review_note: { type: Sequelize.STRING(500), allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('leave_requests', ['agency_id', 'status']);
    await queryInterface.addIndex('leave_requests', ['agency_id', 'agent_id']);
    await queryInterface.addIndex('leave_requests', ['agency_id', 'start_date']);
    console.log('[SchemaBootstrap] Created leave_requests table');
  }

  if (!(await tableExists('holidays'))) {
    await queryInterface.createTable('holidays', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false },
      ...ts,
    });
    await queryInterface.addIndex('holidays', ['agency_id', 'date'], { unique: true });
    await queryInterface.addIndex('holidays', ['agency_id']);
    console.log('[SchemaBootstrap] Created holidays table');
  }

  if (!(await tableExists('hrm_settings'))) {
    await queryInterface.createTable('hrm_settings', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      workday_start_time: { type: Sequelize.STRING(5), allowNull: false, defaultValue: '09:30' },
      grace_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 15 },
      full_day_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 480 },
      half_day_minutes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 240 },
      default_weekly_off_days: { type: Sequelize.JSONB, allowNull: false, defaultValue: [0] },
      payroll_days_basis: { type: Sequelize.ENUM('CALENDAR', 'WORKING', 'FIXED_30'), allowNull: false, defaultValue: 'WORKING' },
      force_punch_in: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...ts,
    });
    await queryInterface.addIndex('hrm_settings', ['agency_id'], { unique: true });
    console.log('[SchemaBootstrap] Created hrm_settings table');
  }

  await ensureColumn('hrm_settings', 'force_punch_in', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });

  if (!(await tableExists('payslips'))) {
    await queryInterface.createTable('payslips', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      agent_id: { type: Sequelize.UUID, allowNull: false },
      period_month: { type: Sequelize.STRING(7), allowNull: false },
      base_salary: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      earnings: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      deductions: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      working_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      paid_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      unpaid_days: { type: Sequelize.DECIMAL(5, 1), allowNull: false, defaultValue: 0 },
      loss_of_pay: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      gross_pay: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      net_pay: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      status: { type: Sequelize.ENUM('DRAFT', 'FINALIZED', 'PAID'), allowNull: false, defaultValue: 'DRAFT' },
      notes: { type: Sequelize.STRING(500), allowNull: true },
      generated_at: { type: Sequelize.DATE, allowNull: true },
      paid_at: { type: Sequelize.DATE, allowNull: true },
      ...ts,
    });
    await queryInterface.addIndex('payslips', ['agency_id', 'agent_id', 'period_month'], { unique: true });
    await queryInterface.addIndex('payslips', ['agency_id', 'period_month']);
    console.log('[SchemaBootstrap] Created payslips table');
  }
}

async function ensureAgencyApiKeysTable() {
  const queryInterface = sequelize.getQueryInterface();
  if (!(await tableExists('agency_api_keys'))) {
    await queryInterface.createTable('agency_api_keys', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      label: { type: Sequelize.STRING(120), allowNull: true },
      key_id: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      key_prefix: { type: Sequelize.STRING(60), allowNull: false },
      key_hash: { type: Sequelize.STRING(64), allowNull: false },
      scopes: { type: Sequelize.JSONB, allowNull: false, defaultValue: ['catalog:read', 'leads:write'] },
      allowed_origins: { type: Sequelize.JSONB, allowNull: false, defaultValue: [] },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      revoked_at: { type: Sequelize.DATE, allowNull: true },
      last_used_at: { type: Sequelize.DATE, allowNull: true },
      last_used_ip: { type: Sequelize.STRING(64), allowNull: true },
      request_count: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      created_by_agent_id: { type: Sequelize.UUID, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('agency_api_keys', ['key_id'], { unique: true });
    await queryInterface.addIndex('agency_api_keys', ['agency_id']);
    await queryInterface.addIndex('agency_api_keys', ['agency_id', 'is_active']);
    console.log('[SchemaBootstrap] Created agency_api_keys table');
  }
}

async function ensureActivityLogsTable() {
  const queryInterface = sequelize.getQueryInterface();

  if (!(await tableExists('activity_logs'))) {
    await queryInterface.createTable('activity_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      agency_id: { type: Sequelize.UUID, allowNull: false },
      actor_id: { type: Sequelize.UUID, allowNull: true },
      actor_name: { type: Sequelize.STRING(160), allowNull: true },
      action: { type: Sequelize.STRING(120), allowNull: false },
      module: { type: Sequelize.STRING(40), allowNull: false },
      target_type: { type: Sequelize.STRING(80), allowNull: true },
      target_id: { type: Sequelize.UUID, allowNull: true },
      summary: { type: Sequelize.STRING(300), allowNull: true },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      ip_address: { type: Sequelize.STRING(80), allowNull: true },
      user_agent: { type: Sequelize.STRING(500), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('activity_logs', ['agency_id', 'created_at']);
    await queryInterface.addIndex('activity_logs', ['agency_id', 'actor_id']);
    await queryInterface.addIndex('activity_logs', ['agency_id', 'module']);
    await queryInterface.addIndex('activity_logs', ['target_type', 'target_id']);
    console.log('[SchemaBootstrap] Created activity_logs table');
  }
}

async function ensureProductionSchema() {
  await ensureLeadsSchema();
  await ensureLeadSourcesSchema();
  await ensureAgenciesSchema();
  await ensureAgencyChannelsSchema();
  await ensureAgentsSchema();
  await ensurePackagesSchema();
  await ensureCustomersSchema();
  await ensurePropertiesSchema();
  await ensureBookingsSchema();
  await ensureItinerariesSchema();
  await ensureCampaignsSchema();
  await ensureWhatsAppFlowsSchema();
  await ensureServiceRoutingRulesTable();
  await ensureFollowUpsTable();
  await ensureLeadNotesTable();
  await ensureCallLogsTable();
  await ensurePipelineStagesTable();
  await ensureInstagramAutomationTables();
  await ensureMetaAdsTables();
  await ensurePlatformAdminTables();
  await ensurePartnersSchema();
  await ensureAccountingTables();
  await ensureServicesTable();
  await ensureInvoiceTemplatesTable();
  await ensureDocumentTemplatesSchema();
  await ensureCruisesTable();
  await ensureVisasTable();
  await ensureVendorTypesTable();
  await ensureVendorsTable();
  await ensureVendorBillsTable();
  await ensureVendorPaymentsTable();
  await ensurePackageVendorCostsTable();
  await ensureItemVendorCostsTable();
  await ensureHrmTables();
  await ensureAgencyApiKeysTable();
  await ensureActivityLogsTable();
}

module.exports = {
  ensureProductionSchema,
  ensureAccountingTables,
  ensureHrmTables,
};
