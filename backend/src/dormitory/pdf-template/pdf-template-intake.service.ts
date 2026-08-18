import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { PDF_MAX_FILE_BYTES, PDF_PAGE_HEIGHT_PT, PDF_PAGE_WIDTH_PT } from './field-catalog';

const ACTIVE_CONTENT_MARKERS = [
  '/JavaScript', '/JS', '/OpenAction', '/AA', '/EmbeddedFile', '/AcroForm', '/XFA',
  '/Sig', '/Encrypt', '/GoToR', '/Launch', '/SubmitForm', '/ImportData', '/RichMedia', '/FileAttachment',
];

export type ValidatedPdfSource = {
  buffer: Buffer;
  filename: string;
  mimeType: 'application/pdf';
  pageWidth: number;
  pageHeight: number;
  checksum: string;
};

@Injectable()
export class PdfTemplateIntakeService {
  async validate(buffer: Buffer, filename = 'template.pdf', mimeType = 'application/pdf'): Promise<ValidatedPdfSource> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new BadRequestException('Tệp PDF rỗng.');
    if (buffer.length > PDF_MAX_FILE_BYTES) throw new BadRequestException('Tệp PDF vượt quá giới hạn 10 MiB.');
    if (mimeType !== 'application/pdf') throw new BadRequestException('MIME type phải là application/pdf.');
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new BadRequestException('Nội dung tệp không phải PDF.');
    const raw = buffer.toString('latin1');
    const marker = ACTIVE_CONTENT_MARKERS.find((value) => raw.includes(value));
    if (marker) throw new BadRequestException(`PDF chứa thành phần không được phép: ${marker}.`);

    let document: PDFDocument;
    try {
      document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
    } catch {
      throw new BadRequestException('PDF malformed, mã hóa hoặc không thể phân tích.');
    }
    const pages = document.getPages();
    if (pages.length !== 1) throw new BadRequestException('Chỉ chấp nhận PDF một trang.');
    const page = pages[0].getSize();
    if (Math.abs(page.width - PDF_PAGE_WIDTH_PT) > 2 || Math.abs(page.height - PDF_PAGE_HEIGHT_PT) > 2) {
      throw new BadRequestException('PDF phải có kích thước A4 dọc.');
    }
    const form = document.getForm();
    if (form.getFields().length > 0) throw new BadRequestException('Không chấp nhận PDF có AcroForm/XFA.');
    return {
      buffer: Buffer.from(buffer),
      filename: this.safeFilename(filename), mimeType: 'application/pdf',
      pageWidth: page.width, pageHeight: page.height,
      checksum: createHash('sha256').update(buffer).digest('hex'),
    };
  }

  private safeFilename(value: string): string {
    return String(value || 'template.pdf').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'template.pdf';
  }
}

