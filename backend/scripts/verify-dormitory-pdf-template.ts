import { mkdir, readFile, readdir, rm } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { PDFDocument } from 'pdf-lib';
import { DEFAULT_PDF_TEMPLATE_LAYOUT, resolveRosterPdfValues } from '../src/dormitory/pdf-template/field-catalog';
import { PdfTemplateRendererService } from '../src/dormitory/pdf-template/pdf-template-renderer.service';

const outputDir = join(__dirname, '..', 'output', 'tmp', 'pdfs');

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
  const renderer = new PdfTemplateRendererService();
  const fixtures = [
    { name: 'short', roster: { full_name: 'Nguyễn An', gender: 'Female', phone_number: '0912345678', identity_state: 'UNLINKED' } },
    { name: 'long', roster: { full_name: 'Nguyễn Thị Bảo đảm văn bản dài không bị mất dữ liệu', gender: 'Female', phone_number: '0912345678', identity_state: 'UNLINKED', applicant_profile: { permanent_address: 'Số 1 đường Trường Chinh, phường Khương Thượng, thành phố Hà Nội' } } },
    { name: 'missing', roster: { identity_state: 'UNLINKED' } },
    { name: 'vietnamese', roster: { full_name: 'Đặng Thị Nguyễn – Ký túc xá', gender: 'Female', phone_number: '0987654321', identity_state: 'UNLINKED', applicant_profile: { ethnicity: 'Kinh', religion: 'Không', priority_certificate_details: 'Gia đình chính sách' } } },
  ];
  for (const fixture of fixtures) {
    const values = resolveRosterPdfValues(fixture.roster, null);
    const result = await renderer.render(source, DEFAULT_PDF_TEMPLATE_LAYOUT, values);
    const pdfPath = join(outputDir, `${fixture.name}.pdf`);
    await import('fs/promises').then(({ writeFile }) => writeFile(pdfPath, result.buffer));
    const doc = await PDFDocument.load(result.buffer);
    if (doc.getPageCount() !== 1) throw new Error(`${fixture.name}: expected one page`);
    const conversion = spawnSync(popplerBinary(), ['-png', '-r', '150', '-singlefile', pdfPath, join(outputDir, fixture.name)], { encoding: 'utf8' });
    if (conversion.status !== 0) throw new Error(`${fixture.name}: Poppler failed: ${conversion.error?.message || conversion.stderr || conversion.stdout || `exit ${conversion.status}`}`);
  }
  const pngs = (await readdir(outputDir)).filter((name) => name.endsWith('.png'));
  if (pngs.length !== fixtures.length) throw new Error(`Expected ${fixtures.length} Poppler PNGs, got ${pngs.length}.`);
  console.log(JSON.stringify({ fixtures: fixtures.map((fixture) => fixture.name), popplerDpi: 150, pngCount: pngs.length, outputDir }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
