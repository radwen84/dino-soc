-- AlterTable: Add wazuhAlertId to alerts
ALTER TABLE "alerts" ADD COLUMN "wazuh_alert_id" VARCHAR(255);

-- CreateIndex: unique constraint on wazuh_alert_id
CREATE UNIQUE INDEX "alerts_wazuh_alert_id_key" ON "alerts"("wazuh_alert_id");

-- CreateIndex: index on agent_id for Phase 3 asset correlation
CREATE INDEX "alerts_agent_id_idx" ON "alerts"("agent_id");
