import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function createTestPdf(filename: string, pages: number) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([600, 900]);
    page.drawRectangle({
      x: 0, y: 0, width: 600, height: 900,
      color: rgb(
        0.1 + (i * 0.05) % 0.3,
        0.1 + (i * 0.03) % 0.3,
        0.2 + (i * 0.07) % 0.3,
      ),
    });
    page.drawText(`Page ${i}`, {
      x: 200, y: 450, size: 48, font, color: rgb(1, 1, 1),
    });
    page.drawText(filename, {
      x: 100, y: 350, size: 24, font, color: rgb(0.8, 0.8, 0.8),
    });
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

async function main() {
  const comicsDir = path.join(process.cwd(), 'comics');

  const series = [
    { name: 'TestSeries', issues: 3 },
    { name: 'AnotherComic', issues: 2 },
  ];

  for (const s of series) {
    const dir = path.join(comicsDir, s.name);
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= s.issues; i++) {
      const filename = `${s.name} ${String(i).padStart(3, '0')}`;
      const pdf = await createTestPdf(filename, 10 + i * 2);
      fs.writeFileSync(path.join(dir, `${filename}.pdf`), pdf);
      console.log(`Created ${filename}.pdf`);
    }
  }
}

main();
