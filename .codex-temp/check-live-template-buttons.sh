#!/usr/bin/env bash
set -euo pipefail
sudo -u postgres psql -d travelbot -At -F '|' -c "select display_name, status, template_type, jsonb_array_length(coalesce(buttons, '[]'::jsonb)) as button_count from message_templates where agency_id is not null and status = 'APPROVED' order by updated_at desc limit 20;"
