"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TabNavigation from "@/components/ui/TabNavigation";
import CategoryModal from "@/components/grading/CategoryModal";
import CriteriaModal from "@/components/grading/CriteriaModal";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { RouteGuard } from "@/components/guards/RouteGuard";
import { toast } from "sonner";
import { categoryApi } from "@/api/category-api";
import { criteriaApi } from "@/api/criteria-api";
import { tokenStorage } from "@/api/auth-api";

const glassCard =
  "border border-slate-200/70 bg-white/45 backdrop-blur-md shadow-sm shadow-slate-300/40 rounded-2xl";
const action =
  "transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/30";
const FullContent = ({ content, label }: { content: string; label: string }) =>
  content.length <= 70 ? (
    <span>{content}</span>
  ) : (
    <span title={`${label} ${content}`}>{content.slice(0, 70)}...</span>
  );

function CategoriesPage() {
  const router = useRouter();
  const user = tokenStorage.getUser();
  const hasUser = Boolean(user);
  const role = (user?.role || "").toLowerCase();
  const isAdmin = role.includes("admin") || role.includes("supervisor");
  const isStudent = role.includes("student");
  const tabs = [
    ...(!isStudent ? [{ id: "list", label: "Danh sách" }] : []),
    { id: "score", label: "Chấm điểm" },
    ...(isAdmin ? [{ id: "reports", label: "Danh mục" }] : []),
  ];
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryModal, setCategoryModal] = useState({
    open: false,
    edit: false,
    data: null as any,
  });
  const [criterionModal, setCriterionModal] = useState({
    open: false,
    edit: false,
    data: null as any,
    categoryId: "",
  });
  const [categoryDelete, setCategoryDelete] = useState<any>(null);
  const [criterionDelete, setCriterionDelete] = useState<any>(null);

  const fetchData = async () => {
    try {
      setFetching(true);
      const [cats, items] = await Promise.all([
        categoryApi.getCategories(),
        criteriaApi.getCriteria(),
      ]);
      const mappedCats = cats.map((cat: any) => ({
        id: cat.category_code,
        _id: cat._id,
        name: cat.category_name,
        maxPoints: cat.max_score,
        sort_order: cat.sort_order,
        status: true,
      }));
      const mappedItems = items.map((item: any) => {
        const parent = cats.find(
          (cat: any) =>
            cat._id ===
            (typeof item.category_id === "object"
              ? item.category_id?._id
              : item.category_id),
        );
        return {
          id: item._id,
          _id: item._id,
          code: item.criterion_code,
          name: item.criterion_name,
          description: item.description || "",
          type: item.criterion_type,
          points: item.score_per_unit,
          minPoints: item.min_score,
          maxPoints: item.max_score,
          categoryId: parent?.category_code || "",
          categoryObjectId: parent?._id || item.category_id,
          is_locked: !!item.is_locked,
          is_score_counted: item.is_score_counted !== false,
          scoring_mode: item.scoring_mode || "count",
          options: item.options || [],
        };
      });
      setCategories(mappedCats);
      setCriteria(mappedItems);
      setSelectedId((old) =>
        old && mappedCats.some((cat: any) => cat.id === old)
          ? old
          : mappedCats[0]?.id || null,
      );
    } catch (error: any) {
      toast.error("Lỗi khi tải dữ liệu từ database: " + error.message);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  };
  useEffect(() => {
    if (!hasUser) return;
    if (!isAdmin) {
      router.replace(isStudent ? "/grading/score" : "/grading");
      return;
    }
    fetchData();
  }, [hasUser, isAdmin, isStudent, router]);

  const visibleCategories = useMemo(
    () =>
      categories.filter((cat) =>
        `${cat.id} ${cat.name}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [categories, search],
  );
  const active = categories.find((cat) => cat.id === selectedId);
  const activeCriteria = criteria.filter(
    (item) => item.categoryId === active?.id,
  );
  const total = activeCriteria.reduce(
    (sum, item) => sum + Number(item.maxPoints || 0),
    0,
  );
  const openCategory = (edit: boolean, data: any = null) =>
    setCategoryModal({ open: true, edit, data });
  const openCriterion = (edit: boolean, data: any = null) =>
    setCriterionModal({ open: true, edit, data, categoryId: active?.id || "" });
  const saveCategory = (data: any) => {
    const payload = {
      category_code: data.id,
      category_name: data.name,
      max_score: Number(data.maxPoints),
      sort_order: Number(
        data.sort_order ||
          categoryModal.data?.sort_order ||
          categories.length + 1,
      ),
    };
    const request = categoryModal.edit
      ? categoryApi.updateCategory(categoryModal.data._id, payload)
      : categoryApi.createCategory(payload);
    request
      .then(fetchData)
      .then(() =>
        toast.success(
          `${categoryModal.edit ? "Cập nhật" : "Thêm"} danh mục thành công!`,
        ),
      )
      .catch((error) => toast.error("Lỗi khi lưu danh mục: " + error.message));
  };
  const saveCriterion = async (data: any) => {
    const cat = categories.find((item) => item.id === data.categoryId);
    const payload = {
      category_id: cat?._id || data.categoryId,
      criterion_code: data.criterion_code,
      criterion_name: data.name,
      description: data.description?.trim() || undefined,
      criterion_type: data.type,
      score_per_unit: Number(data.points),
      min_score: Number(data.minPoints),
      max_score: Number(data.maxPoints),
      is_locked: !!data.is_locked,
      is_score_counted:
        data.type === "ky_luat" ? !!data.is_score_counted : true,
      scoring_mode: data.scoring_mode,
      options: data.options?.map(({ _id, ...item }: any) => item),
    };
    try {
      if (criterionModal.edit)
        await criteriaApi.updateCriterion(criterionModal.data._id, payload);
      else await criteriaApi.createCriterion(payload);
      await fetchData();
    } catch (error: any) {
      toast.error("Lỗi khi lưu tiêu chí: " + error.message);
    }
  };
  const deleteCategory = async () => {
    if (!categoryDelete) return;
    try {
      await categoryApi.deleteCategory(categoryDelete._id);
      const ids = criteria
        .filter((item) => item.categoryId === categoryDelete.id)
        .map((item) => item._id);
      if (ids.length) await criteriaApi.deleteCriteria(ids);
      await fetchData();
      toast.success("Đã xóa danh mục thành công!");
    } catch (error: any) {
      toast.error("Lỗi khi xóa danh mục: " + error.message);
    } finally {
      setCategoryDelete(null);
    }
  };
  const deleteCriterion = async () => {
    if (!criterionDelete) return;
    try {
      await criteriaApi.deleteCriterion(criterionDelete._id);
      await fetchData();
      toast.success("Đã xóa tiêu chí thành công!");
    } catch (error: any) {
      toast.error("Lỗi khi xóa tiêu chí: " + error.message);
    } finally {
      setCriterionDelete(null);
    }
  };

  return (
    <>
      <TabNavigation
        tabs={tabs}
        activeTab="reports"
        onTabChange={(id) =>
          router.push(id === "score" ? "/grading/score" : "/grading")
        }
      />
      <main className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4 md:px-8">
        <section
          className={`${glassCard} flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4`}
        >
          <header className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-[#1E293B]">
                Quản lý Danh mục & Tiêu chí
              </h1>
              <p className="mt-1 text-[12px] text-[#64748B]">
                Chọn danh mục để quản lý các tiêu chí chấm điểm.
              </p>
            </div>
            <button
              type="button"
              className={`${action} flex items-center gap-2 rounded-xl bg-[#1A73E8] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#155FC0] hover:scale-[1.01]`}
              onClick={() => openCategory(false)}
              disabled={loading}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Thêm danh mục</span>
            </button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            <aside
              className={`flex min-h-0 w-full flex-col gap-3 lg:w-2/5 ${active ? "hidden lg:flex" : "flex"}`}
            >
              <label className="relative shrink-0">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  aria-label="Tìm danh mục"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm danh mục..."
                  className="w-full rounded-xl border border-white/70 bg-white/50 px-3 py-2.5 pl-9 text-[13px] text-[#1E293B] outline-none transition-all duration-150 focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/30"
                />
              </label>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div
                      key={index}
                      className="animate-pulse rounded-xl border border-white/70 bg-white/45 p-4"
                    >
                      <Skeleton className="h-4 w-2/3 rounded-xl" />
                      <Skeleton className="mt-3 h-3 w-1/3 rounded-xl" />
                    </div>
                  ))
                ) : visibleCategories.length ? (
                  visibleCategories.map((cat) => {
                    const items = criteria.filter(
                      (item) => item.categoryId === cat.id,
                    );
                    const sum = items.reduce(
                      (value, item) => value + Number(item.maxPoints || 0),
                      0,
                    );
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => setSelectedId(cat.id)}
                        className={`${action} group w-full rounded-xl border p-4 text-left ${cat.id === selectedId ? "border-blue-200 bg-white/70 shadow-sm" : "border-white/70 bg-white/40 hover:bg-white/65"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="rounded-xl bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase text-[#1A73E8]">
                              {cat.id}
                            </span>
                            <h2 className="mt-2 truncate text-[14px] font-semibold text-[#1E293B]">
                              <FullContent
                                content={cat.name}
                                label="Danh mục:"
                              />
                            </h2>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Sửa danh mục ${cat.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                openCategory(true, cat);
                              }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-white/70 hover:text-blue-600"
                            >
                              <Pencil size={14} />
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label={`Xóa danh mục ${cat.name}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                setCategoryDelete(cat);
                              }}
                              className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-3 text-[11px] text-slate-500">
                          Tiêu chí{" "}
                          <b className="text-blue-600">{items.length}</b>
                          <span>
                            Tổng điểm{" "}
                            <b
                              className={
                                sum > Number(cat.maxPoints)
                                  ? "text-rose-600"
                                  : "text-blue-600"
                              }
                            >
                              {sum}/{cat.maxPoints}
                            </b>
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[13px] text-slate-500">
                    Chưa có danh mục phù hợp.
                    <button
                      type="button"
                      className="mt-3 rounded-xl px-3 py-1.5 font-semibold text-blue-600 hover:bg-white/60"
                      onClick={() => openCategory(false)}
                    >
                      + Thêm danh mục
                    </button>
                  </div>
                )}
              </div>
            </aside>
            <section
              className={`min-h-0 w-full ${active ? "flex" : "hidden lg:flex"} ${glassCard} flex-col overflow-hidden`}
            >
              {!active ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500">
                  <h2 className="text-[16px] font-semibold">
                    Chọn một danh mục
                  </h2>
                  <p className="mt-1 text-[13px]">
                    Chọn danh mục bên trái để xem và quản lý tiêu chí.
                  </p>
                </div>
              ) : (
                <>
                  <header className="shrink-0 border-b border-white/70 bg-white/30 p-4">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        aria-label="Quay lại danh sách"
                        className={`${action} rounded-xl p-1.5 text-slate-500 hover:bg-white/70 lg:hidden`}
                        onClick={() => setSelectedId(null)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <span className="rounded-xl bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase text-[#1A73E8]">
                          {active.id}
                        </span>
                        <h2 className="mt-2 truncate text-[16px] font-semibold text-[#1E293B]">
                          <FullContent
                            content={active.name}
                            label="Danh mục:"
                          />
                        </h2>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          aria-label="Sửa danh mục"
                          className={`${action} rounded-xl p-2 text-slate-500 hover:bg-white/70 hover:text-blue-600`}
                          onClick={() => openCategory(true, active)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          aria-label="Xóa danh mục"
                          className={`${action} rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600`}
                          onClick={() => setCategoryDelete(active)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </header>
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/60 px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-blue-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-500/20"
                        onClick={() => openCriterion(false)}
                      >
                        <Plus size={13} className="mr-1 inline" />
                        Thêm tiêu chí
                      </button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
                    {fetching && !loading ? (
                      <div className="py-8 text-center text-[13px] text-slate-400">
                        Đang cập nhật...
                      </div>
                    ) : activeCriteria.length ? (
                      activeCriteria.map((item) => (
                        <article
                          key={item.id}
                          className={`rounded-xl border bg-white/50 p-3 backdrop-blur-sm ${item.is_locked ? "border-rose-200" : "border-slate-200/70"}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-xl bg-slate-500/10 px-2 py-1 font-mono text-[10px] text-slate-600">
                                  {item.code}
                                </span>
                                {item.is_locked && (
                                  <span className="rounded-xl bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-700">
                                    Đã khóa
                                  </span>
                                )}
                              </div>
                              <h3 className="mt-2 text-[13px] font-semibold text-[#1E293B]">
                                <FullContent
                                  content={item.name}
                                  label="Tiêu chí:"
                                />
                              </h3>
                              {item.description && (
                                <p className="mt-1 break-words text-[11px] leading-[17px] text-slate-500">
                                  {item.description}
                                </p>
                              )}
                              <p className="mt-1 text-[11px] text-slate-500">
                                {item.type === "ky_luat"
                                  ? "Kỷ luật"
                                  : "Cộng điểm"}{" "}
                                · {item.points} điểm/lần · tối đa{" "}
                                {item.maxPoints}
                              </p>
                            </div>
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                aria-label={`Sửa tiêu chí ${item.name}`}
                                className={`${action} rounded-xl p-2 text-slate-500 hover:bg-white/70 hover:text-blue-600`}
                                onClick={() => openCriterion(true, item)}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa tiêu chí ${item.name}`}
                                disabled={item.is_locked}
                                className={`${action} rounded-xl p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40`}
                                onClick={() => setCriterionDelete(item)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-[13px] text-slate-500">
                        Chưa có tiêu chí trong danh mục này.
                        <button
                          type="button"
                          className="mt-3 block w-full rounded-xl px-3 py-1.5 font-semibold text-blue-600 hover:bg-white/60"
                          onClick={() => openCriterion(false)}
                        >
                          + Thêm tiêu chí đầu tiên
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      </main>
      <CategoryModal
        isOpen={categoryModal.open}
        onClose={() => setCategoryModal((state) => ({ ...state, open: false }))}
        isEditing={categoryModal.edit}
        initialData={categoryModal.data}
        onSave={saveCategory}
      />
      <CriteriaModal
        isOpen={criterionModal.open}
        onClose={() =>
          setCriterionModal((state) => ({ ...state, open: false }))
        }
        isEditing={criterionModal.edit}
        initialData={criterionModal.data}
        categories={categories}
        criteria={criteria}
        defaultCategoryId={criterionModal.categoryId}
        onSave={saveCriterion}
      />
      <ConfirmModal
        isOpen={!!categoryDelete}
        onClose={() => setCategoryDelete(null)}
        onConfirm={deleteCategory}
        title="Xác nhận xóa danh mục"
        message={`Bạn có chắc chắn muốn xóa danh mục "${categoryDelete?.name}"? Mọi tiêu chí thuộc danh mục này cũng sẽ bị xóa bỏ.`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />
      <ConfirmModal
        isOpen={!!criterionDelete}
        onClose={() => setCriterionDelete(null)}
        onConfirm={deleteCriterion}
        title="Xác nhận xóa tiêu chí"
        message={`Bạn có chắc chắn muốn xóa tiêu chí "${criterionDelete?.name}"?`}
        variant="danger"
        confirmLabel="Xác nhận xóa"
      />
    </>
  );
}

export default function ProtectedCategoriesPage() {
  return (
    <RouteGuard requiredPermission="GRADING_PAGE">
      <CategoriesPage />
    </RouteGuard>
  );
}
