import axios from 'axios';
import { Plugin } from '../../src/plugin-loader';

const plugin: Plugin = {
  name: 'virustotal',
  version: '1.0.0',
  description: 'Enriches IOCs using VirusTotal API',
  type: 'enrichment',

  async execute(input: { value: string; type: string }) {
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) throw new Error('VIRUSTOTAL_API_KEY not configured');

    const endpoints: Record<string, string> = {
      ip: `https://www.virustotal.com/api/v3/ip_addresses/${input.value}`,
      domain: `https://www.virustotal.com/api/v3/domains/${input.value}`,
      hash_sha256: `https://www.virustotal.com/api/v3/files/${input.value}`,
      hash_md5: `https://www.virustotal.com/api/v3/files/${input.value}`,
      url: `https://www.virustotal.com/api/v3/urls/${Buffer.from(input.value).toString('base64url')}`,
    };

    const url = endpoints[input.type];
    if (!url) throw new Error(`Unsupported IOC type: ${input.type}`);

    const response = await axios.get(url, {
      headers: { 'x-apikey': apiKey },
    });

    const stats = response.data.data?.attributes?.last_analysis_stats;
    return {
      malicious: stats?.malicious || 0,
      suspicious: stats?.suspicious || 0,
      harmless: stats?.harmless || 0,
      undetected: stats?.undetected || 0,
      reputation: response.data.data?.attributes?.reputation || 0,
    };
  },
};

export default plugin;