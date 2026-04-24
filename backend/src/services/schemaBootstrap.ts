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

  await ensureEnumValues('enum_leads_item_type', [
    'PACKAGE',
    'PROPERTY',
    'CUSTOM_TRIP',
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

  await ensureColumn('leads', 'property_id', {
    type: Sequelize.UUID,
    allowNull: true,
  });

  await ensureColumn('leads', 'item_type', {
    type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP'),
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
  await ensureColumn('properties', 'is_active', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: true,
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
        type: Sequelize.ENUM('PACKAGE', 'PROPERTY', 'CUSTOM_TRIP', 'GENERIC'),
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
  }
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

async function ensureProductionSchema() {
  await ensureLeadsSchema();
  await ensureAgenciesSchema();
  await ensureCustomersSchema();
  await ensurePropertiesSchema();
  await ensureBookingsSchema();
  await ensureItinerariesSchema();
  await ensureCampaignsSchema();
  await ensureWhatsAppFlowsSchema();
  await ensureFollowUpsTable();
  await ensureLeadNotesTable();
  await ensureInstagramAutomationTables();
}

module.exports = {
  ensureProductionSchema,
};
