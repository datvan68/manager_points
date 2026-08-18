# KTX PDF template contract

KTX is registered as `DORMITORY_ROSTER_APPLICATION`, displayed as `Mẫu đơn đăng ký KTX`, under `DORMITORY / DORMITORY_ROSTER`. The shared designer stores top-left normalized geometry per page and allows only the adapter's namespaced field keys and formatters.

The current template is one `pdf_templates` record with a validated source PDF, source checksum, page metadata, normalized layout, optimistic `version`, and audit timestamp/actor. A successful direct save replaces the current configuration and is immediately used by roster export. There are no draft, publish, revision, restore, or approval states.

The bundled KTX PDF and default layout remain the no-database-write fallback when no valid saved template exists. Synthetic preview is the default; real roster export remains guarded by `DORM_REG_READ`.

