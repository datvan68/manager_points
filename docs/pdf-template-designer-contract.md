# PDF Template Designer contract

The shared subsystem is code-owned and direct-save. A descriptor registers one immutable `templateTypeCode`, its module/feature classification, field catalog, source permission, formatters, synthetic fixtures, and optional server-side resolver. The generic controller never receives a business record id or a caller-supplied resolved value map.

## Current record

`pdf_templates` contains one active `PdfTemplate` document per type. It stores the validated static PDF, SHA-256 source checksum, page metadata, normalized layout, `version`, and audit timestamp/actor. Saving requires the version returned by the read endpoint. A stale version returns `409 PDF_TEMPLATE_VERSION_CONFLICT`; it never overwrites the current record.

Layout geometry is top-left normalized (`x`, `y`, `width`, `height`) per page. Items reference only descriptor field keys and allowlisted formatters. No draft, publish, revision, restore, query, expression, or custom resolver state exists.

## Permission matrix

| Operation | Permission |
| --- | --- |
| Catalog, metadata, source, synthetic preview | `PDF_TEMPLATE_READ` |
| Direct save and source replacement | `PDF_TEMPLATE_MANAGE` |
| Real KTX export/preview | `DORM_REG_READ` in addition to the existing business route guard |

Synthetic fixtures are the default verification path. Template records and audit fields contain no business values.

## Extension rule

Add a descriptor under the owning business module, register it through `PdfTemplateModule.register`, add a disjoint field catalog and synthetic fixture, then add the adapter's focused authorization and renderer tests. Shared persistence, controller, editor, and renderer must not import business models.

