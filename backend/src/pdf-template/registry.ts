import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { PdfTemplateTypeDescriptor } from './types';
import { PDF_TEMPLATE_DESCRIPTORS } from './tokens';

@Injectable()
export class PdfTemplateRegistry implements OnModuleInit {
  private readonly descriptors = new Map<string, PdfTemplateTypeDescriptor>();
  private pending: PdfTemplateTypeDescriptor[] = [];

  constructor(@Optional() @Inject(PDF_TEMPLATE_DESCRIPTORS) descriptors: PdfTemplateTypeDescriptor[] = []) {
    descriptors.forEach((descriptor) => this.register(descriptor));
  }

  register(descriptor: PdfTemplateTypeDescriptor) {
    const code = descriptor.templateTypeCode;
    if (!code || this.descriptors.has(code) || this.pending.some((item) => item.templateTypeCode === code)) {
      throw new Error(`Duplicate PDF template type code: ${code}`);
    }
    this.pending.push(descriptor);
    return descriptor;
  }

  onModuleInit() {
    for (const descriptor of this.pending) {
      this.descriptors.set(descriptor.templateTypeCode, descriptor);
    }
    this.pending = [];
    for (const descriptor of this.descriptors.values()) {
      const fieldKeys = new Set<string>();
      for (const field of descriptor.fields) {
        if (fieldKeys.has(field.key)) throw new Error(`Duplicate PDF field key: ${descriptor.templateTypeCode}/${field.key}`);
        fieldKeys.add(field.key);
      }
    }
  }

  get(templateTypeCode: string) {
    const descriptor = this.descriptors.get(templateTypeCode);
    if (!descriptor) throw new Error(`Unknown PDF template type: ${templateTypeCode}`);
    return descriptor;
  }

  has(templateTypeCode: string) { return this.descriptors.has(templateTypeCode); }

  all() { return [...this.descriptors.values()]; }
}
