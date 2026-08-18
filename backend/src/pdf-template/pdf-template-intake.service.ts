import { BadRequestException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { PDF_TEMPLATE_MAX_FILE_BYTES, PDF_TEMPLATE_MAX_PAGES } from './types';

const UNSAFE_MARKERS = ['/JavaScript', '/JS', '/OpenAction', '/AA', '/EmbeddedFile', '/EmbeddedFiles', '/AcroForm', '/XFA', '/Sig', '/ByteRange', '/Encrypt', '/GoToR', '/Launch', '/SubmitForm', '/ImportData', '/RichMedia', '/FileAttachment'];

export type ValidatedPdfSource = { buffer: Buffer; filename: string; mimeType: 'application/pdf'; checksum: string; pages: Array<{ pageIndex: number; width: number; height: number; rotation: number }> };

@Injectable()
export class PdfTemplateIntakeService {
  async validate(buffer: Buffer, filename = 'template.pdf', mimeType = 'application/pdf'): Promise<ValidatedPdfSource> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new BadRequestException('Tệp PDF rỗng.');
    if (buffer.length > PDF_TEMPLATE_MAX_FILE_BYTES) throw new BadRequestException('Tệp PDF vượt quá giới hạn 10 MiB.');
    if (mimeType !== 'application/pdf' || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new BadRequestException('Nội dung hoặc MIME type không phải PDF.');
    const raw = buffer.toString('latin1'); const marker = UNSAFE_MARKERS.find((value) => raw.includes(value));
    if (marker) throw new BadRequestException(`PDF chứa thành phần không được phép: ${marker}.`);
    let document: PDFDocument;
    try { document = await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false }); } catch { throw new BadRequestException('PDF malformed, mã hóa hoặc không thể phân tích.'); }
    const pages = document.getPages();
    if (pages.length < 1 || pages.length > PDF_TEMPLATE_MAX_PAGES) throw new BadRequestException('PDF phải có từ 1 đến 10 trang.');
    try {
      if (document.getForm().getFields().length > 0) throw new BadRequestException('Không chấp nhận AcroForm/XFA.');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('PDF form không hợp lệ.');
    }
    const metadata = pages.map((page, pageIndex) => {
      const size = page.getSize();
      if (![size.width, size.height].every((value) => Number.isFinite(value) && value >= 1 && value <= 10000)) throw new BadRequestException('Kích thước trang PDF không được phép.');
      const rotation = page.getRotation().angle || 0;
      if (!Number.isFinite(rotation) || rotation < -360 || rotation > 360) throw new BadRequestException('Rotation trang PDF không hợp lệ.');
      return { pageIndex, width: size.width, height: size.height, rotation };
    });
    return { buffer: Buffer.from(buffer), filename: this.safeFilename(filename), mimeType: 'application/pdf', checksum: createHash('sha256').update(buffer).digest('hex'), pages: metadata };
  }

  private safeFilename(value: string) { return String(value || 'template.pdf').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'template.pdf'; }
}
