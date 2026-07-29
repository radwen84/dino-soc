export enum SOCRole {
  ADMIN = 'admin',
  ANALYST_L1 = 'analyst_l1',
  ANALYST_L2 = 'analyst_l2',
  ANALYST_L3 = 'analyst_l3',
  THREAT_HUNTER = 'threat_hunter',
  INCIDENT_RESPONDER = 'incident_responder',
  READONLY = 'readonly',
}

export const ROLE_HIERARCHY: Record<SOCRole, number> = {
  [SOCRole.ADMIN]: 100,
  [SOCRole.ANALYST_L3]: 80,
  [SOCRole.THREAT_HUNTER]: 75,
  [SOCRole.INCIDENT_RESPONDER]: 70,
  [SOCRole.ANALYST_L2]: 60,
  [SOCRole.ANALYST_L1]: 40,
  [SOCRole.READONLY]: 10,
};

export const PERMISSIONS: Record<string, SOCRole[]> = {
  // Incidents
  'incidents.create': [SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'incidents.read': [
    SOCRole.ANALYST_L1,
    SOCRole.ANALYST_L2,
    SOCRole.ANALYST_L3,
    SOCRole.ADMIN,
    SOCRole.READONLY,
    SOCRole.THREAT_HUNTER,
    SOCRole.INCIDENT_RESPONDER,
  ],
  'incidents.update': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'incidents.escalate': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'incidents.close': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'incidents.delete': [SOCRole.ADMIN],

  // Active Response
  'response.contain': [SOCRole.INCIDENT_RESPONDER, SOCRole.ADMIN],
  'response.isolate': [SOCRole.INCIDENT_RESPONDER, SOCRole.ADMIN],
  'response.block_ip': [SOCRole.ANALYST_L2, SOCRole.INCIDENT_RESPONDER, SOCRole.ADMIN],

  // IOC
  'ioc.create': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.THREAT_HUNTER, SOCRole.ADMIN],
  'ioc.import': [SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'ioc.delete': [SOCRole.ADMIN],

  // Assets
  'assets.create': [SOCRole.ANALYST_L2, SOCRole.ADMIN],
  'assets.update': [SOCRole.ANALYST_L2, SOCRole.ADMIN],
  'assets.delete': [SOCRole.ADMIN],

  // Configuration
  'config.rules': [SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'config.users': [SOCRole.ADMIN],
  'config.integrations': [SOCRole.ADMIN],
  'config.playbooks': [SOCRole.ANALYST_L3, SOCRole.ADMIN],

  // Reports
  'reports.generate': [SOCRole.ANALYST_L1, SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],
  'reports.export': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.ADMIN],

  // Threat Hunting
  'hunting.search': [SOCRole.ANALYST_L2, SOCRole.ANALYST_L3, SOCRole.THREAT_HUNTER, SOCRole.ADMIN],
  'hunting.create_rule': [SOCRole.ANALYST_L3, SOCRole.THREAT_HUNTER, SOCRole.ADMIN],
};
