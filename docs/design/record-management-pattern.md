# Record Management Page Pattern

This pattern adapts the reference screen into a reusable page for dense, operational record lists: attendance, conduct, requests, approvals, activities, and similar administrative data. It supplements [DESIGN.md](DESIGN.md); when the two documents differ, `DESIGN.md` remains the source of truth for global tokens and component rules.

## 1. Purpose and visual character

The page should feel calm and compact while making scanning, filtering, and row-level actions immediate. Use the blue-and-silver glass surface defined in `DESIGN.md`: a pale blue page background, white translucent controls, thin light borders, restrained shadows, and a blue active state.

Keep the primary workflow visible without scrolling:

1. Choose a view.
2. Narrow records with search and filters.
3. Scan rows and open the required record.
4. Move between result pages or adjust page size.

## 2. Page anatomy

```text
Page navigation tabs
────────────────────────────────────────────────────────────────
View switcher                 Search · date · filters · actions
────────────────────────────────────────────────────────────────
┌──────────────────────────────────────────────────────────────┐
│ selectable, scrollable data table                             │
│ columns + rows + row actions                                  │
├──────────────────────────────────────────────────────────────┤
│ result count · page-size selector              pagination    │
└──────────────────────────────────────────────────────────────┘
```

### Page navigation tabs

- Place page-level destinations in a horizontal bar above the work area.
- Use text-only tabs with `px-4 py-3` (or equivalent compact spacing).
- The active tab uses the accent blue text and a 2px blue bottom indicator. Inactive tabs use muted text and gain a subtle glass or text-color hover state.
- Do not use a pill treatment for this level of navigation; reserve rounded containers for controls inside the work area.

### View switcher

- Use this only when the same data set has two or more closely related views, such as “Student status” and “Class status”.
- Wrap the options in one glass container. The selected option is a white, raised-but-subtle segment; unselected options remain transparent.
- Make the selected label explicit. Do not communicate the selected state only with colour.

### Filter and action bar

- Keep search, date range, structured filters, settings, and the primary creation action on a single responsive toolbar.
- The visual order is: broad search, date filter, category/class filter, utility controls, primary action.
- Search has a search icon and descriptive placeholder. Selects disclose their affordance with a chevron. The date control uses a calendar icon plus a readable label.
- Use equal control height. At desktop size, let search be the flexible field and keep date/select/button widths stable.
- The primary action is a high-emphasis outlined glass button with a leading plus icon. Use the accent fill only when the product needs a stronger call to action.
- On narrow screens, wrap filters in logical groups and keep the primary action reachable; do not compress labels into icon-only controls unless there is an accessible name.

## 3. Data table pattern

### Container and structure

- Use a large glass container (`rounded-2xl`, translucent white surface, thin white border, light shadow) with `overflow-hidden`.
- Keep the table header visually distinct with a near-white surface and uppercase-or-strong labels. Avoid heavy dark borders.
- Use a horizontal scroll region for wide datasets. The table should not force the whole page to scroll sideways.
- Keep the footer/pagination visible at the table bottom; make it sticky only when the table body has its own vertical scroll area.

### Columns and hierarchy

The reference structure is reusable as follows:

| Column role | Recommended treatment |
| --- | --- |
| Selection | Leading checkbox column; supports bulk actions when at least one row is selected. |
| Identifier | Muted, tabular/mono-friendly text; avoid giving it more prominence than the name. |
| Primary subject | Strong dark text, usually a person, title, or record name. |
| Context | Muted text for class, group, owner, or category. |
| Type/status | Compact semantic icon or badge with an accessible text label. |
| Latest detail | Strong summary on the first line; muted date or metadata beneath it. |
| Count/metric | Muted count or aligned numeric value. |
| Score/impact | Semantic colour plus a sign where relevant, never colour alone. |
| Action | Trailing icon button, such as View; include tooltip and accessible name. |

- Right-align numeric metrics; keep identifiers and text fields left-aligned unless the dataset has a compelling local convention.
- Use a stable column order across related pages. Hide or move less important columns at small breakpoints rather than making every column too narrow to read.
- Table body rows use a very light cool-tinted surface with subtle separators. A row hover state should be perceptible but not compete with selected or danger states.
- Keep touch targets at least 40px tall even when text density is compact.

### Status and negative values

- Map record state to the semantic palette in `DESIGN.md` (blue active, amber warning, purple approved/info, rose danger/locked, slate muted/draft).
- A negative score or adverse event may use rose text/icon, as in the reference; pair it with its number or label so colour is not the only signal.
- Prefer a compact shield/icon plus text for record type when users may not already know the icon meaning.

## 4. Pagination and result state

- The footer begins with a localized range and total, for example: `Showing 1–40 of 193 records`.
- Put the rows-per-page label and selector beside the result count. Keep a visible selected value and dropdown affordance.
- Align pagination to the right: previous arrow, numbered pages, next arrow. The active page is a solid accent-blue `rounded-xl` control with white text.
- Disable unavailable navigation with reduced contrast and no hover affordance; retain an accessible explanation if needed.
- Empty, loading, error, and filtered-zero states belong inside the table region so the toolbar and page structure do not jump.

## 5. Responsive behavior

| Breakpoint intent | Behavior |
| --- | --- |
| Wide desktop | One filter row; full column set; result summary and pagination share the footer. |
| Tablet | Filters may wrap to a second row; preserve search and primary action prominence; allow table horizontal scrolling. |
| Mobile | Stack filter groups; use a scrollable tab rail; show primary subject, status, latest detail, and action first; expose secondary fields in a detail view or row expansion. |

Do not replace the table with cards automatically. Use cards only when the essential per-record decisions no longer fit in a horizontally scrollable table or when the target workflow is primarily touch-based.

## 6. Implementation checklist

- Apply the global `rounded-xl` rule to controls and `rounded-2xl` to the table shell.
- Reuse the global glass surface, border, text, motion, and semantic tokens; do not introduce a separate grey table theme.
- Preserve keyboard navigation: tabs, all form controls, row actions, checkboxes, selects, and pagination must have visible focus states.
- Use real `<table>`, `<thead>`, `<th>`, and `<td>` semantics for tabular data; add `scope` to headers and labels for selection controls.
- Provide labels/tooltips for icon-only settings, view, chevron, and pagination controls.
- Keep filters reflected in the URL or page state according to the owning page's existing convention, and reset pagination when a filter changes.

## 7. Avoid

- Overly rounded pills, dark borders, thick shadows, or neumorphic depth.
- Multiple competing primary buttons in the toolbar.
- Hiding critical status, score, or action meaning behind colour or an unexplained icon.
- Inconsistent control heights, column alignment, or row density between related pages.
- Fixed-width tables that overflow the viewport without a contained horizontal scroll area.
