import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Création / Mise à jour Administrateur
  const adminPassword = await bcrypt.hash('Admin@MiniSOC2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@minisoc.local' },
    update: { passwordHash: adminPassword },
    create: {
      email: 'admin@minisoc.local',
      name: 'SOC Administrator',
      passwordHash: adminPassword,
      roles: ['admin'],
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user ready: ${admin.email}`);

  // 2. Analyste L1
  const l1Password = await bcrypt.hash('Analyst1@SOC2026!', 12);
  const analyst1 = await prisma.user.upsert({
    where: { email: 'analyst.l1@minisoc.local' },
    update: { passwordHash: l1Password },
    create: {
      email: 'analyst.l1@minisoc.local',
      name: 'Analyst Level 1',
      passwordHash: l1Password,
      roles: ['analyst_l1'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L1 ready: ${analyst1.email}`);

  // 3. Analyste L2
  const l2Password = await bcrypt.hash('Analyst2@SOC2026!', 12);
  const analyst2 = await prisma.user.upsert({
    where: { email: 'analyst.l2@minisoc.local' },
    update: { passwordHash: l2Password },
    create: {
      email: 'analyst.l2@minisoc.local',
      name: 'Analyst Level 2',
      passwordHash: l2Password,
      roles: ['analyst_l2'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L2 ready: ${analyst2.email}`);

  // 4. Seeding des Assets (Utilisation de hostname comme clé unique)
  const assets = [
    { hostname: 'web-server-01', ipAddress: '10.0.2.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'high', department: 'Production' },
    { hostname: 'db-server-01', ipAddress: '10.0.2.11', os: 'Ubuntu', osVersion: '22.04', criticality: 'critical', department: 'Production' },
    { hostname: 'app-server-01', ipAddress: '10.0.2.12', os: 'Ubuntu', osVersion: '22.04', criticality: 'high', department: 'Production' },
    { hostname: 'dev-workstation-01', ipAddress: '10.0.3.10', os: 'Windows', osVersion: '11', criticality: 'medium', department: 'Development' },
    { hostname: 'soc-analyst-01', ipAddress: '10.0.4.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'medium', department: 'Security' },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { hostname: asset.hostname },
      update: asset,
      create: asset,
    });
  }
  console.log(`  ✓ ${assets.length} assets ready`);

  // 5. Seeding des IOCs
  const iocs = [
    { type: 'ip', value: '203.0.113.42', description: 'Known C2 server', source: 'misp', confidence: 90, severity: 'high' },
    { type: 'domain', value: 'malware-c2.evil.tk', description: 'Malware distribution domain', source: 'virustotal', confidence: 95, severity: 'critical' },
    { type: 'hash_sha256', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware sample', source: 'manual', confidence: 100, severity: 'critical' },
    { type: 'ip', value: '198.51.100.23', description: 'Port scanner', source: 'abuseipdb', confidence: 75, severity: 'medium' },
  ];

  for (const ioc of iocs) {
    await prisma.iOC.upsert({
      where: { value: ioc.value },
      update: ioc,
      create: {
        ...ioc,
        createdById: admin.id,
        mitreTechniques: [],
        relatedIncidents: [],
      },
    });
  }
  console.log(`  ✓ ${iocs.length} IOCs ready`);

  // 6. Exemple d'incident
  const existingIncident = await prisma.incident.findFirst({
    where: { title: 'SSH Brute Force Attack on web-server-01' },
  });

  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        title: 'SSH Brute Force Attack on web-server-01',
        description: 'Multiple failed SSH login attempts detected from external IP 203.0.113.42. Over 500 attempts in 10 minutes. Active Response triggered: IP blocked.',
        severity: 'high',
        status: 'contained',
        category: 'brute_force',
        mitreTactics: ['TA0001'],
        mitreTechniques: ['T1110.001'],
        source: 'wazuh',
        riskScore: 72,
        assignedToId: analyst2.id,
        createdById: admin.id,
        detectedAt: new Date(Date.now() - 3600000),
        acknowledgedAt: new Date(Date.now() - 3500000),
        containedAt: new Date(Date.now() - 3400000),
        sourceAlertIds: [],
        affectedAssets: ['web-server-01'],
        affectedUsers: [],
        tags: ['ssh', 'brute-force', 'external', 'blocked'],
      },
    });
    console.log('  ✓ Sample incident created');
  }

  console.log('\n✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });