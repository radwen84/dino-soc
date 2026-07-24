import express from 'express';
import { PluginLoader } from './plugin-loader';
import { logger } from './logger';

const app = express();
app.use(express.json());

const pluginLoader = new PluginLoader();

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', plugins: pluginLoader.getLoadedPlugins() });
});

app.get('/plugins', (_req, res) => {
  res.json(pluginLoader.getLoadedPlugins());
});

app.post('/plugins/:name/execute', async (req, res) => {
  const { name } = req.params;
  try {
    const result = await pluginLoader.execute(name, req.body);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

async function start() {
  await pluginLoader.loadPlugins('./plugins');
  const port = process.env.PORT || 8001;
  app.listen(port, () => {
    logger.info(`Plugin Engine running on port ${port}`);
    logger.info(`Loaded plugins: ${pluginLoader.getLoadedPlugins().map(p => p.name).join(', ')}`);
  });
}

start();
