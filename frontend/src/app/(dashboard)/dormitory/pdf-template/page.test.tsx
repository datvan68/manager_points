import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryPdfTemplatePage from './page';
import NewDormitoryPdfTemplatePage from './new/page';
import EditDormitoryPdfTemplatePage from './[templateTypeCode]/edit/page';

let searchParamValues: Record<string, string> = {};
let pathParams: Record<string, string> = {};

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamValues[key] || null,
  }),
  useParams: () => pathParams,
}));

vi.mock('@/components/pdf-template/PdfTemplateCatalog', () => ({
  default: ({ routeBase, lockedModuleCode }: any) => (
    <div data-testid="pdf-template-catalog" data-route-base={routeBase} data-locked-module={lockedModuleCode}>
      Catalog
    </div>
  ),
}));

vi.mock('@/components/pdf-template/PdfTemplateEditorRoute', () => ({
  default: ({ mode, templateTypeCode, routeBase }: any) => (
    <div data-testid="pdf-template-editor" data-mode={mode} data-code={templateTypeCode} data-route-base={routeBase}>
      Editor
    </div>
  ),
}));

describe('dormitory PDF template routes', () => {
  beforeEach(() => {
    searchParamValues = {};
    pathParams = {};
  });

  it('renders DormitoryPdfTemplatePage with routeBase and lockedModuleCode', () => {
    render(<DormitoryPdfTemplatePage />);
    const catalog = screen.getByTestId('pdf-template-catalog');
    expect(catalog).toHaveAttribute('data-route-base', '/dormitory/pdf-template');
    expect(catalog).toHaveAttribute('data-locked-module', 'DORMITORY');
  });

  it('renders NewDormitoryPdfTemplatePage reading search parameters', () => {
    searchParamValues = { templateTypeCode: 'DORMITORY_ROSTER_APPLICATION' };
    render(<NewDormitoryPdfTemplatePage />);
    const editor = screen.getByTestId('pdf-template-editor');
    expect(editor).toHaveAttribute('data-mode', 'new');
    expect(editor).toHaveAttribute('data-code', 'DORMITORY_ROSTER_APPLICATION');
    expect(editor).toHaveAttribute('data-route-base', '/dormitory/pdf-template');
  });

  it('renders EditDormitoryPdfTemplatePage reading path parameters', () => {
    pathParams = { templateTypeCode: 'DORMITORY_ROSTER_APPLICATION' };
    render(<EditDormitoryPdfTemplatePage />);
    const editor = screen.getByTestId('pdf-template-editor');
    expect(editor).toHaveAttribute('data-mode', 'edit');
    expect(editor).toHaveAttribute('data-code', 'DORMITORY_ROSTER_APPLICATION');
    expect(editor).toHaveAttribute('data-route-base', '/dormitory/pdf-template');
  });
});
