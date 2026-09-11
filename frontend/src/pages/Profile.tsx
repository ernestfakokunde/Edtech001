import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Save, Trash2, UserRound } from "lucide-react";
import { PageFrame } from "../components/Layout";
import {
  createCourse, createDepartment, createFaculty, createUniversity,
  deleteDepartment, deleteFaculty, deleteUniversity,
  getCourses, getCurrentProfile, getDepartments, getFaculties, getUniversities,
  updateCourse, updateDepartment, updateFaculty, updateProfile, updateUniversity,
  deleteCourse,
} from "../lib/api";
import type { ApiCourse, Department, Faculty, University } from "../lib/api";

export function ProfilePage() {
  const [profile, setProfile] = useState({ displayName: "", username: "", email: "" });
  const [universities, setUniversities] = useState<University[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [courses, setCourses] = useState<ApiCourse[]>([]);
  const [selected, setSelected] = useState({ universityId: "", facultyId: "", departmentId: "" });
  const [entryName, setEntryName] = useState("");
  const [courseForm, setCourseForm] = useState({ code: "", title: "", crossListingCode: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    getUniversities().then((result) => setUniversities(result.universities)).catch((reason: Error) => setError(reason.message));
    getCurrentProfile().then((result) => setProfile({ displayName: result.profile.displayName ?? "", username: result.profile.username ?? "", email: result.profile.email ?? "" })).catch(() => setError("Could not load your profile."));
  }, []);

  async function chooseUniversity(universityId: string) {
    setSelected({ universityId, facultyId: "", departmentId: "" }); setFaculties([]); setDepartments([]); setCourses([]);
    if (universityId) setFaculties((await getFaculties(universityId)).faculties);
  }
  async function chooseFaculty(facultyId: string) {
    setSelected((current) => ({ ...current, facultyId, departmentId: "" })); setDepartments([]); setCourses([]);
    if (facultyId) setDepartments((await getDepartments(facultyId)).departments);
  }
  async function chooseDepartment(departmentId: string) {
    setSelected((current) => ({ ...current, departmentId })); setCourses([]);
    if (departmentId) setCourses((await getCourses(departmentId)).courses);
  }
  async function saveProfile() {
    setError(""); setMessage("");
    try { const result = await updateProfile({ displayName: profile.displayName, username: profile.username }); setProfile((current) => ({ ...current, displayName: result.profile.displayName ?? "", username: result.profile.username ?? "" })); setMessage("Profile saved."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
  }
  async function addEntry(level: "university" | "faculty" | "department") {
    setError(""); setMessage("");
    try {
      if (level === "university") { const result = await createUniversity(entryName); setUniversities((current) => [...current, result.university].sort((a, b) => a.name.localeCompare(b.name))); await chooseUniversity(result.university.id); }
      if (level === "faculty" && selected.universityId) { const result = await createFaculty(selected.universityId, entryName); setFaculties((current) => [...current, result.faculty].sort((a, b) => a.name.localeCompare(b.name))); setSelected((current) => ({ ...current, facultyId: result.faculty.id })); }
      if (level === "department" && selected.facultyId) { const result = await createDepartment(selected.facultyId, entryName); setDepartments((current) => [...current, result.department].sort((a, b) => a.name.localeCompare(b.name))); setSelected((current) => ({ ...current, departmentId: result.department.id })); }
      setEntryName(""); setMessage("Added to your academic map.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add this entry."); }
  }
  async function addCourse() {
    setError(""); setMessage("");
    try { const result = await createCourse(selected.departmentId, courseForm); setCourses((current) => [...current, result.course].sort((a, b) => a.code.localeCompare(b.code))); setCourseForm({ code: "", title: "", crossListingCode: "" }); setMessage("Course added to your academic map."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add this course."); }
  }
  function selectedEntry() { return selected.departmentId ? departments.find((item) => item.id === selected.departmentId) : selected.facultyId ? faculties.find((item) => item.id === selected.facultyId) : universities.find((item) => item.id === selected.universityId); }
  async function renameSelected() {
    const target = selectedEntry(); if (!target) return;
    const name = window.prompt("New name", target.name)?.trim(); if (!name || name === target.name) return;
    setError(""); setMessage("");
    try {
      if (selected.departmentId) { const result = await updateDepartment(target.id, name); setDepartments((current) => current.map((item) => item.id === target.id ? result.department : item)); }
      else if (selected.facultyId) { const result = await updateFaculty(target.id, name); setFaculties((current) => current.map((item) => item.id === target.id ? result.faculty : item)); }
      else { const result = await updateUniversity(target.id, name); setUniversities((current) => current.map((item) => item.id === target.id ? result.university : item)); }
      setMessage("Academic entry renamed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not rename this entry."); }
  }
  async function removeSelected() {
    const target = selectedEntry(); if (!target || !window.confirm(`Delete ${target.name}?`)) return;
    setError(""); setMessage("");
    try {
      if (selected.departmentId) { await deleteDepartment(target.id); setDepartments((current) => current.filter((item) => item.id !== target.id)); setSelected((current) => ({ ...current, departmentId: "" })); setCourses([]); }
      else if (selected.facultyId) { await deleteFaculty(target.id); setFaculties((current) => current.filter((item) => item.id !== target.id)); setSelected((current) => ({ ...current, facultyId: "", departmentId: "" })); setDepartments([]); setCourses([]); }
      else { await deleteUniversity(target.id); setUniversities((current) => current.filter((item) => item.id !== target.id)); setSelected({ universityId: "", facultyId: "", departmentId: "" }); setFaculties([]); setDepartments([]); setCourses([]); }
      setMessage("Academic entry deleted.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this entry."); }
  }
  async function renameCourse(course: ApiCourse) {
    const title = window.prompt("Course title", course.title)?.trim(); if (!title || title === course.title) return;
    setError(""); setMessage("");
    try { const result = await updateCourse(course.id, { code: course.code, title, crossListingCode: course.crossListingCode ?? "" }); setCourses((current) => current.map((item) => item.id === course.id ? result.course : item)); setMessage("Course renamed."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not rename this course."); }
  }
  async function removeCourse(course: ApiCourse) {
    if (!window.confirm(`Delete ${course.code}?`)) return;
    setError(""); setMessage("");
    try { await deleteCourse(course.id); setCourses((current) => current.filter((item) => item.id !== course.id)); setMessage("Course deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not delete this course."); }
  }

  const selectedTarget = selectedEntry();
  const addLevel = selected.facultyId ? "department" : selected.universityId ? "faculty" : "university";
  return <PageFrame title="Your profile" subtitle="Keep your identity and academic map ready for every study session." back="dashboard">
    <div className="profile-layout">
      <section className="profile-card profile-identity"><div className="profile-card-heading"><span className="profile-icon"><UserRound size={20} /></span><div><p className="eyebrow">Account</p><h2>Personal details</h2></div></div><label className="field"><span>Display name</span><input value={profile.displayName} onChange={(event) => setProfile({ ...profile, displayName: event.target.value })} placeholder="How should we call you?" /></label><label className="field"><span>Username</span><input value={profile.username} onChange={(event) => setProfile({ ...profile, username: event.target.value })} placeholder="e.g. ernest_ade" /><small>3-24 lowercase letters, numbers, or underscores.</small></label><label className="field"><span>Email</span><input value={profile.email} disabled /></label><button className="primary-button" onClick={() => void saveProfile()}><Save size={16} /> Save profile</button></section>
      <section className="profile-card academic-card"><div className="profile-card-heading"><span className="profile-icon blue"><Plus size={20} /></span><div><p className="eyebrow">Academic map</p><h2>Add your university path</h2></div></div><p className="profile-help">Add missing entries as you discover them. New entries become available immediately.</p><div className="profile-select-grid"><Select label="University" value={selected.universityId} options={universities} onChange={chooseUniversity} placeholder="Choose university" /><Select label="Faculty" value={selected.facultyId} options={faculties} onChange={chooseFaculty} placeholder="Choose faculty" disabled={!selected.universityId} /><Select label="Department" value={selected.departmentId} options={departments} onChange={chooseDepartment} placeholder="Choose department" disabled={!selected.facultyId} /></div><div className="profile-manage-row">{selectedTarget && <><button className="ghost-button" onClick={() => void renameSelected()}><Pencil size={14} /> Rename selected</button><button className="ghost-button danger" onClick={() => void removeSelected()}><Trash2 size={14} /> Delete selected</button></>}</div><div className="profile-add-row"><input value={entryName} onChange={(event) => setEntryName(event.target.value)} placeholder={`Name of a new ${addLevel}`} /><button className="secondary-button" disabled={!entryName.trim()} onClick={() => void addEntry(addLevel)}><Plus size={15} /> Add {addLevel}</button></div>{selected.departmentId && <div className="course-add-box"><h3>Add a course</h3><div className="course-form-grid"><input value={courseForm.code} onChange={(event) => setCourseForm({ ...courseForm, code: event.target.value })} placeholder="Course code" /><input value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} placeholder="Course title" /><input value={courseForm.crossListingCode} onChange={(event) => setCourseForm({ ...courseForm, crossListingCode: event.target.value })} placeholder="Cross-listed code (optional)" /><button className="secondary-button" disabled={!courseForm.code.trim() || !courseForm.title.trim()} onClick={() => void addCourse()}><Plus size={15} /> Add course</button></div>{courses.length > 0 && <div className="profile-course-list">{courses.map((course) => <span key={course.id}><strong>{course.code}</strong> {course.title}<button className="ghost-button" onClick={() => void renameCourse(course)}><Pencil size={12} /></button><button className="ghost-button danger" onClick={() => void removeCourse(course)}><Trash2 size={12} /></button></span>)}</div>}</div>}</section>
    </div>{message && <p className="profile-feedback success"><Check size={15} /> {message}</p>}{error && <p className="profile-feedback error">{error}</p>}
  </PageFrame>;
}

function Select({ label, value, options, onChange, placeholder, disabled = false }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; placeholder: string; disabled?: boolean }) { return <label className="field"><span>{label}</span><div className="select-wrap"><select value={value} onChange={(event) => void onChange(event.target.value)} disabled={disabled}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><ChevronDown size={15} /></div></label>; }
