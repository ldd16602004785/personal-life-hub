import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarHeart,
  Camera,
  Check,
  Gift,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { useUI } from "../../app/UIProvider";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { DetailDrawer } from "../../components/DetailDrawer";
import { EmptyState } from "../../components/EmptyState";
import { apiRequest } from "../../lib/api";
import { formatShortDate, localDateString } from "../../lib/dates";
import type {
  CareData,
  CareDate,
  CarePreference,
  CareProfile,
  CareStory,
  CareWish
} from "../../lib/types";

type Editor =
  | { kind: "profile" }
  | { kind: "date"; item?: CareDate }
  | { kind: "story"; item?: CareStory }
  | { kind: "preference" }
  | { kind: "wish"; item?: CareWish }
  | null;

interface DeleteTarget {
  kind: "date" | "story" | "preference" | "wish";
  id: string;
  title: string;
  hasPhoto?: boolean;
}

export function CarePage() {
  const queryClient = useQueryClient();
  const { notify, setSaving, setSaved, setSaveError } = useUI();
  const [editor, setEditor] = useState<Editor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deletePhoto, setDeletePhoto] = useState(false);
  const [storyTag, setStoryTag] = useState("all");
  const care = useQuery({
    queryKey: ["care"],
    queryFn: () => apiRequest<CareData>("/api/care")
  });

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["care"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["day-plan-sources"] });
  }

  async function save(path: string, method: string, payload?: BodyInit | object) {
    setSaving();
    try {
      return await apiRequest(path, {
        method,
        body:
          payload instanceof FormData
            ? payload
            : payload
              ? JSON.stringify(payload)
              : undefined
      });
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
      throw error;
    }
  }

  async function saveProfile(data: Omit<CareProfile, "id" | "updatedAt">) {
    await save("/api/care/profile", "PUT", data);
    setSaved();
    setEditor(null);
    notify("对象资料已保存");
    refresh();
  }

  async function saveDate(data: Omit<CareDate, "id" | "nextDate" | "days" | "attention">) {
    const item = editor?.kind === "date" ? editor.item : undefined;
    await save(item ? `/api/care/dates/${item.id}` : "/api/care/dates", item ? "PATCH" : "POST", data);
    setSaved();
    setEditor(null);
    notify(item ? "重要日期已更新" : "重要日期已添加");
    refresh();
  }

  async function saveStory(
    data: Omit<CareStory, "id" | "photoPath" | "photoOriginalName" | "photoMediaType" | "photoSize" | "photoUrl">,
    file: File | null
  ) {
    const item = editor?.kind === "story" ? editor.item : undefined;
    const saved = (await save(
      item ? `/api/care/stories/${item.id}` : "/api/care/stories",
      item ? "PATCH" : "POST",
      data
    )) as CareStory;
    if (file) {
      const form = new FormData();
      form.append("file", file);
      await save(`/api/care/stories/${saved.id}/photo`, "POST", form);
    }
    setSaved();
    setEditor(null);
    notify(file ? "趣事和照片已保存" : "趣事已保存");
    refresh();
  }

  async function savePreference(data: Pick<CarePreference, "groupName" | "content" | "notes">) {
    await save("/api/care/preferences", "POST", data);
    setSaved();
    setEditor(null);
    notify("偏好已添加");
    refresh();
  }

  async function saveWish(
    data: Omit<CareWish, "id">
  ) {
    const item = editor?.kind === "wish" ? editor.item : undefined;
    await save(item ? `/api/care/wishes/${item.id}` : "/api/care/wishes", item ? "PATCH" : "POST", data);
    setSaved();
    setEditor(null);
    notify(item ? "小心愿已更新" : "小心愿已添加");
    refresh();
  }

  async function toggleWish(wish: CareWish) {
    const status = wish.status === "completed" ? "planning" : "completed";
    await save(`/api/care/wishes/${wish.id}`, "PATCH", {
      title: wish.title,
      type: wish.type,
      status,
      budget: wish.budget,
      targetDate: wish.targetDate,
      notes: wish.notes
    });
    setSaved();
    refresh();
  }

  async function addWishToToday(wish: CareWish) {
    await save("/api/day-plans", "POST", {
      date: localDateString(),
      sourceModule: "care",
      sourceId: wish.id
    });
    notify("已加入今日计划");
    refresh();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const paths: Record<DeleteTarget["kind"], string> = {
      date: `/api/care/dates/${deleteTarget.id}`,
      story: `/api/care/stories/${deleteTarget.id}?deletePhoto=${deletePhoto}`,
      preference: `/api/care/preferences/${deleteTarget.id}`,
      wish: `/api/care/wishes/${deleteTarget.id}`
    };
    try {
      setSaving("正在删除…");
      await apiRequest(paths[deleteTarget.kind], { method: "DELETE" });
      setSaved();
      setDeleteTarget(null);
      setDeletePhoto(false);
      notify("记录已删除");
      refresh();
    } catch (error) {
      setSaveError();
      notify((error as Error).message, "error");
    }
  }

  const visibleStories = useMemo(() => {
    if (!care.data) return [];
    return care.data.stories.filter((story) => storyTag === "all" || story.tag === storyTag);
  }, [care.data, storyTag]);

  const tags = useMemo(
    () => [...new Set(care.data?.stories.map((story) => story.tag).filter(Boolean) ?? [])],
    [care.data]
  );

  if (care.isPending) return <div className="page-content"><div className="loading-panel">正在读取关怀记录…</div></div>;
  if (care.isError) return <div className="page-content"><div className="error-panel">{care.error.message}</div></div>;

  const data = care.data;
  const profile = data.profile;
  const groups: Array<{ key: CarePreference["groupName"]; label: string }> = [
    { key: "like", label: "喜欢" },
    { key: "dislike", label: "不太喜欢" },
    { key: "gift", label: "礼物线索" },
    { key: "other", label: "其他" }
  ];
  const needsProfile = !profile.name;

  return (
    <div className="page-content care-page">
      <div className="care-layout">
        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">RELATIONSHIP</span>
                <h2>关系概览</h2>
              </div>
              <button
                className="button secondary"
                onClick={() => setEditor({ kind: "profile" })}
                type="button"
              >
                {needsProfile ? "添加对象资料" : "编辑对象资料"}
              </button>
            </div>
            <div className="panel-body">
              {needsProfile ? (
                <EmptyState
                  title="还没有对象资料"
                  description="添加称呼和关系信息，之后可以逐步记录重要日期、趣事和小心愿。"
                  action={
                    <button className="button primary" onClick={() => setEditor({ kind: "profile" })} type="button">
                      开始记录
                    </button>
                  }
                />
              ) : (
                <div className="care-overview">
                  <div className="care-person">
                    <span className="care-avatar">{profile.name.slice(0, 1)}</span>
                    <strong>{profile.name}</strong>
                    <span>{profile.relationshipStage || "重要的人"}</span>
                    {profile.relationshipStart ? (
                      <span className="mini-badge">从 {formatShortDate(profile.relationshipStart)} 开始</span>
                    ) : null}
                    {profile.intro ? <p>{profile.intro}</p> : null}
                  </div>
                  <div className="care-main">
                    <div className="care-countdown">
                      <div>
                        <span>下一个重要日子</span>
                        <strong>{data.overview.nextDate?.name ?? "还没有重要日期"}</strong>
                        <span>
                          {data.overview.nextDate?.nextDate
                            ? formatShortDate(data.overview.nextDate.nextDate)
                            : "添加一个日期后会显示倒计时"}
                        </span>
                      </div>
                      <div className="care-days">
                        {data.overview.nextDate?.days !== null &&
                        data.overview.nextDate?.days !== undefined ? (
                          <>
                            <strong>{data.overview.nextDate.days}</strong>
                            <span>天后</span>
                          </>
                        ) : (
                          <Gift size={24} aria-hidden="true" />
                        )}
                      </div>
                    </div>
                    <div className="care-stats">
                      <div><span>重要日期</span><strong>{data.overview.dateCount}</strong></div>
                      <div><span>记录趣事</span><strong>{data.overview.storyCount}</strong></div>
                      <div><span>小心愿</span><strong>{data.wishes.length}</strong></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">MEMORIES</span>
                <h2>我们的趣事</h2>
              </div>
              <button className="button primary" onClick={() => setEditor({ kind: "story" })} type="button">
                <Plus size={15} aria-hidden="true" />
                记录趣事
              </button>
            </div>
            <div className="panel-body">
              {tags.length > 0 ? (
                <div className="filter-row">
                  <button className={`filter-chip${storyTag === "all" ? " active" : ""}`} onClick={() => setStoryTag("all")} type="button">全部</button>
                  {tags.map((tag) => (
                    <button className={`filter-chip${storyTag === tag ? " active" : ""}`} onClick={() => setStoryTag(tag)} type="button" key={tag}>{tag}</button>
                  ))}
                </div>
              ) : null}
              {visibleStories.length === 0 ? (
                <EmptyState title="还没有记录趣事" description="一起经历的小事、对话和意外，都值得留下来。" />
              ) : (
                <div className="story-list">
                  {visibleStories.map((story) => (
                    <article className="story-item" key={story.id}>
                      {story.photoUrl ? (
                        <img className="story-photo" src={story.photoUrl} alt={`趣事照片：${story.title}`} />
                      ) : (
                        <div className="story-date">
                          <strong>{formatShortDate(story.happenedOn)}</strong>
                          <span>{story.tag || "日常"}</span>
                        </div>
                      )}
                      <div className="story-copy">
                        <div className="story-title">
                          <strong>{story.title}</strong>
                          {story.tag ? <span className="mini-badge">{story.tag}</span> : null}
                        </div>
                        <p>{story.content}</p>
                        <div className="row-actions">
                          {story.location ? <span className="meta-text"><MapPin size={11} /> {story.location}</span> : null}
                          <button className="icon-text-button" aria-label={`编辑趣事：${story.title}`} onClick={() => setEditor({ kind: "story", item: story })} type="button"><Pencil size={13} /></button>
                          <button className="icon-text-button" aria-label={`删除趣事：${story.title}`} onClick={() => { setDeleteTarget({ kind: "story", id: story.id, title: story.title, hasPhoto: Boolean(story.photoPath) }); setDeletePhoto(false); }} type="button"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="detail-stack">
          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">DATES</span><h2>重要日子</h2></div>
              <button className="button secondary" onClick={() => setEditor({ kind: "date" })} type="button"><Plus size={14} />添加</button>
            </div>
            <div className="panel-body date-list">
              {data.dates.length === 0 ? (
                <EmptyState title="还没有重要日期" description="生日、纪念日和第一次见面都可以放在这里。" />
              ) : (
                data.dates.map((date) => (
                  <div className={`date-row${date.attention ? " attention" : ""}`} key={date.id}>
                    <span className="date-icon"><CalendarHeart size={15} /></span>
                    <div className="date-copy">
                      <strong>{date.name}</strong>
                      <span>{date.nextDate ? `${date.nextDate} · ${date.type}` : "日期已过去"}</span>
                    </div>
                    <span className="date-days">{date.days === null ? "—" : `${date.days} 天`}</span>
                    <button className="icon-text-button" aria-label={`编辑日期：${date.name}`} onClick={() => setEditor({ kind: "date", item: date })} type="button"><Pencil size={12} /></button>
                    <button className="icon-text-button" aria-label={`删除日期：${date.name}`} onClick={() => setDeleteTarget({ kind: "date", id: date.id, title: date.name })} type="button"><Trash2 size={12} /></button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">ABOUT</span><h2>关于 TA</h2></div>
              <button className="button secondary" onClick={() => setEditor({ kind: "preference" })} type="button"><Plus size={14} />补充</button>
            </div>
            <div className="panel-body preference-groups">
              {data.preferences.length === 0 ? (
                <EmptyState title="还不了解 TA 的偏好" description="记录喜欢、不喜欢和礼物线索。" />
              ) : (
                groups.map((group) => {
                  const items = data.preferences.filter((item) => item.groupName === group.key);
                  if (items.length === 0) return null;
                  return (
                    <div className="preference-group" key={group.key}>
                      <span>{group.label}</span>
                      <div className="preference-chips">
                        {items.map((item) => (
                          <span className={`preference-chip ${group.key}`} key={item.id}>
                            {item.content}
                            <button aria-label={`删除偏好：${item.content}`} onClick={() => setDeleteTarget({ kind: "preference", id: item.id, title: item.content })} type="button"><X size={10} /></button>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <div><span className="eyebrow">WISHES</span><h2>小心愿与礼物</h2></div>
              <button className="button secondary" onClick={() => setEditor({ kind: "wish" })} type="button"><Plus size={14} />添加</button>
            </div>
            <div className="panel-body wish-list">
              {data.wishes.length === 0 ? (
                <EmptyState title="还没有小心愿" description="记下想一起做的事，或者准备一份惊喜。" />
              ) : (
                data.wishes.map((wish) => (
                  <div className={`wish-row${wish.status === "completed" ? " completed" : ""}`} key={wish.id}>
                    <button className={`check-button${wish.status === "completed" ? " checked" : ""}`} aria-label={wish.status === "completed" ? "恢复小心愿" : "完成小心愿"} onClick={() => void toggleWish(wish)} type="button">{wish.status === "completed" ? <Check size={12} /> : null}</button>
                    <button className="wish-copy" onClick={() => setEditor({ kind: "wish", item: wish })} type="button">
                      <strong>{wish.title}</strong>
                      <span>{wish.targetDate ?? "没有目标日期"} · {wishStatusLabel(wish.status)}</span>
                    </button>
                    <button className="tiny-text-button" onClick={() => void addWishToToday(wish)} type="button">安排</button>
                    <button className="icon-text-button" aria-label={`删除小心愿：${wish.title}`} onClick={() => setDeleteTarget({ kind: "wish", id: wish.id, title: wish.title })} type="button"><Trash2 size={12} /></button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      <DetailDrawer
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
        title={editorTitle(editor)}
        description="所有内容会保存到当前电脑的本地文件"
      >
        {editor?.kind === "profile" ? <ProfileForm profile={profile} onSave={saveProfile} /> : null}
        {editor?.kind === "date" ? <DateForm item={editor.item} onSave={saveDate} /> : null}
        {editor?.kind === "story" ? <StoryForm item={editor.item} onSave={saveStory} /> : null}
        {editor?.kind === "preference" ? <PreferenceForm onSave={savePreference} /> : null}
        {editor?.kind === "wish" ? <WishForm item={editor.item} onSave={saveWish} /> : null}
      </DetailDrawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="确认删除这条记录？"
        description={
          deleteTarget?.kind === "wish"
            ? `“${deleteTarget.title}”删除后无法恢复。已加入今日计划的记录会保留标题快照并标记“来源已删除”。`
            : `“${deleteTarget?.title ?? ""}”删除后无法恢复。`
        }
        confirmLabel="删除"
        danger
        onConfirm={() => void confirmDelete()}
      >
        {deleteTarget?.hasPhoto ? (
          <label className="checkbox-row">
            <input checked={deletePhoto} onChange={(event) => setDeletePhoto(event.target.checked)} type="checkbox" />
            同时删除本地照片
          </label>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}

function ProfileForm({
  profile,
  onSave
}: {
  profile: CareProfile;
  onSave: (value: Omit<CareProfile, "id" | "updatedAt">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: profile.name,
    relationshipStage: profile.relationshipStage,
    relationshipStart: profile.relationshipStart ?? "",
    intro: profile.intro
  });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave({ ...form, relationshipStart: form.relationshipStart || null }); }}><label className="field"><span>称呼</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>关系阶段</span><input value={form.relationshipStage} onChange={(event) => setForm({ ...form, relationshipStage: event.target.value })} placeholder="例如：恋爱中" /></label><label className="field"><span>关系开始日期</span><input type="date" value={form.relationshipStart} onChange={(event) => setForm({ ...form, relationshipStart: event.target.value })} /></label><label className="field"><span>简短介绍</span><textarea value={form.intro} onChange={(event) => setForm({ ...form, intro: event.target.value })} /></label><button className="button primary" type="submit">保存资料</button></form>;
}

function DateForm({
  item,
  onSave
}: {
  item?: CareDate;
  onSave: (value: Omit<CareDate, "id" | "nextDate" | "days" | "attention">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    date: item?.date ?? localDateString(),
    type: item?.type ?? "anniversary",
    repeatsYearly: item?.repeatsYearly ?? true,
    leadDays: item?.leadDays ?? 7,
    notes: item?.notes ?? ""
  });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>日期名称</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label className="field"><span>日期</span><input required type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label><label className="field"><span>日期类型</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as typeof form.type })}><option value="birthday">生日</option><option value="anniversary">纪念日</option><option value="first_meet">第一次见面</option><option value="other">其他</option></select></label><label className="checkbox-row"><input checked={form.repeatsYearly} onChange={(event) => setForm({ ...form, repeatsYearly: event.target.checked })} type="checkbox" />每年重复</label><label className="field"><span>提前关注天数</span><input min={0} max={365} type="number" value={form.leadDays} onChange={(event) => setForm({ ...form, leadDays: Number(event.target.value) })} /></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存日期</button></form>;
}

function StoryForm({
  item,
  onSave
}: {
  item?: CareStory;
  onSave: (value: Omit<CareStory, "id" | "photoPath" | "photoOriginalName" | "photoMediaType" | "photoSize" | "photoUrl">, file: File | null) => Promise<void>;
}) {
  const [form, setForm] = useState({
    happenedOn: item?.happenedOn ?? localDateString(),
    title: item?.title ?? "",
    content: item?.content ?? "",
    location: item?.location ?? "",
    tag: item?.tag ?? ""
  });
  const [file, setFile] = useState<File | null>(null);
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form, file); }}><label className="field"><span>发生日期</span><input required type="date" value={form.happenedOn} onChange={(event) => setForm({ ...form, happenedOn: event.target.value })} /></label><label className="field"><span>标题</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>发生了什么</span><textarea required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label><label className="field"><span>地点</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label><label className="field"><span>场景标签</span><input value={form.tag} onChange={(event) => setForm({ ...form, tag: event.target.value })} placeholder="日常、旅行、纪念" /></label><label className="field"><span>照片（可选）</span><input accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /><small>{item?.photoUrl ? "已有照片，选择新照片会替换它" : "支持 JPEG、PNG、WebP，最大 10 MB"}</small></label><button className="button primary" type="submit"><Camera size={15} />保存趣事</button></form>;
}

function PreferenceForm({
  onSave
}: {
  onSave: (value: Pick<CarePreference, "groupName" | "content" | "notes">) => Promise<void>;
}) {
  const [form, setForm] = useState({ groupName: "like" as CarePreference["groupName"], content: "", notes: "" });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>分组</span><select value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value as CarePreference["groupName"] })}><option value="like">喜欢</option><option value="dislike">不太喜欢</option><option value="gift">礼物线索</option><option value="other">其他</option></select></label><label className="field"><span>内容</span><input required value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存偏好</button></form>;
}

function WishForm({
  item,
  onSave
}: {
  item?: CareWish;
  onSave: (value: Omit<CareWish, "id">) => Promise<void>;
}) {
  const [form, setForm] = useState({
    title: item?.title ?? "",
    type: item?.type ?? "wish",
    status: item?.status ?? "idea",
    budget: item?.budget ?? null,
    targetDate: item?.targetDate ?? null,
    notes: item?.notes ?? ""
  });
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}><label className="field"><span>心愿或礼物</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>类型</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CareWish["type"] })}><option value="wish">愿望</option><option value="gift">礼物</option><option value="date">约会计划</option><option value="other">其他</option></select></label><label className="field"><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as CareWish["status"] })}><option value="idea">想法</option><option value="planning">准备中</option><option value="completed">已完成</option></select></label><label className="field"><span>目标日期</span><input type="date" value={form.targetDate ?? ""} onChange={(event) => setForm({ ...form, targetDate: event.target.value || null })} /></label><label className="field"><span>预算（可选）</span><input min={0} step="0.01" type="number" value={form.budget ?? ""} onChange={(event) => setForm({ ...form, budget: event.target.value ? Number(event.target.value) : null })} /></label><label className="field"><span>备注</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><button className="button primary" type="submit">保存小心愿</button></form>;
}

function editorTitle(editor: Editor) {
  if (!editor) return "";
  const labels = { profile: "对象资料", date: "重要日期", story: "相处趣事", preference: "对象偏好", wish: "小心愿" };
  return `${editor.kind === "date" || editor.kind === "story" || editor.kind === "wish" ? (editor.item ? "编辑" : "添加") : "编辑"}${labels[editor.kind]}`;
}

function wishStatusLabel(status: CareWish["status"]) {
  return status === "idea" ? "想法" : status === "planning" ? "准备中" : "已完成";
}
