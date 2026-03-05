const { dbClient } = require('./db/connection');
const { isSupabaseStorageEnabled } = require('./services/storage');
const { buildApp, ensureInitialized } = require('./app');

const app = buildApp();
app.set('trust proxy', 1); // important derrière Vercel/proxy

const PORT = process.env.PORT || 4000;

ensureInitialized()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(
        `TERRASOCIAL backend running on http://localhost:${PORT} (db=${dbClient}, storage=${isSupabaseStorageEnabled() ? 'supabase' : 'local'})`
      );
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
