const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
prisma.syncMetadata.findUnique({where: {id:1}}).then(m => { 
  console.log(m ? (m.geoJsonCache ? m.geoJsonCache.length : 'null') : 'no meta'); 
  prisma.$disconnect(); 
}).catch(e => { 
  console.log(e); 
  prisma.$disconnect(); 
});
