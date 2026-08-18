import { mkdir, readFile, readdir, rm } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { DORMITORY_ROSTER_APPLICATION_DESCRIPTOR, createDefaultDormitoryLayout } from '../src/dormitory/pdf-template-adapter';
import { PdfTemplateRendererService } from '../src/pdf-template/pdf-template-renderer.service';
import { PdfTemplateIntakeService } from '../src/pdf-template/pdf-template-intake.service';
import { TEST_MULTI_PAGE_DESCRIPTOR } from '../src/pdf-template/test-fixtures/second-descriptor';

const outputDir = join(__dirname, '..', 'tmp', 'pdfs');

function popplerBinary(): string {
  if (process.env.PDFTOPPM_BIN) return process.env.PDFTOPPM_BIN;
  if (process.platform !== 'win32') return 'pdftoppm';
  const lookup = spawnSync('where.exe', ['pdftoppm'], { encoding: 'utf8' });
  const wrapper = lookup.stdout.split(/\r?\n/).find(Boolean);
  if (wrapper?.toLowerCase().endsWith('.cmd')) return resolve(dirname(wrapper), '..', '..', 'native', 'poppler', 'Library', 'bin', 'pdftoppm.exe');
  return wrapper || 'pdftoppm.exe';
}

async function main() {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const source = await readFile(join(__dirname, '..', 'src', 'dormitory', 'templates', 'dormitory-roster-application.pdf'));
  const intake = new PdfTemplateIntakeService();
  const parsed = await intake.validate(source, 'dormitory-roster-application.pdf', 'application/pdf');
  const layout = createDefaultDormitoryLayout(parsed.pages);
  const renderer = new PdfTemplateRendererService();
  const fixtures = [
    { name: 'short' }, { name: 'long' }, { name: 'missing' }, { name: 'vietnamese' },
  ];
  for (const fixture of fixtures) {
    const values = DORMITORY_ROSTER_APPLICATION_DESCRIPTOR.syntheticFixture(fixture.name as any).values;
    const result = await renderer.render(source, layout, values);
    const pdfPath = join(outputDir, `${fixture.name}.pdf`);
    await import('fs/promises').then(({ writeFile }) => writeFile(pdfPath, result.buffer));
    const doc = await PDFDocument.load(result.buffer);
    if (doc.getPageCount() !== 1) throw new Error(`${fixture.name}: expected one page`);
    const conversion = spawnSync(popplerBinary(), ['-png', '-r', '150', '-singlefile', pdfPath, join(outputDir, fixture.name)], { encoding: 'utf8' });
    if (conversion.status !== 0) throw new Error(`${fixture.name}: Poppler failed: ${conversion.error?.message || conversion.stderr || conversion.stdout || `exit ${conversion.status}`}`);
  }
  const multipage = await PDFDocument.create(); multipage.addPage([595.32, 842.04]); multipage.addPage([595.32, 842.04]);
  const multipageSource = Buffer.from(await multipage.save()); const multipageParsed = await intake.validate(multipageSource, 'test-multipage.pdf', 'application/pdf');
  const multipageLayout = { pages: multipageParsed.pages, items: [{ id: 'test-title', fieldKey: 'report.title', formatter: 'plain' as const, pageIndex: 1, x: 0.1, y: 0.1, width: 0.8, height: 0.05, rotation: 0, zIndex: 0, style: TEST_MULTI_PAGE_DESCRIPTOR.fields[0].defaultStyle }] };
  const multipageResult = await renderer.render(multipageSource, multipageLayout, TEST_MULTI_PAGE_DESCRIPTOR.syntheticFixture('short').values);
  const multipagePath = join(outputDir, 'test-multipage.pdf'); await import('fs/promises').then(({ writeFile }) => writeFile(multipagePath, multipageResult.buffer));
  const multipageConversion = spawnSync(popplerBinary(), ['-png', '-r', '150', multipagePath, join(outputDir, 'test-multipage')], { encoding: 'utf8' });
  if (multipageConversion.status !== 0) throw new Error(`test-multipage: Poppler failed.`);
  const pngs = (await readdir(outputDir)).filter((name) => name.endsWith('.png'));
  if (pngs.length !== fixtures.length + 2) throw new Error(`Expected ${fixtures.length + 2} Poppler PNGs, got ${pngs.length}.`);
  console.log(JSON.stringify({ descriptors: ['DORMITORY_ROSTER_APPLICATION', TEST_MULTI_PAGE_DESCRIPTOR.templateTypeCode], fixtures: fixtures.map((fixture) => fixture.name), multipagePages: 2, popplerDpi: 150, pngCount: pngs.length, outputDir }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
