import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FlipHorizontal2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { courses, papers } from "../data";
import { go, PageFrame } from "../components/Layout";
import { downloadQuestionPaperPdf } from "../lib/questionPdf";
import {
  errorMessage,
  getPaperDownloadUrl,
  getDepartments,
  getFaculties,
  getMyPapers,
  getRepositoryPapers,
  getUniversities,
  deleteMyPaper,
  submitPaper,
  updateMyPaper,
  uploadFileProblem,
  uploadPaper,
  type Department,
  type Faculty,
  type University,
  type OwnedPaper,
  type UploadedPaper,
  type RepositoryPaper,
  type GeneratedSet,
} from "../lib/api";
import type { Course, Mode, Paper } from "../types";

export function PersonalPractice() {
  return (
    <PageFrame
      title="Study tools are in progress"
      subtitle="Flashcards and quizzes will be added once the course library is ready."
      back="dashboard"
    >
      <div className="grid place-items-center gap-7 rounded-14 border border-dashed border-ghost-border bg-ghost-surface p-30 text-center text-12 text-muted [&>strong]:text-15 [&>strong]:font-bold [&>strong]:text-ink"><Upload size={22} /><strong>Personal study workspace</strong><span>Bring your notes or PDFs here for private study.</span></div>
    </PageFrame>
  );
}

export function Hierarchy({
  onMaterial,
}: {
  onMaterial: (paper: RepositoryPaper) => void;
}) {
  const [paperRefresh, setPaperRefresh] = useState(0);
  return (
    <PageFrame
      eyebrow="Your learning library"
      title="Course repository"
      subtitle="Find course notes and past questions, or manage the PDFs you’ve shared."
      back="dashboard"
    >
      <div className="repository-page-flow">
        <RepositoryBrowser onMaterial={onMaterial} />
        <MyPapers refreshKey={paperRefresh} />
        <RepositoryUpload onUploaded={() => setPaperRefresh((value) => value + 1)} />
      </div>
    </PageFrame>
  );
}

function RepositoryBrowser({ onMaterial }: { onMaterial: (paper: RepositoryPaper) => void }) {
  const [search, setSearch] = useState(() => sessionStorage.getItem("recappedu_global_search") ?? "");
  const [level, setLevel] = useState("");
  const [universityId, setUniversityId] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [repositoryPapers, setRepositoryPapers] = useState<Awaited<ReturnType<typeof getRepositoryPapers>>["papers"]>([]);
  const [pages, setPages] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(false);
  useEffect(() => { sessionStorage.removeItem("recappedu_global_search"); }, []);
  useEffect(() => { getUniversities().then((result) => setUniversities(result.universities)).catch(() => setUniversities([])); }, []);
  useEffect(() => { setFaculties([]); setDepartments([]); setFacultyId(""); setDepartmentId(""); if (universityId) getFaculties(universityId).then((result) => setFaculties(result.faculties)).catch(() => setFaculties([])); }, [universityId]);
  useEffect(() => { setDepartments([]); setDepartmentId(""); if (facultyId) getDepartments(facultyId).then((result) => setDepartments(result.departments)).catch(() => setDepartments([])); }, [facultyId]);
  useEffect(() => { setLoading(true); getRepositoryPapers({ search, level, universityId, facultyId, departmentId, page: pages.page }).then((result) => { setRepositoryPapers(result.papers); setPages(result.pagination); }).catch(() => { setRepositoryPapers([]); setPages((current) => ({ ...current, total: 0, pages: 1 })); }).finally(() => setLoading(false)); }, [search, level, universityId, facultyId, departmentId, pages.page]);
  function resetPage() { setPages((current) => ({ ...current, page: 1 })); }
  return (
    <section className="repository-browser-panel" aria-label="Shared course library">
      <div className="repository-section-heading">
        <div>
          <span className="repository-eyebrow">Explore</span>
          <h2>Shared course library</h2>
          <p>Search by course, paper title, university, or level.</p>
        </div>
        <div className="repository-total"><strong>{pages.total}</strong><span>approved materials</span></div>
      </div>
      <div className="repository-searchbar">
        <Search size={18} aria-hidden="true" />
        <input aria-label="Search the course library" value={search} onChange={(event) => { setSearch(event.target.value); resetPage(); }} placeholder="Search by course code, PDF, or keyword" />
        {search && <button type="button" aria-label="Clear search" onClick={() => { setSearch(""); resetPage(); }}>Clear</button>}
      </div>
      <div className="repository-filter-heading"><strong>Refine results</strong><span>Filters work together</span></div>
      <div className="repository-filters">
        <label><span>Level</span><select value={level} onChange={(event) => { setLevel(event.target.value); resetPage(); }}><option value="">All levels</option><option>100 level</option><option>200 level</option><option>300 level</option><option>400 level</option><option>500 level</option></select></label>
        <label><span>University</span><select value={universityId} onChange={(event) => { setUniversityId(event.target.value); resetPage(); }}><option value="">All universities</option>{universities.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Faculty</span><select value={facultyId} disabled={!universityId} onChange={(event) => { setFacultyId(event.target.value); resetPage(); }}><option value="">All faculties</option>{faculties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label><span>Department</span><select value={departmentId} disabled={!facultyId} onChange={(event) => { setDepartmentId(event.target.value); resetPage(); }}><option value="">All departments</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      </div>
      <div className="repository-results-heading"><h3>Available materials</h3><span>{loading ? "Updating results…" : `${pages.total} ${pages.total === 1 ? "file" : "files"}`}</span></div>
      {loading ? (
        <div className="repository-loading"><span className="repository-spinner" /><strong>Finding course materials</strong><small>Applying your search and filters</small></div>
      ) : repositoryPapers.length ? (
        <>
          <div className="repository-material-grid">
            {repositoryPapers.map((paper) => (
              <article className="repository-paper-card" key={paper.id} tabIndex={0} role="button" onClick={() => onMaterial(paper)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onMaterial(paper); } }}>
                <div className="repository-paper-top"><span className="repository-paper-icon"><FileText size={17} /></span><span className="repository-level-badge">{paper.level}</span></div>
                <h3>{paper.course.code}</h3>
                <p className="repository-course-title">{paper.course.title}</p>
                <p className="repository-paper-description">{paper.description}</p>
                <div className="repository-paper-meta"><span>{paper.year}/{paper.session}</span><span>{paper.semester === "FIRST" ? "First" : "Second"} semester</span></div>
                <div className="repository-paper-open">View material details <ChevronRight size={15} /></div>
              </article>
            ))}
          </div>
          <div className="repository-pagination"><span>Page {pages.page} of {pages.pages}</span><div><button type="button" disabled={pages.page <= 1} onClick={() => setPages((current) => ({ ...current, page: current.page - 1 }))}><ArrowLeft size={14} /> Previous</button><button type="button" disabled={pages.page >= pages.pages} onClick={() => setPages((current) => ({ ...current, page: current.page + 1 }))}>Next <ArrowRight size={14} /></button></div></div>
        </>
      ) : (
        <div className="repository-empty"><FileText size={20} /><strong>No approved PDFs found</strong><span>Try broadening your search or clearing one of the filters.</span></div>
      )}
    </section>
  );
}

function MyPapers({ refreshKey }: { refreshKey: number }) {
  const [papers, setPapers] = useState<OwnedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmSubmit, setConfirmSubmit] = useState<string | null>(null);
  async function load() { setLoading(true); try { setPapers((await getMyPapers()).papers); } catch (reason) { setError(errorMessage(reason, "Could not load your uploads.")); } finally { setLoading(false); } }
  useEffect(() => { void load(); }, [refreshKey]);
  function startEdit(paper: OwnedPaper) { setEditing(paper.id); setForm({ description: paper.description, level: paper.level, session: paper.session, year: String(paper.year), semester: paper.semester }); setMessage(""); setError(""); }
  async function save(paperId: string) { setBusy(paperId); setError(""); try { const result = await updateMyPaper(paperId, { ...form, year: Number(form.year) }); setPapers((current) => current.map((paper) => paper.id === paperId ? result.paper : paper)); setEditing(null); setMessage("Study file details saved."); } catch (reason) { setError(errorMessage(reason, "Could not save file details.")); } finally { setBusy(""); } }
  async function remove(paperId: string) { if (!window.confirm("Delete this private PDF?")) return; setBusy(paperId); setError(""); try { await deleteMyPaper(paperId); setPapers((current) => current.filter((paper) => paper.id !== paperId)); setMessage("PDF deleted."); } catch (reason) { setError(errorMessage(reason, "Could not delete PDF.")); } finally { setBusy(""); } }
  async function submit(paperId: string) { setConfirmSubmit(null); setBusy(paperId); setError(""); try { const result = await submitPaper(paperId); setPapers((current) => current.map((paper) => paper.id === paperId ? result.paper : paper)); setMessage("PDF submitted for review."); } catch (reason) { setError(errorMessage(reason, "Could not submit PDF.")); } finally { setBusy(""); } }
  return <section className="grid max-w-860 gap-14 rounded-13 border border-[#dbeafe] bg-[#f8fbff] p-20">{confirmSubmit && <SubmitConfirmDialog onCancel={() => setConfirmSubmit(null)} onConfirm={() => { if (confirmSubmit) void submit(confirmSubmit); }} />}<div className="flex items-center justify-between gap-18 max-760:items-stretch max-760:flex-col [&_h2]:mb-6 [&_h2]:mt-2 [&_h2]:text-19 [&_h2]:font-bold [&_h2]:text-ink"><div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Your uploads</p><h2>Your uploads</h2><p>Track private PDFs, resubmit rejected files, or update details before review.</p></div><span className="admin-status">{papers.length} PDFs</span></div>{loading ? <div className="repository-empty">Loading your uploads...</div> : papers.length === 0 ? <div className="repository-empty"><FileText size={20} /><strong>No uploads yet</strong><span>Your private PDFs will appear here after upload.</span></div> : <div className="grid gap-10">{papers.map((paper) => <article className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-14 rounded-12 border border-line bg-white p-15 max-760:grid-cols-1 max-760:items-stretch" key={paper.id}><div className="grid min-w-0 gap-4 [&>strong]:truncate [&>strong]:text-13 [&>strong]:text-ink [&>span]:text-10 [&>span]:text-muted [&>small]:text-10 [&>small]:leading-[1.45] [&>small]:text-muted"><strong>{paper.course.code} · {paper.course.title}</strong><span>{paper.level} · {paper.year}/{paper.session} · {paper.semester === "FIRST" ? "First" : "Second"} semester</span><small>{paper.description}</small></div><span className={`badge ${paper.status === "APPROVED" ? "active" : paper.status === "REJECTED" ? "text-danger bg-red-100" : "empty"}`}>{paper.status}</span><div className="flex flex-wrap justify-end gap-6 max-760:justify-start"><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" onClick={() => go(`generate/${paper.course.id}`)}><Sparkles size={14} /> Create practice set</button>{(paper.status === "DRAFT" || paper.status === "REJECTED") && <><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" disabled={busy === paper.id} onClick={() => startEdit(paper)}><Pencil size={14} /> Edit</button><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" disabled={busy === paper.id} onClick={() => void remove(paper.id)}><Trash2 size={14} /> Delete</button><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={busy === paper.id} onClick={() => setConfirmSubmit(paper.id)}><Send size={14} /> Submit</button></>}</div>{editing === paper.id && <div className="col-span-full grid gap-9 border-t border-line pt-12 [&>textarea]:min-h-60 [&>textarea]:resize-y"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /><div className="grid grid-cols-4 gap-8 max-760:grid-cols-1 [&>input]:min-h-38 [&>input]:rounded-8 [&>input]:border [&>input]:border-line [&>input]:bg-white [&>input]:px-10 [&>input]:py-9 [&>input]:text-11 [&>select]:min-h-38 [&>select]:rounded-8 [&>select]:border [&>select]:border-line [&>select]:bg-white [&>select]:px-10 [&>select]:py-9 [&>select]:text-11"><input value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })} placeholder="Level" /><input value={form.session} onChange={(event) => setForm({ ...form, session: event.target.value })} placeholder="Session" /><input type="number" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} placeholder="Year" /><select value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value as "FIRST" | "SECOND" })}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></div><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={busy === paper.id} onClick={() => void save(paper.id)}><Check size={14} /> Save changes</button><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" onClick={() => setEditing(null)}>Cancel</button></div>}</article>)}</div>}{message && <small className="text-success-deep">{message}</small>}{error && <small className="text-danger">{error}</small>}</section>;
}

export function MaterialDetails({ paper }: { paper: RepositoryPaper }) {
  const [error, setError] = useState("");
  async function download() {
    try { const result = await getPaperDownloadUrl(paper.id); window.open(result.url, "_blank", "noopener,noreferrer"); }
    catch (reason) { setError(errorMessage(reason, "Could not download this material.")); }
  }
  return <PageFrame eyebrow="Repository material" title={`${paper.course.code} · ${paper.course.title}`} subtitle="Material details and download"><div className="grid max-w-560 gap-18 rounded-13 border border-line bg-white p-20 [&_dl]:m-0 [&_dl]:grid [&_dl]:gap-14 [&_dl>div]:grid [&_dl>div]:gap-4 [&_dl>div]:border-b [&_dl>div]:border-panel-line [&_dl>div]:pb-12 [&_dt]:text-10 [&_dt]:font-bold [&_dt]:uppercase [&_dt]:text-slate-icon [&_dd]:m-0 [&_dd]:text-13 [&_dd]:leading-[1.5] [&_dd]:text-ink"><div className="grid size-52 place-items-center rounded-12 bg-pale text-brand"><FileText size={26} /></div><dl><div><dt>Level</dt><dd>{paper.level}</dd></div><div><dt>Academic session</dt><dd>{paper.year}/{paper.session}</dd></div><div><dt>Semester</dt><dd>{paper.semester === "FIRST" ? "First" : "Second"} semester</dd></div><div><dt>Description</dt><dd>{paper.description}</dd></div></dl><div className="flex flex-wrap gap-9"><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => void download()}><FileText size={15} /> Download material</button><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" onClick={() => go(`generate/${paper.course.id}`)}><Sparkles size={15} /> Create practice set</button></div>{error && <small className="text-danger">{error}</small>}</div></PageFrame>;
}

function RepositoryUpload({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form, setForm] = useState({ universityName: "", facultyName: "", courseTitle: "", courseCode: "", description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [uploadedPaper, setUploadedPaper] = useState<UploadedPaper | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
    setMessage("");
  }

  async function upload() {
    if (!selectedFile) return;
    // Caught here too so no code path can start an upload the API will refuse
    // mid-transfer (oversize files are reported as a bare "Failed to fetch" on
    // mobile — see uploadFileProblem in lib/api.ts).
    const problem = uploadFileProblem(selectedFile);
    if (problem) { setError(problem); return }
    setBusy(true);
    setError("");
    try {
      const result = await uploadPaper({ file: selectedFile, ...form });
      setUploadedPaper(result.paper);
      onUploaded();
      setMessage("Paper uploaded privately. Submit it for repository review below.");
    } catch (reason) {
      setError(errorMessage(reason, "Could not upload the file."));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!uploadedPaper) return;
    setConfirming(false);
    setBusy(true);
    setError("");
    try {
      const result = await submitPaper(uploadedPaper.id);
      setUploadedPaper(result.paper);
      setMessage("Submitted. An admin must approve it before it appears in the repository.");
    } catch (reason) {
      setError(errorMessage(reason, "Could not submit the PDF."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="max-w-860 rounded-14 border border-[#dbeafe] bg-[#f8fbff] p-20">
      {confirming && <SubmitConfirmDialog onCancel={() => setConfirming(false)} onConfirm={() => void submit()} />}
      <div className="flex items-center justify-between gap-18 max-760:items-stretch max-760:flex-col [&_h2]:mb-6 [&_h2]:mt-2 [&_h2]:text-19 [&_h2]:font-bold [&_h2]:text-ink">
        <div><p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Contribute to the repository</p><h2>Have notes or an exam PDF?</h2><p>Upload a PDF or Word document and submit it for review. Approved PDFs become visible to other students.</p></div>
        <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => setOpen(!open)}><Upload size={15} /> {open ? "Close upload form" : "Upload a PDF"}</button>
      </div>
      {open && <div className="my-14 mb-20 rounded-14 border border-[#dbeafe] bg-[#f8fbff] p-20 [&>h3]:mb-6 [&>h3]:mt-0 [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:mb-17 [&>p]:mt-0 [&>p]:text-11 [&>p]:leading-[1.5] [&>p]:text-muted [&_.field]:mb-13 [&_.field]:grid [&_.field]:gap-7 [&_.field]:text-11 [&_.field]:font-bold [&_.field]:text-muted [&_input]:min-h-41 [&_input]:w-full [&_input]:rounded-9 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-10 [&_input]:text-11 [&_input]:font-normal [&_input]:text-ink [&_input]:outline-none [&_select]:min-h-41 [&_select]:w-full [&_select]:rounded-9 [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-10 [&_select]:text-11 [&_select]:font-normal [&_select]:text-ink [&_select]:outline-none [&_textarea]:min-h-70 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-9 [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-white [&_textarea]:p-10 [&_textarea]:text-11 [&_textarea]:text-ink [&_textarea]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_select:focus]:border-outline [&_select:focus]:shadow-focus [&_textarea:focus]:border-outline [&_textarea:focus]:shadow-focus">
        <h3>Upload a PDF to the course library</h3>
        <p>Your upload stays private until you submit it and an admin approves it.</p>
        <div className="mb-13 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] justify-start gap-9">
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>University name</span><input value={form.universityName} onChange={(event) => updateField("universityName", event.target.value)} placeholder="e.g. Federal University of Technology Minna" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Faculty name</span><input value={form.facultyName} onChange={(event) => updateField("facultyName", event.target.value)} placeholder="e.g. Computing" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Course name</span><input value={form.courseTitle} onChange={(event) => updateField("courseTitle", event.target.value)} placeholder="e.g. Human Computer Interaction" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Course code</span><input value={form.courseCode} onChange={(event) => updateField("courseCode", event.target.value)} placeholder="e.g. CPT 412" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>PDF or Word file</span><input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setSelectedFile(event.target.files?.[0] || null)} /></label>
        </div>
        <div className="mb-13 grid grid-cols-[repeat(auto-fit,minmax(150px,200px))] justify-start gap-9">
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Level</span><select value={form.level} onChange={(event) => updateField("level", event.target.value)}><option value="">Choose level</option>{[100, 200, 300, 400, 500].map((value) => <option key={value}>{value} level</option>)}</select></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Session</span><input value={form.session} onChange={(event) => updateField("session", event.target.value)} placeholder="2024/2025" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Year</span><input type="number" value={form.year} onChange={(event) => updateField("year", event.target.value)} placeholder="2024" /></label>
          <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Semester</span><select value={form.semester} onChange={(event) => updateField("semester", event.target.value as "FIRST" | "SECOND")}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></label>
        </div>
        <label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Description</span><textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} placeholder="Describe this PDF so students can find it in the course library." /></label>
        <div className="mt-6 flex flex-wrap gap-9"><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={busy || Boolean(uploadedPaper) || !selectedFile || uploadFileProblem(selectedFile) !== null || !form.universityName.trim() || !form.facultyName.trim() || !form.courseTitle.trim() || !form.courseCode.trim() || !form.description.trim() || !form.level || !form.session.trim() || !form.year} onClick={() => void upload()}><Upload size={15} /> {busy ? "Uploading..." : "Upload PDF"}</button>{uploadedPaper && <button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" disabled={busy || confirming || uploadedPaper.status === "PENDING"} onClick={() => setConfirming(true)}><Send size={14} /> {uploadedPaper.status === "PENDING" ? "Pending review" : "Submit for review"}</button>}</div>
        {message && <small className="text-success-deep">{message}</small>}
        {error && <small className="text-danger">{error}</small>}
      </div>}
    </section>
  );
}

export function CourseSelection({
  onCourse,
}: {
  onCourse: (course: Course) => void;
}) {
  const [search, setSearch] = useState("");
  const visible = courses.filter((course) =>
    `${course.code} ${course.title}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <PageFrame
      eyebrow="FUT Minna · Computing · Cyber Security"
      title="Choose a course"
      subtitle="Your courses will appear here after they are added."
      back="hierarchy"
    >
      <div className="mb-14 flex min-h-44 max-w-460 items-center gap-8 rounded-10 border border-line bg-white px-12 text-muted">
        <Search size={16} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search course code or title"
        />
      </div>
      <div className="grid gap-9">
        {visible.length ? visible.map((course) => (
          <button
            className="flex w-full items-center justify-between gap-15 rounded-13 border border-line bg-white px-17 py-16 text-left transition-colors hover:border-outline [&_strong]:block [&_strong]:font-grotesk [&_strong]:text-14 [&_strong]:font-bold [&_span]:block [&_div>span]:mt-3 [&_div>span]:text-12 [&_div>span]:text-muted"
            key={course.code}
            onClick={() => onCourse(course)}
          >
            <div>
              <strong>{course.code}</strong>
              <span>{course.title}</span>
            </div>
            <div className="flex items-center gap-11">
              <span className={`badge ${course.papers ? "active" : "empty"}`}>
                {course.papers ? `${course.papers} PDFs` : "No PDFs yet"}
              </span>
              <ChevronRight size={18} />
            </div>
          </button>
        )) : <div className="repository-empty"><BookOpen size={20} /><strong>No course added yet</strong><span>Browse the course library for PDFs or add a course.</span><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={() => go("hierarchy")}>Browse PDFs</button></div>}
      </div>
    </PageFrame>
  );
}

export function CoursePage({
  course,
  uploaded,
  onUpload,
}: {
  course: Course;
  uploaded: boolean;
  onUpload: () => void;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedPaper, setUploadedPaper] = useState<UploadedPaper | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploadForm, setUploadForm] = useState({ title: "", description: "", level: "", session: "", year: "", semester: "FIRST" as "FIRST" | "SECOND" });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  async function submitForReview(paperId: string) {
    setConfirming(false);
    setSubmitting(true);
    try { const result = await submitPaper(paperId); setUploadedPaper(result.paper); setUploadMessage("Submitted for admin review."); }
    catch (reason) { setUploadError(errorMessage(reason, "Could not submit PDF.")); }
    finally { setSubmitting(false); }
  }
  const list = uploadedPaper
    ? [
        papers[0],
        {
          id: uploadedPaper.id,
          title: `${course.code} · ${course.title}`,
          detail: `${uploadedPaper.level} · ${uploadedPaper.year}/${uploadedPaper.session} · ${uploadedPaper.status === "PENDING" ? "Pending review" : "Private upload"}`,
          status: uploadedPaper.status === "PENDING" ? "Pending" : "Private",
        },
        ...papers.slice(1),
      ]
    : papers;
  return (
    <PageFrame
      eyebrow="Cyber Security / Course workspace"
      title={course.title}
      subtitle={`${course.papers} PDFs in the shared course library · ${uploaded ? 4 : 3} uploaded by you`}
      back="dashboard"
    >
      {confirming && uploadedPaper && <SubmitConfirmDialog onCancel={() => setConfirming(false)} onConfirm={() => void submitForReview(uploadedPaper.id)} />}
      <div className="mb-16 flex gap-6 rounded-12 border border-line bg-white p-5 [&>button]:rounded-8 [&>button]:px-14 [&>button]:py-8 [&>button]:text-12 [&>button]:font-semibold [&>button]:text-muted [&>button:hover]:bg-pale [&>button:hover]:text-brand [&>button.active]:bg-pale [&>button.active]:text-brand">
        <button className="active">Repository & uploads</button>
        <button>My generated sets</button>
      </div>
      <label className="flex min-h-49 w-full cursor-pointer flex-wrap items-center justify-center gap-8 rounded-11 border-[1.5px] border-dashed border-outline bg-[#f8fbff] text-12 font-bold text-brand [&>small]:text-10 [&>small]:font-normal [&>small]:text-slate-icon [&>input]:min-w-0 [&>input]:max-w-full [&>input]:text-11 [&>input]:font-normal">
        <Upload size={17} />
        <span>{selectedFile?.name || "Choose notes or an exam PDF"}</span>
        <small>Upload privately first, then submit it for admin review.</small>
        <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => { const file = event.target.files?.[0] || null; setSelectedFile(file); setUploadError(file ? uploadFileProblem(file) ?? "" : ""); setUploadMessage(""); }} />
      </label>
      {selectedFile && !uploadedPaper && <div className="my-14 mb-20 rounded-14 border border-[#dbeafe] bg-[#f8fbff] p-20 [&>h3]:mb-6 [&>h3]:mt-0 [&>h3]:text-17 [&>h3]:font-bold [&>h3]:text-ink [&>p]:mb-17 [&>p]:mt-0 [&>p]:text-11 [&>p]:leading-[1.5] [&>p]:text-muted [&_.field]:mb-13 [&_.field]:grid [&_.field]:gap-7 [&_.field]:text-11 [&_.field]:font-bold [&_.field]:text-muted [&_input]:min-h-41 [&_input]:w-full [&_input]:rounded-9 [&_input]:border [&_input]:border-line [&_input]:bg-white [&_input]:px-10 [&_input]:text-11 [&_input]:font-normal [&_input]:text-ink [&_input]:outline-none [&_select]:min-h-41 [&_select]:w-full [&_select]:rounded-9 [&_select]:border [&_select]:border-line [&_select]:bg-white [&_select]:px-10 [&_select]:text-11 [&_select]:font-normal [&_select]:text-ink [&_select]:outline-none [&_textarea]:min-h-70 [&_textarea]:w-full [&_textarea]:resize-y [&_textarea]:rounded-9 [&_textarea]:border [&_textarea]:border-line [&_textarea]:bg-white [&_textarea]:p-10 [&_textarea]:text-11 [&_textarea]:text-ink [&_textarea]:outline-none [&_input:focus]:border-outline [&_input:focus]:shadow-focus [&_select:focus]:border-outline [&_select:focus]:shadow-focus [&_textarea:focus]:border-outline [&_textarea:focus]:shadow-focus"><h3>Describe this study file</h3><p>These details help students find the right PDF and help admins review contributions.</p><div className="mb-13 grid grid-cols-[repeat(auto-fit,minmax(150px,200px))] justify-start gap-9"><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>PDF name</span><input value={uploadForm.title} onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })} placeholder="e.g. CPT 412 First semester exam" /></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Level</span><select value={uploadForm.level} onChange={(event) => setUploadForm({ ...uploadForm, level: event.target.value })}><option value="">Choose level</option>{[100, 200, 300, 400, 500].map((value) => <option key={value}>{value} level</option>)}</select></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Session</span><input value={uploadForm.session} onChange={(event) => setUploadForm({ ...uploadForm, session: event.target.value })} placeholder="2024/2025" /></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Year</span><input type="number" value={uploadForm.year} onChange={(event) => setUploadForm({ ...uploadForm, year: event.target.value })} placeholder="2024" /></label><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Semester</span><select value={uploadForm.semester} onChange={(event) => setUploadForm({ ...uploadForm, semester: event.target.value as "FIRST" | "SECOND" })}><option value="FIRST">First semester</option><option value="SECOND">Second semester</option></select></label></div><label className="field mb-21 grid gap-7 text-12 font-semibold text-muted [&>span]:mb-8 [&>span]:block"><span>Description</span><textarea value={uploadForm.description} onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })} placeholder="Briefly describe what these notes or this PDF cover." /></label><button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" disabled={uploading || !course.id || !uploadForm.title.trim() || !uploadForm.description.trim() || !uploadForm.level || !uploadForm.session.trim() || !uploadForm.year} onClick={() => { if (!selectedFile || !course.id) return; const fileProblem = uploadFileProblem(selectedFile); if (fileProblem) { setUploadError(fileProblem); return } setUploading(true); setUploadError(""); void uploadPaper({ file: selectedFile, courseId: course.id, ...uploadForm }).then((result) => { setUploadedPaper(result.paper); onUpload(); setUploadMessage("PDF saved privately. You can submit it for review."); }).catch((reason) => setUploadError(errorMessage(reason, "Could not upload PDF."))).finally(() => setUploading(false)); }}>{uploading ? "Uploading..." : "Upload privately"} <Upload size={15} /></button>{!course.id && <small className="mt-10 block text-10 text-warning">This demo course is not connected to a database course yet.</small>}{uploadMessage && <div className="mt-12 flex items-center gap-8 rounded-10 bg-success-soft px-14 py-11 text-11 text-success-deep"><Check size={16} /> {uploadMessage}</div>}{uploadError && <div className="profile-feedback error">{uploadError}</div>}</div>}
      <div className="grid gap-9">
        {list.map((paper) => (
          <article className="flex items-center justify-between gap-12 rounded-12 border border-line bg-white p-15 transition-colors hover:border-outline max-760:flex-col max-760:items-start" key={paper.id}>
            <div className="grid size-34 shrink-0 place-items-center rounded-10 bg-pale text-brand">
              <FileText size={17} />
            </div>
            <div className="grid min-w-0 gap-4 [&>strong]:truncate [&>strong]:text-13 [&>strong]:text-ink [&>span]:text-10 [&>span]:text-muted [&>small]:text-10 [&>small]:leading-[1.45] [&>small]:text-muted">
              <strong>{paper.title}</strong>
              <span>{paper.detail}</span>
            </div>
            <div className="flex flex-wrap items-center gap-8">
                <PaperActions paperId={paper.id} />
              {paper.id === uploadedPaper?.id && paper.status === "Private" ? (
                <button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" disabled={submitting || confirming} onClick={() => setConfirming(true)}>
                  <Send size={14} /> {submitting ? "Submitting..." : "Submit for review"}
                </button>
              ) : (
                <span className="badge active">{paper.status}</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </PageFrame>
  );
}

function PaperActions({ paperId }: { paperId: string }) {
  const [message, setMessage] = useState("");
  async function download() { try { const result = await getPaperDownloadUrl(paperId); window.open(result.url, "_blank", "noopener,noreferrer"); } catch (error) { setMessage(errorMessage(error, "Could not open PDF.")); } }
  async function share() { try { const result = await getPaperDownloadUrl(paperId); if (navigator.share) await navigator.share({ title: "RecappEdu study PDF", url: result.url }); else { await navigator.clipboard.writeText(result.url); setMessage("PDF link copied."); } } catch (error) { if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(errorMessage(error, "Could not share PDF.")); } }
  return <div className="flex flex-wrap items-center gap-8"><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" onClick={() => void download()}>Download PDF</button><button className="inline-flex min-h-36 items-center justify-center gap-6 rounded-9 border border-line bg-white px-12 text-12 font-semibold text-muted transition-colors duration-200 hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-50" onClick={() => void share()}><Share2 size={14} /> Share</button>{message && <small className="text-11 text-muted">{message}</small>}</div>;
}
function SubmitConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-[#0f172a66] p-20">
      <div className="relative w-full max-w-[440px] rounded-17 bg-white p-26 shadow-[0_25px_60px_rgba(15,23,42,.2)] [&>h2]:mb-9 [&>h2]:mt-6 [&>h2]:text-[22px] [&>h2]:font-bold [&>p:not(.eyebrow)]:m-0 [&>p:not(.eyebrow)]:text-12 [&>p:not(.eyebrow)]:leading-160 [&>p:not(.eyebrow)]:text-muted">
        <p className="eyebrow mb-17 flex items-center gap-8 text-10 font-bold uppercase tracking-[.13em] text-brand">Before you submit</p>
        <h2>Share this PDF with your course?</h2>
        <p>Once approved, this PDF will be visible to every student in the repository with your name linked to it. Approved PDFs stay visible, so read your details carefully before submitting.</p>
        <div className="mt-20 flex justify-end gap-9">
          <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={onCancel}>Not yet</button>
          <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={onConfirm}>Yes, submit for review</button>
        </div>
      </div>
    </div>
  );
}

export function Generate({
  course,
  paper,
  mode,
  length,
  onMode,
  onLength,
  onGenerate,
}: {
  course: Course;
  paper: Paper;
  mode: Mode;
  length: string;
  onMode: (mode: Mode) => void;
  onLength: (length: string) => void;
  onGenerate: () => void;
}) {
  return (
    <PageFrame
      title="What do you want to create?"
      subtitle="AI will generate a set from this study material's questions."
      back="course"
    >
      <section className="practice-material-card" aria-label="Selected course material">
        <div className="practice-material-icon"><FileText size={18} /></div>
        <div className="practice-material-copy">
          <span className="practice-material-eyebrow">PRACTICE MATERIAL</span>
          <strong className="practice-material-title">{paper.title}</strong>
          <span className="practice-material-course"><b>{course.code}</b><span aria-hidden="true">·</span>{course.title}</span>
        </div>
        <span className="practice-material-badge">Selected</span>
      </section>
      <div className="choice-grid">
        {(
          [
            [
              "flashcards",
              "Flashcards",
              "Flip through key questions and answers at your pace",
              FlipHorizontal2,
            ],
            [
              "quiz",
              "Quiz",
              "Timed multiple-choice practice with a score at the end",
              Check,
            ],
          ] as const
        ).map(([value, title, description, Icon]) => (
          <button
            className={`mode-choice ${mode === value ? "selected" : ""}`}
            key={value}
            onClick={() => onMode(value)}
          >
            <span className="choice-icon">
              <Icon size={19} />
            </span>
            <strong>{title}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="length-control" role="group" aria-label="Choose set length">
        <div className="length-heading"><label>Set length</label><span>Choose how many cards to practise</span></div>
        <div className="lengths">
          {["15", "30", "60", "All"].map((option) => (
            <button
              className={`length-option ${length === option ? "selected" : ""}`}
              key={option}
              type="button"
              aria-pressed={length === option}
              onClick={() => onLength(option)}
            >
              <strong>{option}</strong><small>{option === "All" ? "Available" : "cards"}</small>
            </button>
          ))}
        </div>
      </div>
      <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none full" onClick={onGenerate}>
        <Sparkles size={16} /> Create {mode}
      </button>
    </PageFrame>
  );
}

function PlayerFrame({
  children,
  count,
  onExit,
}: {
  children: React.ReactNode;
  count: string;
  onExit: () => void;
}) {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-800 content-center px-[clamp(18px,3vw,32px)] pt-30 pb-52 max-680:min-w-0 max-680:px-18">
      <div className="mb-16 flex max-w-800 items-center justify-between text-11 font-semibold text-muted">
        <button
          className="grid size-46 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-outline hover:text-brand disabled:cursor-default disabled:opacity-40"
          onClick={onExit}
          aria-label="Exit practice"
        >
          <X size={16} />
        </button>
        <span>{count}</span>
        <Sparkles size={15} className="text-brand" />
      </div>
      <div className="quiz-progress-track mb-26 h-5 max-w-800 overflow-hidden rounded-full bg-[#e7edf6]">
        <span className="block h-full w-[34%] rounded-full bg-brand" />
      </div>
      {children}
    </main>
  );
}
export function QuestionPaper({ set, onBack }: { set: GeneratedSet; onBack: () => void }) {
  return (
    <PageFrame eyebrow="Generated question paper" title={set.title} subtitle="Review every question and answer choice at your own pace. This page does not start a quiz or record answers.">
      <div className="question-paper-actions mb-18 flex flex-wrap items-center justify-between gap-10 rounded-13 border border-line bg-white/55 p-14">
        <span className="text-11 font-semibold text-muted">{set.items.length} questions · ready to save or print</span>
        <div className="flex flex-wrap gap-8">
          <button type="button" className="secondary-button inline-flex min-h-40 items-center justify-center gap-7 rounded-9 border border-line bg-white px-14 text-12 font-bold text-brand" onClick={onBack}><ArrowLeft size={14} /> Back</button>
          <button type="button" className="primary-button inline-flex min-h-40 items-center justify-center gap-7 rounded-9 px-14 text-12 font-bold text-white" onClick={() => downloadQuestionPaperPdf(set.title, set)}><Download size={15} /> Save as PDF</button>
        </div>
      </div>
      <ol className="question-paper-list">
        {set.items.map((item, index) => {
          const question = item.question;
          const options = Array.isArray(question.metadata?.options) ? question.metadata.options : [];
          return (
            <li className="question-paper-item" key={`${index}-${question.prompt}`}>
              <span className="question-paper-number">{String(index + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <h2>{question.prompt}</h2>
                {options.length > 0 && <ol className="question-paper-options">{options.map((option, optionIndex) => <li key={`${optionIndex}-${option}`}><span>{String.fromCharCode(65 + optionIndex)}</span>{option}</li>)}</ol>}
              </div>
            </li>
          );
        })}
      </ol>
    </PageFrame>
  );
}

export function Flashcards({
  set,
  onExit,
  onQuiz,
}: {
  set: GeneratedSet;
  onExit: () => void;
  onQuiz?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const total = set.items.length;
  const card = total > 0 ? set.items[index]?.question : undefined;
  return (
    <PlayerFrame count={`Card ${Math.min(index + 1, Math.max(total, 1))} of ${total}`} onExit={onExit}>
      {card ? (
        <button className="flashcard-surface flex min-h-[320px] w-full cursor-pointer flex-col items-center justify-center gap-16 rounded-20 border border-line bg-white px-26 py-32 text-ink shadow-[0_20px_36px_rgba(15,23,42,.06)] transition-shadow hover:shadow-[0_24px_42px_rgba(15,23,42,.09)] max-680:min-h-[240px] max-680:px-16 max-680:py-20" onClick={() => setFlipped(!flipped)}>
          <div className="flashcard-content grid justify-items-center gap-16" key={`${index}-${flipped ? "answer" : "question"}`}>
            <span className="rounded-999 bg-pale px-10 py-4 text-10 font-bold uppercase text-brand">{flipped ? "Answer" : "Question"}</span>
            <strong className="max-w-full whitespace-pre-wrap text-[19px] font-bold leading-[1.5] [overflow-wrap:anywhere]">{flipped ? card.answer : card.prompt}</strong>
            {flipped && card.explanation && <p className="max-w-420 text-12 leading-160 text-slate-700 max-680:max-w-full">{card.explanation}</p>}
            <small className="inline-flex items-center gap-6 text-11 text-muted">
              <RotateCcw size={14} /> Tap to {flipped ? "see question" : "reveal answer"}
            </small>
          </div>
        </button>
      ) : (
        <div className="grid min-h-[320px] w-full place-items-center rounded-20 border border-dashed border-[#bfdbfe] bg-[#f8fbff] text-12 text-muted">This set has no cards yet.</div>
      )}
      <div className="mt-22 flex items-center justify-center gap-12">
        <button
          className="icon-button"
          disabled={index === 0 || total === 0}
          onClick={() => {
            setIndex(index - 1);
            setFlipped(false);
          }}
        >
          <ArrowLeft size={17} />
        </button>
        <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" disabled={total === 0} onClick={() => setFlipped(!flipped)}>
          <FlipHorizontal2 size={15} /> Flip card
        </button>
        <button
          className="icon-button"
          disabled={index === total - 1 || total === 0}
          onClick={() => {
            setIndex(index + 1);
            setFlipped(false);
          }}
        >
          <ArrowRight size={17} />
        </button>
      </div>
      {onQuiz && (
        <button className="mt-22 inline-flex items-center gap-6 border-0 bg-transparent text-12 font-semibold text-brand" onClick={onQuiz}>
          Try this as a quiz <ArrowRight size={14} />
        </button>
      )}
    </PlayerFrame>
  );
}
export function Quiz({
  set,
  onExit,
  onCreateNew,
  onFinish,
}: {
  set: GeneratedSet;
  onExit: () => void;
  onCreateNew: () => void;
  onFinish: (score: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(set.timePerQuestion ?? 30);
  const total = set.items.length;
  const item = set.items[index]?.question;
  const options = Array.isArray(item?.metadata?.options) ? item.metadata.options : [];
  const seconds = set.timePerQuestion ?? 30;

  useEffect(() => {
    setTimeLeft(seconds);
    setSelected(null);
    setRevealed(false);
    const timer = window.setInterval(() => setTimeLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [index, seconds]);

  useEffect(() => {
    if (timeLeft === 0 && !revealed) setRevealed(true);
  }, [timeLeft, revealed]);

  function choose(option: string) {
    if (revealed || !item) return;
    setSelected(option);
    setRevealed(true);
    if (option === item.answer) setScore((current) => current + 1);
  }

  function next() {
    if (index === total - 1) {
      onFinish(score, total);
      return;
    }
    setIndex((current) => current + 1);
  }

  return (
    <PlayerFrame count={`Question ${Math.min(index + 1, Math.max(total, 1))} of ${total}`} onExit={onExit}>
      <div className="flex items-center justify-between gap-10 text-11 font-semibold text-muted max-680:items-start">
        <span className="min-w-0 truncate">{set.title}</span>
        <button className="quiz-create-new inline-flex shrink-0 items-center gap-6 rounded-9 border border-line px-10 py-7 text-10 font-bold text-brand transition-colors hover:border-brand" onClick={onCreateNew}>
          <Plus size={14} /> Create new quiz
        </button>
      </div>
      <div className="mt-8 flex justify-end text-11 font-semibold text-muted">
        <span className="inline-flex items-center gap-5">
          <Clock3 size={14} /> {timeLeft}s
        </span>
      </div>
      <p className="mt-20 inline-flex items-center gap-6 text-11 font-bold uppercase text-brand">Question {index + 1}</p>
      <h2 className="my-8 mb-22 text-[23px] font-bold leading-[1.45] text-ink max-680:text-18">{item?.prompt}</h2>
      <div className="grid items-stretch gap-10">
        {options.map((answer, optionIndex) => {
          const state = !revealed
            ? selected === answer ? "selected" : ""
            : answer === item?.answer ? "correct" : selected === answer ? "wrong" : "";
          return (
            <button className={`quiz-answer flex min-h-[52px] w-full items-center gap-12 rounded-13 border border-line bg-white px-16 py-13 text-left text-ink transition-colors hover:border-outline disabled:cursor-default ${state === "selected" ? "quiz-answer-selected" : state === "correct" ? "quiz-answer-correct" : state === "wrong" ? "quiz-answer-wrong" : ""} [&>span]:grid [&>span]:size-28 [&>span]:shrink-0 [&>span]:place-items-center [&>span]:rounded-9 [&>span]:bg-pale [&>span]:text-12 [&>span]:font-bold [&>span]:text-brand`} key={answer} onClick={() => choose(answer)} disabled={revealed}>
              <span>{String.fromCharCode(65 + optionIndex)}</span>
              {answer}
            </button>
          );
        })}
      </div>
      {revealed && item?.explanation && <div className="quiz-explanation mt-18 rounded-13 border px-16 py-14 text-13 leading-160 text-ink [&>strong]:mb-4 [&>strong]:block [&>p]:m-0"><strong>Why this is correct</strong><p>{item.explanation}</p></div>}
      <div className="mt-24 flex items-center justify-between gap-10">
        <button className="border-0 bg-transparent text-12 font-semibold text-muted hover:text-brand" onClick={next}>Skip question</button>
        <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={next}>
          {index === total - 1 ? "Finish" : "Next"} <ArrowRight size={15} />
        </button>
      </div>
    </PlayerFrame>
  );
}
export function Results({
  set,
  score,
  total,
  onRetake,
  onBack,
}: {
  set: GeneratedSet;
  score: number;
  total: number;
  onRetake: () => void;
  onBack: () => void;
}) {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  const missed = Math.max(total - score, 0);
  const pass = percent >= 50;
  return (
    <PageFrame title="Quiz complete" subtitle={set.title} back="dashboard">
      <div className="grid justify-items-center gap-14 rounded-20 border border-line bg-white px-26 py-38 text-center shadow-[0_22px_40px_rgba(15,23,42,.07)] max-680:px-16 max-680:py-24 [&>span]:text-15 [&>span]:font-bold [&>span]:text-brand [&>small]:max-w-380 [&>small]:text-12 [&>small]:leading-160 [&>small]:text-muted">
        <div className="grid size-[148px] place-items-center rounded-full border-[10px] border-[#dbeafe] border-r-brand border-t-brand [&>strong]:text-[34px] [&>strong]:font-bold">
          <strong>{percent}%</strong>
        </div>
        <span>{pass ? "Strong pass" : "Keep practising"}</span>
        <small>
          {pass ? "Nice work. Review the ones you missed and go again." : "A few more rounds will get you there — check the questions you missed."}
        </small>
      </div>
      <div className="mt-18 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-12 [&>div]:grid [&>div]:place-items-center [&>div]:gap-6 [&>div]:rounded-14 [&>div]:border [&>div]:border-line [&>div]:bg-white [&>div]:p-16 [&_strong]:text-24 [&_strong]:font-bold [&_span]:text-11 [&_span]:text-muted">
        <div>
          <strong>{score}</strong>
          <span>Correct</span>
        </div>
        <div>
          <strong className={missed ? "quiz-missed" : ""}>{missed}</strong>
          <span>Missed</span>
        </div>
        <div>
          <strong>{set.timePerQuestion ?? 30}s</strong>
          <span>Per question</span>
        </div>
      </div>
      <div className="mt-26 flex flex-wrap gap-10 [&>button]:flex-1 max-760:flex-col">
        <button className="secondary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 border border-[#d6e3f5] bg-white px-14 text-12 font-bold leading-[1.25] text-[#4f46e5] transition-colors duration-200 hover:border-[#b7b7b3] hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={onRetake}>
          Retake quiz
        </button>
        <button className="primary-button inline-flex min-h-40 max-w-full items-center justify-center gap-7 whitespace-normal rounded-9 bg-[#2563eb] px-14 text-12 font-bold leading-[1.25] text-white shadow-[0_7px_18px_rgba(37,99,235,.14)] transition-[transform,background,box-shadow] duration-200 hover:-translate-y-2 hover:bg-[#1d4ed8] hover:shadow-[0_10px_22px_rgba(37,99,235,.19)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    </PageFrame>
  );
}
