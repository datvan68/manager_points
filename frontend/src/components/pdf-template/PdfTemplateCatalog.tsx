'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pdfTemplateApi, PdfTemplateCatalogItem } from '@/api/pdf-template-api';
import { RouteGuard, usePermission } from '@/components/guards/RouteGuard';

export interface PdfTemplateCatalogProps {
  routeBase?: string;
  lockedModuleCode?: string;
}

function CatalogPage({ routeBase = '/dormitory/pdf-template', lockedModuleCode }: PdfTemplateCatalogProps) {
  const router = useRouter();
  const params = useSearchParams();
  const access = usePermission({
    read: 'PDF_TEMPLATE_READ',
    manage: 'PDF_TEMPLATE_MANAGE',
    delete: 'PDF_TEMPLATE_DELETE',
  });

  const [items, setItems] = useState<PdfTemplateCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mutating, setMutating] = useState(false);

  const load = async () => {
    if (!access.read) return;
    setLoading(true);
    setError('');
    try {
      const firstPage = await pdfTemplateApi.catalog({
        page: 1,
        pageSize: 100,
        moduleCode: lockedModuleCode || undefined,
        sortBy: 'displayName',
        sortDirection: 'asc',
      });

      const pageCount = Math.max(1, Math.ceil(firstPage.total / (firstPage.pageSize || 100)));
      const allItems: PdfTemplateCatalogItem[] = [...(firstPage.items || [])];

      if (pageCount > 1) {
        const remainingRequests = [];
        for (let nextPage = 2; nextPage <= pageCount; nextPage += 1) {
          remainingRequests.push(
            pdfTemplateApi.catalog({
              page: nextPage,
              pageSize: 100,
              moduleCode: lockedModuleCode || undefined,
              sortBy: 'displayName',
              sortDirection: 'asc',
            })
          );
        }
        const remainingPages = await Promise.all(remainingRequests);
        for (const res of remainingPages) {
          if (res?.items) {
            allItems.push(...res.items);
          }
        }
      }

      const uniqueMap = new Map<string, PdfTemplateCatalogItem>();
      for (const item of allItems) {
        if (!lockedModuleCode || item.moduleCode === lockedModuleCode) {
          uniqueMap.set(item.templateTypeCode, item);
        }
      }

      const sortedItems = [...uniqueMap.values()].sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'vi')
      );

      setItems(sortedItems);
    } catch (cause: any) {
      setError(cause?.message || 'Không thể tải danh sách template.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!access.read) return;
    void load();
  }, [access.read, lockedModuleCode]);

  const returnQuery = params.toString();

  const deleteItem = async (item: PdfTemplateCatalogItem) => {
    if (!access.delete || mutating) return;
    if (
      !window.confirm(
        `Xóa PDF và toàn bộ layout của “${item.displayName}” (${item.templateTypeCode})? Collection vẫn được giữ nguyên và sẽ trở về Chưa cấu hình.`
      )
    ) {
      return;
    }
    if (
      window.prompt(`Nhập chính xác ${item.templateTypeCode} để xác nhận:`) !==
      item.templateTypeCode
    ) {
      return;
    }
    setMutating(true);
    setError('');
    try {
      await pdfTemplateApi.delete(item.templateTypeCode, item.version);
      await load();
    } catch (cause: any) {
      setError(cause?.message || 'Không thể xóa template.');
    } finally {
      setMutating(false);
    }
  };

  if (!access.read) {
    return <div className="p-8 text-sm">Bạn không có quyền xem PDF template.</div>;
  }

  return (
    <main className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6" aria-labelledby="pdf-template-title">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-blue-600">PDF Template Designer</p>
        <h1 id="pdf-template-title" className="text-2xl font-black text-slate-900">
          Quản lý mẫu PDF
        </h1>
        <p className="text-sm text-slate-500">
          Mỗi collection đã đăng ký có tối đa một PDF và layout hiện hành.
        </p>
      </div>

      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {loading && (
        <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">
          Đang tải danh sách template...
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="rounded-xl border border-dashed p-8 text-sm text-slate-500">
          Không có collection nào.
        </p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.templateTypeCode}
              className="flex flex-col justify-between rounded-2xl border border-white/70 bg-white/60 p-5 shadow-sm backdrop-blur-md transition-all hover:bg-white/80 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-base font-bold leading-snug text-slate-900">
                  {item.displayName}
                </h2>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    item.configured
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {item.configured ? 'Đã tải lên' : 'Chưa tải lên'}
                </span>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 border-t border-slate-100/80 pt-4">
                {item.configured ? (
                  <>
                    {access.manage && (
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() =>
                          router.push(
                            `${routeBase}/${encodeURIComponent(item.templateTypeCode)}/edit?returnTo=${encodeURIComponent(returnQuery)}`
                          )
                        }
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        Chỉnh sửa
                      </button>
                    )}
                    {access.delete && (
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() => void deleteItem(item)}
                        className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Xóa
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {access.manage && (
                      <button
                        type="button"
                        disabled={mutating}
                        onClick={() =>
                          router.push(
                            `${routeBase}/new?templateTypeCode=${encodeURIComponent(item.templateTypeCode)}&returnTo=${encodeURIComponent(returnQuery)}`
                          )
                        }
                        className="rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        Tải PDF lên
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

export default function PdfTemplateCatalog(props: PdfTemplateCatalogProps = {}) {
  return (
    <RouteGuard requiredPermission="PDF_TEMPLATE_READ" fallbackPath="/">
      <CatalogPage {...props} />
    </RouteGuard>
  );
}
