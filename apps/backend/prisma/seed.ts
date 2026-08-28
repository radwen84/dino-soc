import { PrismaClient, IncidentSeverity, AssetCriticality, IOCType, IncidentStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Mot de passe par défaut
  const defaultPasswordHash = await bcrypt.hash('Admin@MiniSOC2026!', 10);

  // 2. Utilisateurs (Adaptés au modèle User avec `name` et `roles`)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@minisoc.local' },
    update: { passwordHash: defaultPasswordHash, isActive: true },
    create: {
      email: 'admin@minisoc.local',
      name: 'SOC Administrator',
      passwordHash: defaultPasswordHash,
      roles: ['admin'],
      isActive: true,
    },
  });
  console.log(`  ✓ Admin user ready: ${admin.email}`);

  const analyst1 = await prisma.user.upsert({
    where: { email: 'analyst.l1@minisoc.local' },
    update: { passwordHash: defaultPasswordHash, isActive: true },
    create: {
      email: 'analyst.l1@minisoc.local',
      name: 'Analyst Level 1',
      passwordHash: defaultPasswordHash,
      roles: ['analyst_l1'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L1 ready: ${analyst1.email}`);

  const analyst2 = await prisma.user.upsert({
    where: { email: 'analyst.l2@minisoc.local' },
    update: { passwordHash: defaultPasswordHash, isActive: true },
    create: {
      email: 'analyst.l2@minisoc.local',
      name: 'Analyst Level 2',
      passwordHash: defaultPasswordHash,
      roles: ['analyst_l2'],
      isActive: true,
    },
  });
  console.log(`  ✓ Analyst L2 ready: ${analyst2.email}`);

  // 3. Assets (Correction de la recherche sans utiliser `id: undefined`)
  const assetsData = [
    { hostname: 'web-server-01', ipAddress: '10.0.2.10', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.high, department: 'Production' },
    { hostname: 'db-server-01', ipAddress: '10.0.2.11', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.critical, department: 'Production' },
    { hostname: 'app-server-01', ipAddress: '10.0.2.12', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.high, department: 'Production' },
    { hostname: 'dev-workstation-01', ipAddress: '10.0.3.10', os: 'Windows', osVersion: '11', criticality: AssetCriticality.medium, department: 'Development' },
    { hostname: 'soc-analyst-01', ipAddress: '10.0.4.10', os: 'Ubuntu', osVersion: '22.04', criticality: AssetCriticality.medium, department: 'Security' },
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

  // 4. IOCs (Utilisation des Enums Prisma)
  const iocsData = [
    { type: IOCType.ip, value: '203.0.113.42', description: 'Known C2 server', source: 'misp', confidence: 90, severity: IncidentSeverity.high },
    { type: IOCType.domain, value: 'malware-c2.evil.tk', description: 'Malware distribution domain', source: 'virustotal', confidence: 95, severity: IncidentSeverity.critical },
    { type: IOCType.hash_sha256, value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware sample', source: 'manual', confidence: 100, severity: IncidentSeverity.critical },
    { type: IOCType.ip, value: '198.51.100.23', description: 'Port scanner', source: 'abuseipdb', confidence: 75, severity: IncidentSeverity.medium },
  ];

  for (const ioc of iocsData) {
    const existingIoc = await prisma.iOC.findUnique({
      where: {
        type_value: {
          type: ioc.type,
          value: ioc.value,
        },
      },
    });

    if (!existingIoc) {
      await prisma.iOC.create({
        data: {
          ...ioc,
          createdById: admin.id,
        },
      });
    }
  }
  console.log(`  ✓ ${iocsData.length} IOCs ready`);

  // 5. Incident de démonstration
  const existingIncident = await prisma.incident.findFirst({
    where: { title: 'SSH Brute Force Attack on web-server-01' },
  });

  if (!existingIncident) {
    await prisma.incident.create({
      data: {
        title: 'SSH Brute Force Attack on web-server-01',
        description: 'Multiple failed SSH login attempts detected from external IP 203.0.113.42.',
        severity: IncidentSeverity.high,
        status: IncidentStatus.contained,
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