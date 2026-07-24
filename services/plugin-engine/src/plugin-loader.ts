import { glob } from 'glob';
import path from 'path';
import { logger } from './logger';

export interface Plugin {
  name: string;
  version: string;
  description: string;
  type: 'enrichment' | 'response' | 'notification' | 'analysis';
  execute: (input: any) => Promise<any>;
}

export class PluginLoader {
  private plugins: Map<string, Plugin> = new Map();

  async loadPlugins(directory: string) {
    const pluginFiles = await glob(`${directory}/*/index.{ts,js}`);

    for (const file of pluginFiles) {
      try {
        const pluginModule = await import(path.resolve(file));
        const plugin: Plugin = pluginModule.default || pluginModule;

        if (plugin.name && plugin.execute) {
          this.plugins.set(plugin.name, plugin);
          logger.info(`Loaded plugin: ${plugin.name} v${plugin.version}`);
        }
      } catch (error: any) {
        logger.error(`Failed to load plugin from ${file}: ${error.message}`);
      }
    }
  }

  async execute(name: string, input: any): Promise<any> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }
    return plugin.execute(input);
  }

  getLoadedPlugins() {
    return Array.from(this.plugins.values()).map(p => ({
      name: p.name,
      version: p.version,
      description: p.description,
      type: p.type,
    }));
  }
}
