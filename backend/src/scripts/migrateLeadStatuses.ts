import { sequelize } from '../models';

async function migrateLeadStatuses() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected to database.');

    // Start a transaction for safety
    await sequelize.transaction(async (transaction) => {
      console.log('Mapping existing old statuses to new compatible values...');

      // Update old statuses to the intended new statuses.
      // Assuming existing valid ENUM doesn't throw on string assignment, but just in case, we do it after recreating type
      // Wait, Postgres allows direct string cast if the new enum has it.
      // But we must do it all in SQL for the enum type replacement.

      const script = `
        ALTER TYPE enum_leads_status RENAME TO enum_leads_status_old;
        CREATE TYPE enum_leads_status AS ENUM('JUST_CONTACTED', 'PACKAGE_SEARCHED', 'PACKAGE_INTERESTED', 'CONTACTED', 'BOOKED', 'LOST', 'UNKNOWN');
        
        ALTER TABLE leads ALTER COLUMN status DROP DEFAULT;
        
        -- Update the column to the new type mapping old enum string values to new enum string values
        ALTER TABLE leads ALTER COLUMN status TYPE enum_leads_status USING (
          CASE status::text
            WHEN 'NEW' THEN 'JUST_CONTACTED'::enum_leads_status
            WHEN 'ENQUIRY' THEN 'PACKAGE_SEARCHED'::enum_leads_status
            WHEN 'QUOTED' THEN 'CONTACTED'::enum_leads_status
            WHEN 'NEGOTIATING' THEN 'CONTACTED'::enum_leads_status
            WHEN 'CANCELLED' THEN 'LOST'::enum_leads_status
            WHEN 'JUST_CONTACTED' THEN 'JUST_CONTACTED'::enum_leads_status
            WHEN 'CONTACTED' THEN 'CONTACTED'::enum_leads_status
            WHEN 'BOOKED' THEN 'BOOKED'::enum_leads_status
            WHEN 'LOST' THEN 'LOST'::enum_leads_status
            ELSE 'JUST_CONTACTED'::enum_leads_status
          END
        );
        
        ALTER TABLE leads ALTER COLUMN status SET DEFAULT 'JUST_CONTACTED';
        
        DROP TYPE enum_leads_status_old;
      `;

      await sequelize.query(script, { transaction });
      
      console.log('Statuses successfully migrated and ENUM type updated.');
    });

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await sequelize.close();
  }
}

migrateLeadStatuses();
