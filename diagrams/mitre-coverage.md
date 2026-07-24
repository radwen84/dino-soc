# MITRE ATT&CK Coverage Matrix

## Detection Coverage by Tool

| Technique | ID | Wazuh | Suricata | Zeek | Falco | YARA | Sigma |
|-----------|-----|:-----:|:--------:|:----:|:-----:|:----:|:-----:|
| **Initial Access** |
| Exploit Public App | T1190 | ✓ | ✓ | | | | ✓ |
| **Execution** |
| Command/Script | T1059 | ✓ | | | ✓ | ✓ | ✓ |
| **Persistence** |
| Account Creation | T1136 | ✓ | | | | | ✓ |
| **Privilege Escalation** |
| Sudo/Su Abuse | T1548 | ✓ | | | ✓ | | ✓ |
| Container Escape | T1611 | | | | ✓ | | |
| **Defense Evasion** |
| File Modification | T1565 | ✓ | | | | ✓ | |
| **Credential Access** |
| Brute Force | T1110 | ✓ | ✓ | ✓ | | | ✓ |
| Credential Dumping | T1003 | | | | | ✓ | |
| **Discovery** |
| Port Scan | T1046 | | ✓ | ✓ | | | |
| **Lateral Movement** |
| SSH | T1021.004 | ✓ | | ✓ | | | ✓ |
| **Collection** |
| Data from Local | T1005 | ✓ | | | ✓ | | |
| **Command & Control** |
| DNS Tunneling | T1071.004 | ✓ | ✓ | ✓ | | | ✓ |
| Web Protocols | T1071.001 | | ✓ | ✓ | | ✓ | |
| **Exfiltration** |
| Exfil Over C2 | T1048 | ✓ | ✓ | ✓ | | | ✓ |
| **Impact** |
| Data Encryption | T1486 | ✓ | | | | ✓ | |
| Resource Hijacking | T1496 | ✓ | ✓ | | ✓ | ✓ | |

## Coverage Summary

- **Total techniques monitored**: 17
- **Multi-tool detection**: 12/17 (70%)
- **Average tools per technique**: 2.8
- **Highest coverage**: Credential Access, C2, Exfiltration

