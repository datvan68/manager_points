import { readFile } from 'fs/promises';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { PdfTemplateIntakeService } from './pdf-template-intake.service';

describe('PDF template intake', () => {
  it('accepts the bundled static one-page A4 source', async () => {
    const buffer = await readFile(join(__dirname, '..', 'templates', 'dormitory-roster-application.pdf'));
    const result = await new PdfTemplateIntakeService().validate(buffer, 'source.pdf', 'application/pdf');
    expect(result.checksum).toHaveLength(64);
    expect(result.pageWidth).toBeCloseTo(595.32, 1);
    expect(result.pageHeight).toBeCloseTo(842.04, 1);
  });

  it('rejects MIME spoofing and active content before persistence', async () => {
    const service = new PdfTemplateIntakeService();
    await expect(service.validate(Buffer.from('%PDF-1.7\n/JavaScript'), 'fake.pdf', 'text/plain')).rejects.toThrow(BadRequestException);
    await expect(service.validate(Buffer.from('%PDF-1.7\n/JavaScript'), 'fake.pdf', 'application/pdf')).rejects.toThrow(BadRequestException);
  });
});

