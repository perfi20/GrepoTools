const { prisma } = require('@prisma/client');
const { generateGeoJSON } = require('./src/lib/geojson');
const { generateScoreboardData } = require('./src/lib/scoreboard');

async function test() {
  console.time('GeoJSON');
  await generateGeoJSON();
  console.timeEnd('GeoJSON');

  console.time('Scoreboard');
  await generateScoreboardData();
  console.timeEnd('Scoreboard');
}

test().catch(console.error);
