const fs = require('fs');
let e = fs.readFileSync('.env', 'utf8');
e = e.replace('DATABASE_URL="postgres://', 'DATABASE_URL="prisma+postgres://');
fs.writeFileSync('.env', e);
