import { PluginLoader } from '../src/plugin-loader';
import path from 'path';

describe('PluginLoader', () => {
  it('loads plugins from the plugins directory', async () => {
    const loader = new PluginLoader();
    const pluginsDir = path.resolve(__dirname, '../plugins');

    await loader.loadPlugins(pluginsDir);

    const loaded = loader.getLoadedPlugins();
    expect(Array.isArray(loaded)).toBe(true);
    expect(loaded.some((plugin) => plugin.name === 'virustotal')).toBe(true);
  });
});
