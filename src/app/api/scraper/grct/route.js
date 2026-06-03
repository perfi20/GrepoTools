import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url || !url.includes('grcrt.net/repview.php?rep=')) {
      return NextResponse.json({ error: 'Invalid GRCT report URL' }, { status: 400 });
    }

    const reportId = new URL(url).searchParams.get('rep');

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch report: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Basic extraction - GRCT's structure uses .quote_message
    const messageHtml = $('.quote_message').html();
    const messageText = $('.quote_message').text();

    if (!messageText) {
      return NextResponse.json({ error: 'Could not parse report content' }, { status: 400 });
    }

    // Try to extract date
    const dateMatch = messageText.match(/\((.*?)\)/);
    let date = new Date();
    if (dateMatch) {
        // e.g. "2026/06/03 11:46:13"
        const parsedDate = new Date(dateMatch[1]);
        if (!isNaN(parsedDate)) date = parsedDate;
    }

    // Attempt to extract attacker and defender from the title text
    // Format usually: "Attacker attacks Defender" in various languages
    // We'll extract raw text and let the user correct it if needed
    
    // Extract resources by looking at text nodes near img tags
    let wood = 0, stone = 0, iron = 0;
    
    const extractResource = (imgSrc) => {
      let val = 0;
      $(`img[src="${imgSrc}"]`).each((i, el) => {
        // usually it's "150 <img...>" so we check previous sibling text
        const prevText = el.previousSibling ? el.previousSibling.nodeValue : '';
        if (prevText) {
          const num = parseInt(prevText.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > val) val = num;
        }
      });
      return val;
    };

    wood = extractResource('https://cdn.grcrt.net/ui/wood.png');
    stone = extractResource('https://cdn.grcrt.net/ui/stone.png');
    iron = extractResource('https://cdn.grcrt.net/ui/iron.png');

    // For demonstration, we'll save it to DB
    const report = await prisma.report.create({
      data: {
        originalId: reportId,
        attacker: "Unknown Attacker (Parsed)",
        defender: "Unknown Defender (Parsed)",
        date,
        lootedWood: wood,
        lootedStone: stone,
        lootedIron: iron,
        morale: 100, // Hardcoded fallback
        luck: 0,
      }
    });

    return NextResponse.json({ success: true, report, rawText: messageText.substring(0, 500) });

  } catch (error) {
    console.error('Scraper Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const reports = await prisma.report.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ reports });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
