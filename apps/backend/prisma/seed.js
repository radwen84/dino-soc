"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = require("bcrypt");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adminPassword, admin, l1Password, analyst1, l2Password, analyst2, assets, _i, assets_1, asset, iocs, _a, iocs_1, ioc;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🌱 Seeding database...');
                    return [4 /*yield*/, bcrypt.hash('Admin@MiniSOC2026!', 12)];
                case 1:
                    adminPassword = _b.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@minisoc.local' },
                            update: {},
                            create: {
                                email: 'admin@minisoc.local',
                                name: 'SOC Administrator',
                                passwordHash: adminPassword,
                                roles: ['admin'],
                                isActive: true,
                            },
                        })];
                case 2:
                    admin = _b.sent();
                    console.log("  \u2713 Admin user created: ".concat(admin.email));
                    return [4 /*yield*/, bcrypt.hash('Analyst1@SOC2026!', 12)];
                case 3:
                    l1Password = _b.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'analyst.l1@minisoc.local' },
                            update: {},
                            create: {
                                email: 'analyst.l1@minisoc.local',
                                name: 'Analyst Level 1',
                                passwordHash: l1Password,
                                roles: ['analyst_l1'],
                                isActive: true,
                            },
                        })];
                case 4:
                    analyst1 = _b.sent();
                    console.log("  \u2713 Analyst L1 created: ".concat(analyst1.email));
                    return [4 /*yield*/, bcrypt.hash('Analyst2@SOC2026!', 12)];
                case 5:
                    l2Password = _b.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'analyst.l2@minisoc.local' },
                            update: {},
                            create: {
                                email: 'analyst.l2@minisoc.local',
                                name: 'Analyst Level 2',
                                passwordHash: l2Password,
                                roles: ['analyst_l2'],
                                isActive: true,
                            },
                        })];
                case 6:
                    analyst2 = _b.sent();
                    console.log("  \u2713 Analyst L2 created: ".concat(analyst2.email));
                    assets = [
                        { hostname: 'web-server-01', ipAddress: '10.0.2.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'high', department: 'Production' },
                        { hostname: 'db-server-01', ipAddress: '10.0.2.11', os: 'Ubuntu', osVersion: '22.04', criticality: 'critical', department: 'Production' },
                        { hostname: 'app-server-01', ipAddress: '10.0.2.12', os: 'Ubuntu', osVersion: '22.04', criticality: 'high', department: 'Production' },
                        { hostname: 'dev-workstation-01', ipAddress: '10.0.3.10', os: 'Windows', osVersion: '11', criticality: 'medium', department: 'Development' },
                        { hostname: 'soc-analyst-01', ipAddress: '10.0.4.10', os: 'Ubuntu', osVersion: '22.04', criticality: 'medium', department: 'Security' },
                    ];
                    _i = 0, assets_1 = assets;
                    _b.label = 7;
                case 7:
                    if (!(_i < assets_1.length)) return [3 /*break*/, 10];
                    asset = assets_1[_i];
                    return [4 /*yield*/, prisma.asset.upsert({
                            where: { id: undefined },
                            update: {},
                            create: asset,
                        })];
                case 8:
                    _b.sent();
                    _b.label = 9;
                case 9:
                    _i++;
                    return [3 /*break*/, 7];
                case 10:
                    console.log("  \u2713 ".concat(assets.length, " assets created"));
                    iocs = [
                        { type: 'ip', value: '203.0.113.42', description: 'Known C2 server', source: 'misp', confidence: 90, severity: 'high' },
                        { type: 'domain', value: 'malware-c2.evil.tk', description: 'Malware distribution domain', source: 'virustotal', confidence: 95, severity: 'critical' },
                        { type: 'hash_sha256', value: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', description: 'Ransomware sample', source: 'manual', confidence: 100, severity: 'critical' },
                        { type: 'ip', value: '198.51.100.23', description: 'Port scanner', source: 'abuseipdb', confidence: 75, severity: 'medium' },
                    ];
                    _a = 0, iocs_1 = iocs;
                    _b.label = 11;
                case 11:
                    if (!(_a < iocs_1.length)) return [3 /*break*/, 14];
                    ioc = iocs_1[_a];
                    return [4 /*yield*/, prisma.iOC.create({ data: __assign(__assign({}, ioc), { createdById: admin.id, mitreTechniques: [], relatedIncidents: [] }) })];
                case 12:
                    _b.sent();
                    _b.label = 13;
                case 13:
                    _a++;
                    return [3 /*break*/, 11];
                case 14:
                    console.log("  \u2713 ".concat(iocs.length, " IOCs created"));
                    // Create sample incident
                    return [4 /*yield*/, prisma.incident.create({
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
                        })];
                case 15:
                    // Create sample incident
                    _b.sent();
                    console.log('  ✓ Sample incident created');
                    console.log('\n✅ Seeding completed!');
                    console.log('\nDefault credentials:');
                    console.log('  Admin: admin@minisoc.local / Admin@MiniSOC2026!');
                    console.log('  L1:    analyst.l1@minisoc.local / Analyst1@SOC2026!');
                    console.log('  L2:    analyst.l2@minisoc.local / Analyst2@SOC2026!');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
