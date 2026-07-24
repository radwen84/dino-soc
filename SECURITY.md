# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within Mini-SOC, please send an email to security@minisoc.local.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Within 30 days for critical/high severity

### Disclosure Policy

- We follow responsible disclosure practices
- Credit will be given to reporters (unless anonymity is requested)
- We aim to fix critical vulnerabilities within 7 days

## Security Best Practices

When deploying Mini-SOC:

1. **Never expose management ports** (Wazuh API, OpenSearch, PostgreSQL) to the internet
2. **Always use TLS** for all communications
3. **Rotate secrets** regularly via Vault
4. **Enable MFA** for all SOC analysts
5. **Follow the principle of least privilege** for RBAC roles
6. **Keep all components updated** (subscribe to security advisories)
7. **Monitor audit logs** for unauthorized access attempts
8. **Backup encryption keys** securely and separately from data backups
