import express from 'express';
import routes from './routes.js';

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

const app = express();
app.use(express.json());
app.use('/', routes);

app.listen(PORT, () => {
  console.log(`Import Orchestrator running on http://localhost:${PORT}`);
});
