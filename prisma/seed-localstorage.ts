import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();
const LOCAL_STORAGE_DIR = path.join(__dirname, '../localstorage');

async function main() {
  console.log('Starting seed...');

  // 1. Seed Buildings
  const buildingsDataRaw = fs.readFileSync(path.join(LOCAL_STORAGE_DIR, 'PSGrepo2__01Data__globalPSbuildings.txt'), 'utf-8');
  const buildingsData = JSON.parse(buildingsDataRaw);

  const dependenciesToInsert: { buildingId: string; requiredBuildingId: string; requiredLevel: number }[] = [];

  for (const [key, bData] of Object.entries(buildingsData)) {
    const data = bData as any;
    
    // Save dependencies for later
    if (data.dependencies) {
      if (Array.isArray(data.dependencies)) {
        // sometimes it's an empty array
      } else {
        for (const [depId, depLevel] of Object.entries(data.dependencies)) {
          dependenciesToInsert.push({
            buildingId: data.id,
            requiredBuildingId: depId,
            requiredLevel: depLevel as number,
          });
        }
      }
    }

    await prisma.building.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        description: data.description || '',
        max_level: data.max_level,
        min_level: data.min_level,
        base_wood: data.resources?.wood || 0,
        base_stone: data.resources?.stone || 0,
        base_iron: data.resources?.iron || 0,
        base_pop: data.pop || 0,
        base_build_time: data.build_time || 0,
        base_points: data.points || 0,
        wood_factor: data.wood_factor || 0,
        stone_factor: data.stone_factor || 0,
        iron_factor: data.iron_factor || 0,
        pop_factor: data.pop_factor || 0,
        build_time_factor: data.build_time_factor || 0,
        points_factor: data.points_factor || 0,
      },
      create: {
        id: data.id,
        name: data.name,
        description: data.description || '',
        max_level: data.max_level,
        min_level: data.min_level,
        base_wood: data.resources?.wood || 0,
        base_stone: data.resources?.stone || 0,
        base_iron: data.resources?.iron || 0,
        base_pop: data.pop || 0,
        base_build_time: data.build_time || 0,
        base_points: data.points || 0,
        wood_factor: data.wood_factor || 0,
        stone_factor: data.stone_factor || 0,
        iron_factor: data.iron_factor || 0,
        pop_factor: data.pop_factor || 0,
        build_time_factor: data.build_time_factor || 0,
        points_factor: data.points_factor || 0,
      },
    });
  }

  // Insert dependencies
  for (const dep of dependenciesToInsert) {
    await prisma.buildingDependency.upsert({
      where: {
        buildingId_requiredBuildingId: {
          buildingId: dep.buildingId,
          requiredBuildingId: dep.requiredBuildingId,
        },
      },
      update: {
        requiredLevel: dep.requiredLevel,
      },
      create: dep,
    });
  }
  console.log('Seeded Buildings');

  // 2. Seed Units
  const unitsDataRaw = fs.readFileSync(path.join(LOCAL_STORAGE_DIR, 'PSGrepo2__01Data__globalPSunits.txt'), 'utf-8');
  const unitsDataObj = JSON.parse(unitsDataRaw);
  const unitsData = unitsDataObj.data;

  for (const [key, data] of Object.entries(unitsData)) {
    const uData = data as any;
    await prisma.unit.upsert({
      where: { id: uData.id },
      update: {
        name: uData.name,
        name_plural: uData.name_plural || uData.name,
        speed: uData.speed || 0,
        attack: uData.attack || 0,
        description: uData.description || '',
        resources_wood: uData.resources?.wood || 0,
        resources_stone: uData.resources?.stone || 0,
        resources_iron: uData.resources?.iron || 0,
        favor: uData.favor || 0,
        population: uData.population || 0,
        build_time: uData.build_time || 0,
        god_id: uData.god_id || null,
        is_naval: uData.is_naval || false,
        unit_function: uData.unit_function || '',
        category: uData.category || '',
        is_npc_unit_only: uData.is_npc_unit_only || false,
        def_hack: uData.def_hack || 0,
        def_pierce: uData.def_pierce || 0,
        def_distance: uData.def_distance || 0,
        booty: uData.booty || 0,
        infantry: uData.infantry || false,
        flying: uData.flying || false,
        attack_type: uData.attack_type || null,
        capacity: uData.capacity || null,
      },
      create: {
        id: uData.id,
        name: uData.name,
        name_plural: uData.name_plural || uData.name,
        speed: uData.speed || 0,
        attack: uData.attack || 0,
        description: uData.description || '',
        resources_wood: uData.resources?.wood || 0,
        resources_stone: uData.resources?.stone || 0,
        resources_iron: uData.resources?.iron || 0,
        favor: uData.favor || 0,
        population: uData.population || 0,
        build_time: uData.build_time || 0,
        god_id: uData.god_id || null,
        is_naval: uData.is_naval || false,
        unit_function: uData.unit_function || '',
        category: uData.category || '',
        is_npc_unit_only: uData.is_npc_unit_only || false,
        def_hack: uData.def_hack || 0,
        def_pierce: uData.def_pierce || 0,
        def_distance: uData.def_distance || 0,
        booty: uData.booty || 0,
        infantry: uData.infantry || false,
        flying: uData.flying || false,
        attack_type: uData.attack_type || null,
        capacity: uData.capacity || null,
      },
    });
  }
  console.log('Seeded Units');

  // 3. Seed Heroes
  const heroesDataRaw = fs.readFileSync(path.join(LOCAL_STORAGE_DIR, 'PSGrepo2__01Data__globalPSheroes.txt'), 'utf-8');
  const heroesDataObj = JSON.parse(heroesDataRaw);
  const heroesData = heroesDataObj.data;

  for (const [key, data] of Object.entries(heroesData)) {
    const hData = data as any;
    await prisma.hero.upsert({
      where: { id: hData.id },
      update: {
        name: hData.name,
        category: hData.category,
        cost: hData.cost || 0,
        attack: hData.attack || 0,
        def_hack: hData.def_hack || 0,
        def_pierce: hData.def_pierce || 0,
        def_distance: hData.def_distance || 0,
        speed: hData.speed || 0,
        booty: hData.booty || 0,
        attack_type: hData.attack_type || '',
        modifiers: hData.description_args || {},
      },
      create: {
        id: hData.id,
        name: hData.name,
        category: hData.category,
        cost: hData.cost || 0,
        attack: hData.attack || 0,
        def_hack: hData.def_hack || 0,
        def_pierce: hData.def_pierce || 0,
        def_distance: hData.def_distance || 0,
        speed: hData.speed || 0,
        booty: hData.booty || 0,
        attack_type: hData.attack_type || '',
        modifiers: hData.description_args || {},
      },
    });
  }
  console.log('Seeded Heroes');

  // 4. Seed GodPowers
  const powersDataRaw = fs.readFileSync(path.join(LOCAL_STORAGE_DIR, 'PSGrepo2__01Data__globalPSpowers.txt'), 'utf-8');
  const powersDataObj = JSON.parse(powersDataRaw);
  const powersData = powersDataObj.data;

  for (const [key, data] of Object.entries(powersData)) {
    const pData = data as any;
    const pName = typeof pData.name === 'string' ? pData.name : JSON.stringify(pData.name);
    await prisma.godPower.upsert({
      where: { id: pData.id },
      update: {
        name: pName,
        god_id: pData.god_id || null,
        favor: pData.favor || 0,
        lifetime: pData.lifetime || 0,
        targets: pData.targets || [],
        meta_defaults: pData.meta_defaults || {},
      },
      create: {
        id: pData.id,
        name: pName,
        god_id: pData.god_id || null,
        favor: pData.favor || 0,
        lifetime: pData.lifetime || 0,
        targets: pData.targets || [],
        meta_defaults: pData.meta_defaults || {},
      },
    });
  }
  console.log('Seeded GodPowers');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
