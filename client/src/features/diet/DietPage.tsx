import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Droplets, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { ProgressBar } from "../../components/ProgressBar";
import { apiRequest } from "../../lib/api";
import { localDateString } from "../../lib/dates";
import type { DietData, MealLog, MealPlan, MealType, ShoppingItem } from "../../lib/types";

type Editor =
  | { kind: "plan"; item?: MealPlan; mealType?: MealType }
  | { kind: "log"; item?: MealLog; mealType?: MealType }
  | { kind: "shopping" }
  | null;
interface DeleteTarget {
  kind: "plan" | "log" | "shopping";
  id: string;
  title: string;
}

const meals: Array<{ type: MealType; label: string; defaultTime: string }> = [
  { type: "breakfast", label: "早餐", defaultTime: "08:00" },
  { type: "lunch", label: "午餐", defaultTime: "12:00" },
  { type: "dinner", label: "晚餐", defaultTime: "18:30" },
  { type: "snack", label: "加餐", defaultTime: "15:30" }
];

export function DietPage() {
  const date = localDateString();
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const diet = useQuery({
    queryKey: ["diet", date],
    queryFn: () => apiRequest<DietData>(`/api/diet?date=${date}`)
  });
  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<Record<string, string>>("/api/settings")
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["diet"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plan-sources"] });
  }

  async function mutate(path: string, method: string, payload?: object) {
    setSaving();
    try {
      const result = await apiRequest(path, {
        method,
        body: payload ? JSON.stringify(payload) : undefined
      });
      setSaved();
      refresh();
      return result;
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
      throw error;
    }
  }

  async function savePlan(data: Omit<MealPlan, "id">) {
    const item = editor?.kind === "plan" ? editor.item : undefined;
    await mutate(item ? `/api/diet/meal-plans/${item.id}` : "/api/diet/meal-plans", item ? "PATCH" : "POST", data);
    setEditor(null);
    notify("餐食计划已保存");
  }

  async function saveLog(data: Omit<MealLog, "id">) {
    const item = editor?.kind === "log" ? editor.item : undefined;
    await mutate(item ? `/api/diet/meal-logs/${item.id}` : "/api/diet/meal-logs", item ? "PATCH" : "POST", data);
    setEditor(null);
    notify("用餐记录已保存");
  }

  async function saveShopping(data: Pick<ShoppingItem, "name" | "category">) {
    await mutate("/api/diet/shopping", "POST", { ...data, purchased: false });
    setEditor(null);
    notify("采购项已添加");
  }

  async function addWater() {
    await mutate("/api/diet/water", "POST", { logDate: date, amountMl: 250 });
    notify("已记录 250 ml 饮水");
  }

  async function generateShopping() {
    await mutate("/api/diet/shopping/from-meals", "POST", { date });
    notify("已从今天的餐食生成采购候选");
  }

  async function toggleShopping(item: ShoppingItem) {
    await mutate(`/api/diet/shopping/${item.id}`, "PATCH", {
      name: item.name,
      category: item.category,
      purchased: !item.purchased
    });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths = {
      plan: `/api/diet/meal-plans/${deleteTarget.id}`,
      log: `/api/diet/meal-logs/${deleteTarget.id}`,
      shopping: `/api/diet/shopping/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setDeleteTarget(null);
      setSaved();
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  if (diet.isPending) return <div className="page-content"><div className="loading-panel">正在读取饮食记录…</div></div>;
  if (diet.isError) return <div className="page-content"><div className="error-panel">{diet.error.message}</div></div>;

  const target = Number(settings.data?.waterTargetMl ?? 2000);
  const waterPercent = Math.min(100, Math.round((diet.data.waterTotal / target) * 100));

  return (
    <div className="page-content diet-page">
      <div className="stat-strip">
        <div><span>饮水</span><strong>{diet.data.waterTotal} / {target} ml</strong></div>
        <div><span>已记录餐食</span><strong>{diet.data.mealLogs.length} 餐</strong></div>
        <div><span>待采购</span><strong>{diet.data.shopping.filter((item) => !item.purchased).length} 项</strong></div>
      </div>
      <div className="diet-layout">
        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">TODAY</span><h2>今天的饮食</h2></div><button className="button secondary" onClick={() => setEditor({ kind: "log", mealType: "snack" })} type="button"><Plus size={14} />记录用餐</button></div>
            <div className="panel-body meal-grid">
              {meals.map((meal) => {
                const plan = diet.data.mealPlans.find((item) => item.mealType === meal.type);
                const log = diet.data.mealLogs.find((item) => item.mealType === meal.type);
                return (
                  <article className="meal-card" key={meal.type}>
                    <div className="meal-head"><strong>{meal.label}</strong><div className="row-actions">{plan ? <span className="mini-badge">已计划</span> : null}{log ? <span className="mini-badge">已吃</span> : null}</div></div>
                    <div className="meal-body">
                      <span>计划：{plan?.foods ?? "未安排"}</span>
                      <span>实际：{log?.foods ?? "未记录"}</span>
                      {log?.feelings ? <span>{log.feelings}</span> : null}
                    </div>
                    <div className="row-actions">
                      <button className="tiny-text-button" onClick={() => setEditor({ kind: "plan", item: plan, mealType: meal.type })} type="button">{plan ? "编辑计划" : "添加计划"}</button>
                      <button className="tiny-text-button" onClick={() => setEditor({ kind: "log", item: log, mealType: meal.type })} type="button">{log ? "编辑记录" : "记录实际"}</button>
                      {plan ? <button className="icon-text-button" aria-label={`删除${meal.label}计划`} onClick={() => setDeleteTarget({ kind: "plan", id: plan.id, title: `${meal.label}计划` })} type="button"><Trash2 size={11} /></button> : null}
                      {log ? <button className="icon-text-button" aria-label={`删除${meal.label}记录`} onClick={() => setDeleteTarget({ kind: "log", id: log.id, title: `${meal.label}记录` })} type="button"><Trash2 size={11} /></button> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">RECENT</span><h2>最近吃过的餐</h2></div></div>
            <div className="panel-body recent-meals">
              {diet.data.recentMeals.length === 0 ? <div className="inline-empty">记录实际用餐后，这里会出现常用餐。</div> : diet.data.recentMeals.map((meal) => <button className="recent-meal-row" onClick={() => setEditor({ kind: "log", mealType: meal.mealType })} type="button" key={`${meal.mealType}-${meal.foods}`}><strong>{meal.foods}</strong><span>{mealLabel(meal.mealType)} · 最近 {meal.lastDate}</span></button>)}
            </div>
          </section>
        </div>
        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">WATER</span><h2>饮水</h2></div><span className="mini-badge">{waterPercent}%</span></div>
            <div className="panel-body">
              <div className="water-progress"><Droplets size={22} /><div><strong>{diet.data.waterTotal} ml</strong><span>目标 {target} ml</span></div></div>
              <ProgressBar value={waterPercent} label="今日饮水进度" />
              <button className="button primary water-button" onClick={() => void addWater()} type="button"><Plus size={14} />记录 250 ml</button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><div><span className="eyebrow">SHOPPING</span><h2>采购清单</h2></div><div className="row-actions"><button className="tiny-text-button" onClick={() => void generateShopping()} type="button">从餐食生成</button><button className="button secondary" onClick={() => setEditor({ kind: "shopping" })} type="button"><Plus size={13} />添加</button></div></div>
            <div className="panel-body shopping-list">
              {diet.data.shopping.length === 0 ? <div className="inline-empty">采购清单为空。</div> : diet.data.shopping.map((item) => <div className={`shopping-row${item.purchased ? " completed" : ""}`} key={item.id}><button className={`check-button${item.purchased ? " checked" : ""}`} aria-label={item.purchased ? `标记${item.name}未买` : `标记${item.name}已买`} onClick={() => void toggleShopping(item)} type="button">{item.purchased ? <Check size={11} /> : null}</button><span>{item.name}</span>{item.category ? <span className="mini-badge">{item.category}</span> : null}<button className="icon-text-button" aria-label={`删除采购项：${item.name}`} onClick={() => setDeleteTarget({ kind: "shopping", id: item.id, title: item.name })} type="button"><Trash2 size={11} /></button></div>)}
            </div>
          </section>
        </div>
      </div>

      <DetailDrawer open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(null); }} title={dietEditorTitle(editor)} description="饮食记录保存在本地文件中">
        {editor?.kind === "plan" ? <MealPlanForm date={date} meal={editor.mealType ?? "lunch"} item={editor.item} onSave={savePlan} /> : null}
        {editor?.kind === "log" ? <MealLogForm date={date} meal={editor.mealType ?? "lunch"} item={editor.item} recentMeals={diet.data.recentMeals} onSave={saveLog} /> : null}
        {editor?.kind === "shopping" ? <ShoppingForm onSave={saveShopping} /> : null}
      </DetailDrawer>
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }} title="确认删除？" description={deleteTarget?.kind === "plan" ? `“${deleteTarget.title}”将被永久删除。已加入今日计划的记录会保留标题快照并标记“来源已删除”。` : `“${deleteTarget?.title ?? ""}”将被永久删除。`} confirmLabel="删除" danger onConfirm={() => void confirmDelete()} />
    </div>
  );
}

function MealPlanForm({ date, meal, item, onSave }: { date: string; meal: MealType; item?: MealPlan; onSave: (value: Omit<MealPlan, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ mealType: item?.mealType ?? meal, foods: item?.foods ?? "", plannedTime: item?.plannedTime ?? meals.find((entry) => entry.type === meal)?.defaultTime ?? null, notes: item?.notes ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, planDate: date }); }}><label className="field"><span>餐次</span><select value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value as MealType })}>{meals.map((entry) => <option value={entry.type} key={entry.type}>{entry.label}</option>)}</select></label><label className="field"><span>计划吃什么</span><textarea required value={form.foods} onChange={(event) => setForm({ ...form, foods: event.target.value })} /></label><label className="field"><span>预计时间</span><input type="time" value={form.plannedTime ?? ""} onChange={(event) => setForm({ ...form, plannedTime: event.target.value || null })} /></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存餐食计划</button></form>;
}

function MealLogForm({ date, meal, item, recentMeals, onSave }: { date: string; meal: MealType; item?: MealLog; recentMeals: DietData["recentMeals"]; onSave: (value: Omit<MealLog, "id">) => Promise<void> }) {
  const [form, setForm] = useState({ mealType: item?.mealType ?? meal, foods: item?.foods ?? "", eatenAt: item?.eatenAt ?? null, feelings: item?.feelings ?? "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, logDate: date }); }}>{recentMeals.length > 0 ? <label className="field"><span>从最近吃过选择</span><select defaultValue="" onChange={(event) => { const selected = recentMeals.find((entry) => entry.foods === event.target.value); if (selected) setForm({ ...form, foods: selected.foods, mealType: selected.mealType }); }}><option value="">手动填写</option>{recentMeals.map((entry) => <option value={entry.foods} key={`${entry.mealType}-${entry.foods}`}>{mealLabel(entry.mealType)} · {entry.foods}</option>)}</select></label> : null}<label className="field"><span>餐次</span><select value={form.mealType} onChange={(event) => setForm({ ...form, mealType: event.target.value as MealType })}>{meals.map((entry) => <option value={entry.type} key={entry.type}>{entry.label}</option>)}</select></label><label className="field"><span>实际吃了什么</span><textarea required value={form.foods} onChange={(event) => setForm({ ...form, foods: event.target.value })} /></label><label className="field"><span>用餐时间</span><input type="time" value={form.eatenAt ?? ""} onChange={(event) => setForm({ ...form, eatenAt: event.target.value || null })} /></label><label className="field"><span>感受</span><textarea value={form.feelings} onChange={(event) => setForm({ ...form, feelings: event.target.value })} /></label><button className="button primary" type="submit">保存用餐记录</button></form>;
}

function ShoppingForm({ onSave }: { onSave: (value: Pick<ShoppingItem, "name" | "category">) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", category: "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>采购内容</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>分类</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="蛋白质、主食、蔬菜" /></label><button className="button primary" type="submit"><ShoppingBasket size={14} />添加到采购清单</button></form>;
}

function mealLabel(meal: MealType) {
  return meals.find((item) => item.type === meal)?.label ?? meal;
}
function dietEditorTitle(editor: Editor) {
  if (!editor) return "";
  return editor.kind === "plan" ? `${editor.item ? "编辑" : "添加"}餐食计划` : editor.kind === "log" ? `${editor.item ? "编辑" : "记录"}实际用餐` : "添加采购项";
}
