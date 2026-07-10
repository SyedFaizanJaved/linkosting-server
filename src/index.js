import 'dotenv/config';
import { buildApp } from './app.js';

const port = process.env.PORT || 3000;
buildApp().listen(port, () => console.log(`API listening on :${port}`));
