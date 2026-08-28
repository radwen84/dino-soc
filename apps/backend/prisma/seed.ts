import {
  PrismaClient,
  Role,
  AssetCriticality,
  IOCType,
  IOCSeverity,
  IncidentSeverity,
  IncidentStatus,
  IncidentCategory,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Administrateur
  const adminPassword = await bcrypt.hash('Admin@MiniSOC2026!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@minisoc.local' },
    update: {
      passwordHash: adminPassword,
      role: Role.ADMIN,
      firstName: 'SOC',
      lastName: 'Administrator',
      isActive: true,
    },
    create: {
      email: 'admin@minisoc.local',
      passwordHash: adminPassword,
      role: Role.ADMIN,
      firstName: 'SOC',
      lastName: 'Administrator',
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user ready: ${admin.email}`);

  // 2. Analyste L1
  const l1Password = await bcrypt.hash('Analyst1@SOC2026!', 10);
  const analyst1 = await prisma.user.upsert({
    where: { email: 'analyst.l1@minisoc.local' },
    update: {
      passwordHash: l1Password,
      role: Role.ANALYST,
      firstName: 'Analyst',
      lastName: 'Level 1',
      isActive: true,
    },
    create: {
      email: 'analyst.l1@minisoc.local',
      passwordHash: l1Password,
      role: Role.ANALYST,
      firstName: 'Analyst',
      lastName: 'Level 1',
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L1 ready: ${analyst1.email}`);

  // 3. Analyste L2
  const l2Password = await bcrypt.hash('Analyst2@SOC2026!', 10);
  const analyst2 = await prisma.user.upsert({
    where: { email: 'analyst.l2@minisoc.local' },
    update: {
      passwordHash: l2Password,
      role: Role.ANALYST,
      firstName: 'Analyst',
      lastName: 'Level 2',
      isActive: true,
    },
    create: {
      email: 'analyst.l2@minisoc.local',
      passwordHash: l2Password,
      role: Role.ANALYST,
      firstName: 'Analyst',
      lastName: 'Level 2',
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L2 ready: ${analyst2.email}`);

  // 4. Seeding des Assets
  const assetsData = [
    { hostname: 'web-server-01', ipAddress: '10.0.2.10', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.HIGH, department: 'Production' },
    { hostname: 'db-server-01', ipAddress: '10.0.2.11', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.CRITICAL, department: 'Production' },
    { hostname: 'app-server-01', ipAddress: '10.0.2.12', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.HIGH, department: 'Production' },
    { hostname: 'dev-workstation-01', ipAddress: '10.0.3.10', os: 'Windows', osVersion: '11', criticality: AssetCriticality.MEDIUM, department: 'Development' },
    { hostname: 'soc-analyst-01', ipAddress: '10.0.4.10', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.MEDIUM, department: 'Security' },
  ];

  for (const asset of assetsData) {
    const existingAsset = await prisma.asset.findFirst({
      where: { hostname: asset.hostname },
    });

    if (existingAsset) {
      await prisma.asset.update({
        where: { id: existingAsset.id },
        data: asset,
      });
    } else {
      await prisma.asset.create({
        data: asset,
      });
    }
  }
  console.log(`  ✓ ${assetsData.length} assets ready`);

  // 5. Seeding des IOCs
  const iocsData = [
    { type: IOCType.IP, value: '203.0.113.42', description: 'Known C2 server', source: 'misp', confidence: 90, severity: IOCSeverity.HIGH },
    { type: IOCType.DOMAIN, value: 'malware-c2.evil.tk', description: 'Malware distribution domain', source: 'virustotal', confidence: 95, severity: IOCSeverity.CRITICAL },
    { type: IOCType.HASH_SHA256, value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware sample', source: 'manual', confidence: 100, severity: IOCSeverity.CRITICAL },
    { type: IOCType.IP, value: '198.51.100.23', description: 'Port scanner', source: 'abuseipdb', confidence: 75, severity: IOCSeverity.MEDIUM },
  ];

  for (const ioc of iocsData) {
    const existingIOC = await prisma.iOC.findFirst({
      where: { value: ioc.value },
    });

    if (existingIOC) {
      await prisma.iOC.update({
        where: { id: existingIOC.id },
        data: ioc,
      });
    } else {
      await prisma.iOC.create({
        data: {
          ...ioc,
          createdBy: {
            connect: { id: admin.id },
          },
        },
      });
    }
  }
  console.log(`  ✓ ${iocsData.length} IOCs ready`);

  // 6. Exemple d'incident
  const existingIncident = await prisma.incident.findFirst({
    where: { title: 'SSH Brute Force Attack on web-server-01' },
  });

  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        title: 'SSH Brute Force Attack on web-server-01',
        description: 'Multiple failed SSH login attempts detected from external IP 203.0.113.42. Over 500 attempts in 10 minutes. Active Response triggered: IP blocked.',
        severity: IncidentSeverity.HIGH,
        status: IncidentStatus.CONTAINED,
        category: IncidentCategory.UNAUTHORIZED_ACCESS,
        mitreTactics: ['TA0001'],
        mitreTechniques: ['T1110.001'],
        source: 'wazuh',
        riskScore: 72,
        assignedTo: {
          connect: { id: analyst2.id },
        },
        createdBy: {
          connect: { id: admin.id },
        },
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