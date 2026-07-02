const { Lead, PipelineStage, Agency, sequelize } = require('../models');
const pipelineService = require('../services/pipelineService');

async function migrate() {
  console.log('Starting pipeline stage migration...');

  try {
    const agencies = await Agency.findAll({ attributes: ['id'] });
    console.log(`Found ${agencies.length} agencies to migrate.`);

    for (const agency of agencies) {
      console.log(`Ensuring default stages for agency ${agency.id}...`);
      await pipelineService.ensureDefaultStages(agency.id);
      
      const stages = await PipelineStage.findAll({ where: { agencyId: agency.id } });
      const stageMap = {};
      let fallbackStageId = null;

      for (const stage of stages) {
        if (!fallbackStageId && stage.kind === 'OPEN') {
          fallbackStageId = stage.id;
        }
        for (const status of stage.leadStatuses || []) {
          stageMap[status] = stage.id;
        }
      }

      console.log(`Migrating leads for agency ${agency.id}...`);
      const leads = await Lead.findAll({ where: { agencyId: agency.id } });
      
      let migratedCount = 0;
      for (const lead of leads) {
        // A status-less lead stays stageless — status is optional, never forced.
        const hasStatus = lead.status !== null && lead.status !== undefined && lead.status !== '' && lead.status !== 'JUST_CONTACTED';
        if (!hasStatus) continue;

        // A real-but-unmapped status falls back to the first OPEN stage so it
        // still shows somewhere in the funnel.
        const newStageId = stageMap[lead.status] || stageMap['UNKNOWN'] || fallbackStageId;

        if (newStageId && lead.pipelineStageId !== newStageId) {
          // silent:true so backfilling the stage does NOT bump updated_at —
          // otherwise every migrated lead shows "Last activity: just now".
          await lead.update({ pipelineStageId: newStageId }, { silent: true });
          migratedCount++;
        }
      }
      console.log(`Migrated ${migratedCount} leads for agency ${agency.id}.`);
    }

    console.log('Migration completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrate();
