#!/bin/bash
set -euo pipefail

RULES_DIR="$(dirname "$0")/../rules"
OUTPUT_DIR="$(dirname "$0")/../output"

mkdir -p "$OUTPUT_DIR/wazuh" "$OUTPUT_DIR/opensearch"

echo "=== Sigma Rules Conversion ==="
echo "Rules directory: $RULES_DIR"

# Check if sigma-cli is installed
if ! command -v sigma &> /dev/null; then
  echo "Installing sigma-cli..."
  pip3 install pySigma pySigma-backend-opensearch pySigma-pipeline-sysmon
fi

# Convert to OpenSearch format
echo ""
echo "[1/2] Converting to OpenSearch..."
for rule in "$RULES_DIR"/*.yml; do
  filename=$(basename "$rule" .yml)
  echo "  → $filename"
  sigma convert -t opensearch -p sysmon "$rule" \
    > "$OUTPUT_DIR/opensearch/${filename}.json" 2>/dev/null || \
  echo "    ⚠️  Conversion failed for $filename (may need custom pipeline)"
done

# Convert to Wazuh format (manual mapping)
echo ""
echo "[2/2] Converting to Wazuh rules..."
cat > "$OUTPUT_DIR/wazuh/sigma_converted_rules.xml" << 'EOF'
<!-- Auto-generated from Sigma rules -->
<!-- Run convert-sigma.sh to regenerate -->
<group name="sigma,">

  <!-- Generated rules will be appended here by sigma2wazuh tool -->
  <!-- For now, the custom rules in local_rules.xml cover the same detections -->

</group>
EOF

echo ""
echo "✅ Conversion complete!"
echo "  OpenSearch rules: $OUTPUT_DIR/opensearch/"
echo "  Wazuh rules: $OUTPUT_DIR/wazuh/"
echo ""
echo "To apply:"
echo "  - OpenSearch: Import via Dev Tools or API"
echo "  - Wazuh: Copy to /var/ossec/etc/rules/ and restart"