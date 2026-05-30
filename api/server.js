'use strict';
// Local development entry point — not used by Vercel
const app  = require('./_app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saltire API running on http://localhost:${PORT}`));
