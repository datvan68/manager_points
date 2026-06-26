# Changelog Draft: Taskscope 1

## Feature Enhancements & UI Updates

### 1. Sticky Active Student Slider Styling
- **Updated:** The active student card in the sticky slider now uses a teal/cyan-green border (`#14B8A6`) and matching soft teal shadow (`shadow-[0_0_0_2px_rgba(20,184,166,0.22)]`) to distinctly highlight the selected student.
- **Maintained:** Non-active sticky cards and normal non-sticky slider cards retain their original neutral styles. Virtualization and transition properties remain unchanged for optimal performance.

### 2. Discipline Criteria Display Logic
- **Updated:** Discipline criteria backed by `academic_record` now natively display the criterion's maximum score when the violation count is `0`. 
- **Updated:** Progressive score deduction logic has been applied so that each violation (increment in count) deducts from the visible maximum score (e.g., maximum `5đ`, count `1` shows `4đ`, count `5` shows `0đ`).
- **Maintained:** The total-score calculation preserves its underlying contribution logic for non-counted discipline criteria (where `is_score_counted === false`), effectively decoupling the visible raw score UI from the categorical sum contributions.
- **Maintained:** The core `academic_record` architecture remains the source of truth, ensuring `evaluation_detail` aggregation, permission gates, and score sync processes function as before.

## Performance & Technical Debt
- **Verified:** Frontend rendering uses optimal FPS-friendly patterns (`@tanstack/react-virtual`, `React.memo`, `useMemo`, `requestAnimationFrame`) to ensure stable frame rates on the `/grading/score` screen.
- **Verified:** Backend queries utilize `.lean()` and targeted field projection (`fields='slider'`) for lightweight summary retrievals without loading embedded details.
