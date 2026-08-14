##! Mini-SOC Zeek Configuration
##! Network Security Monitoring

# Load standard scripts
@load base/frameworks/logging
@load base/frameworks/notice
@load base/frameworks/intel
@load base/protocols/conn
@load base/protocols/dns
@load base/protocols/http
@load base/protocols/ssl
@load base/protocols/ssh
@load base/protocols/smtp
@load base/protocols/ftp

# Load detection scripts
@load policy/frameworks/intel/seen
@load policy/frameworks/intel/do_notice
@load policy/protocols/conn/known-hosts
@load policy/protocols/conn/known-services
@load policy/protocols/dns/detect-external-names
@load policy/protocols/http/detect-sqli
@load policy/protocols/ssh/detect-bruteforcing
@load policy/protocols/ssl/validate-certs
@load policy/protocols/ssl/log-hostcerts-only
#@load policy/misc/detect-traceroute
#@load policy/misc/scan

# JSON output for Wazuh/OpenSearch integration
@load policy/tuning/json-logs

redef LogAscii::use_json = T;
redef LogAscii::json_timestamps = JSON::TS_ISO8601;

# Network configuration
redef Site::local_nets += { 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 };

# SSH brute force detection
redef SSH::password_guesses_limit = 5;

# Notice policy
#redef Notice::policy += {
#  [$action = Notice::ACTION_LOG,
#   $pred(n: Notice::Info) = { return n$note == SSH::Password_Guessing; }],
#  [$action = Notice::ACTION_LOG,
#   $pred(n: Notice::Info) = { return n$note == Scan::Port_Scan; }],
#};

# Load custom scripts
@load ./scripts/detect-dns-tunneling.zeek
@load ./scripts/detect-large-transfers.zeek
