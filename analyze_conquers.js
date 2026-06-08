const https = require('https');
const zlib = require('zlib');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SERVER = process.env.GREPOLIS_SERVER || 'hu119';

async function fetchAndDecompress(filename) {
  return new Promise((resolve, reject) => {
    const url = `https://${SERVER}.grepolis.com/data/${filename}`;
    
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        if (res.statusCode === 404) return resolve([]);
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }

      const gunzip = zlib.createGunzip();
      res.pipe(gunzip);

      let data = '';
      gunzip.on('data', (chunk) => {
        data += chunk.toString('utf-8');
      });

      gunzip.on('end', () => {
        const lines = data.split('\n').filter(l => l.trim().length > 0);
        resolve(lines.map(line => decodeURIComponent(line.replace(/\+/g, ' ')).split(',')));
      });

      gunzip.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log("Fetching conquers.txt.gz...");
  const conquers = await fetchAndDecompress('conquers.txt.gz');
  console.log(`conquers.txt.gz has ${conquers.length} records.`);
  
  if (conquers.length > 0) {
    const first = conquers[0];
    const last = conquers[conquers.length - 1];
    console.log("First record:", new Date(parseInt(first[0]) * 1000).toLocaleString(), first);
    console.log("Last record:", new Date(parseInt(last[0]) * 1000).toLocaleString(), last);
  }

  // Check today's recorded conquests in the DB
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dbConquests = await prisma.conquest.findMany({
    where: { timestamp: { gte: today } },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  console.log(`\nFound ${dbConquests.length} conquests recorded in DB today (showing up to 10):`);
  dbConquests.forEach(c => console.log(c.timestamp.toLocaleString(), `Town: ${c.townId}, OldPlayer: ${c.oldPlayerId}, NewPlayer: ${c.newPlayerId}`));

  // Check TownHistory to see if a town changed ownership today
  // Town ownership changes are NOT explicitly in TownHistory, because TownHistory only records points.
  // The Town table has `playerId`. To see if it changed, we would need to check Town table history or Conquests.
  // Since we only record Town points in TownHistory, we solely rely on Conquests for ownership changes.
  
  await prisma.$disconnect();
}

run().catch(console.error);
