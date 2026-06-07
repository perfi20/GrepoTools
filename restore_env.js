const fs = require('fs');
let e = fs.readFileSync('.env', 'utf8');
e = e.replace('DATABASE_URL="prisma+postgres://', 'DATABASE_URL="postgres://');
fs.writeFileSync('.env', e);
