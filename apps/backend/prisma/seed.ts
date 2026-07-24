import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin@MiniSOC2026!', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@minisoc.local' },
    update: {},
    create: {
      email: 'admin@minisoc.local',
      name: 'SOC Administrator',
      passwordHash: adminPassword,
      roles: ['admin'],
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user created: ${admin.email}`);

  // Create analyst L1
  const l1Password = await bcrypt.hash('Analyst1@SOC2026!', 12);
  const analyst1 = await prisma.user.upsert({
    where: { email: 'analyst.l1@minisoc.local' },
    update: {},
    create: {
      email: 'analyst.l1@minisoc.local',
      name: 'Analyst Level 1',
      passwordHash: l1Password,
      roles: ['analyst_l1'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L1 created: ${analyst1.email}`);

  // Create analyst L2
  const l2Password = await bcrypt.hash('Analyst2@SOC2026!', 12);
  const analyst2 = await prisma.user.upsert({
    where: { email: 'analyst.l2@minisoc.local' },
    update: {},
    create: {
      email: 'analyst.l2@minisoc.local',
      name: 'Analyst Level 2',
      passwordHash: l2Password,
      roles: ['analyst_l2'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L2 created: ${analyst2.email}`);

  // Create sample assets
  const assets = [
    { hostname: 'web-server-01', ipAddress: '10.0.2.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'high' as const, department: 'Production' },
    { hostname: 'db-server-01', ipAddress: '10.0.2.11', os: 'Ubuntu', osVersion: '22.04', criticality: 'critical' as const, department: 'Production' },
    { hostname: 'app-server-01', ipAddress: '10.0.2.12', os: 'Ubuntu', osVersion: '22.04', criticality: 'high' as const, department: 'Production' },
    { hostname: 'dev-workstation-01', ipAddress: '10.0.3.10', os: 'Windows', osVersion: '11', criticality: 'medium' as const, department: 'Development' },
    { hostname: 'soc-analyst-01', ipAddress: '10.0.4.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'medium' as const, department: 'Security' },
  ];

  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { id: undefined },
      update: {},
      create: asset,
    });
  }
  console.log(`  ✓ ${assets.length} assets created`);

  // Create sample IOCs
  const iocs = [
    { type: 'ip' as const, value: '203.0.113.42', description: 'Known C2 server', source: 'misp', confidence: 90, severity: 'high' as const },
    { type: 'domain' as const, value: 'malware-c2.evil.tk', description: 'Malware distribution domain', source: 'virustotal', confidence: 95, severity: 'critical' as const },
    { type: 'hash_sha256' as const, value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware sample', source: 'manual', confidence: 100, severity: 'critical' as const },
    { type: 'ip' as const, value: '198.51.100.23', description: 'Port scanner', source: 'abuseipdb', confidence: 75, severity: 'medium' as const },
  ];

  for (const ioc of iocs) {
    await prisma.iOC.create({ data: { ...ioc, createdById: admin.id, mitreTechniques: [], relatedIncidents: [] } });
  }
  console.log(`  ✓ ${iocs.length} IOCs created`);

  // Create sample incident
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

  console.log('\n✅ Seeding completed!');
  console.log('\nDefault credentials:');
  console.log('  Admin: admin@minisoc.local / Admin@MiniSOC2026!');
  console.log('  L1:    analyst.l1@minisoc.local / Analyst1@SOC2026!');
  console.log('  L2:    analyst.l2@minisoc.local / Analyst2@SOC2026!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
