# DORMITORY_APPLICATION PDF layout contract

The designer stores field geometry in normalized top-left coordinates. The
source page is one A4 portrait page (`595.32 x 842.04 pt`); the renderer maps
`x`, `y`, `width`, and `height` to PDF points and never stores zoom values.

Each field has one catalog key, `pageIndex: 0`, geometry inside `[0,1]`, a
stable `zIndex`, and the allowlisted style properties in
`backend/src/dormitory/pdf-template/field-catalog.ts`. Unknown keys,
formatters, fonts, colors, expressions, HTML, JavaScript, and prototype keys
are rejected. The current catalog mirrors the existing roster export values;
missing values render as blank.

Drafts are mutable only with their optimistic `revisionToken`. A draft save
does not affect roster export. Publishing validates bounds, typography and
overflow first, then makes the revision immutable and selects it as the sole
active revision. Restoring an old revision creates a new draft that must be
validated and published again.

The bundled KTX PDF remains the no-database-write fallback until a validated
revision is published. Synthetic preview is the default; real roster preview
requires `DORM_REG_READ` and is rendered ephemerally.

