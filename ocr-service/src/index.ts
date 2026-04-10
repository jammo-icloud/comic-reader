import express from 'express';
import routes from './routes.js';
import { resumeIncomplete } from './queue.js';

const PORT = parseInt(process.env.SERVER_PORT || '3001', 10);

const app = express();
app.use(express.json());
app.use('/', routes);

app.listen(PORT, () => {
  console.log(`OCR Service running on http://localhost:${PORT}`);
  resumeIncomplete();
});
