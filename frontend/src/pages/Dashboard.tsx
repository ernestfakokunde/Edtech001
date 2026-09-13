import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  FileText,
  Flame,
  Layers3,
  Plus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { go } from "../components/Layout";

export function Dashboard({ onLogout, isAdmin }: { onLogout: () => Promise<void>; isAdmin: boolean }) {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-topline">
        <div className="dashboard-brand"><span><Layers3 size={16} /></span> RecappEdu</div>
        <div className="dashboard-actions"><button className="dashboard-icon" aria-label="View notifications"><Bell size={16} /><i /></button>{isAdmin && <button className="dashboard-admin-link" onClick={() => go("admin")}><ShieldCheck size={14} /> Admin board</button>}<button className="dashboard-avatar" aria-label="Open profile" onClick={() => go("profile")}>EF</button><button className="dashboard-logout" onClick={() => void onLogout()}>Log out</button></div>
      </div>

      <section className="dashboard-greeting">
        <p className="eyebrow">Your study desk</p>
        <h1>Welcome back, Ernest</h1>
        <p>Cyber Security · Computing, FUT Minna</p>
      </section>

      <section className="metric-grid">
        <Metric icon={<Flame size={15} />} value="6" label="Day streak" tone="amber" />
        <Metric icon={<Layers3 size={15} />} value="142" label="Cards reviewed" tone="blue" />
        <Metric icon={<Check size={15} />} value="78%" label="Avg. quiz score" tone="green" />
      </section>

      <DashboardSection title="Your courses" action="Manage">
        <div className="dashboard-course-grid"><div className="dashboard-empty"><BookOpen size={20} /><strong>No course added yet</strong><span>Open the repository to find a paper or upload one.</span></div><button className="dashboard-add-course" onClick={() => go("hierarchy")}><span><Plus size={15} /></span><strong>Browse or upload a material</strong></button></div>
      </DashboardSection>

      <section className="dashboard-quick-actions"><button onClick={() => go("generate")}><Sparkles size={16} /><span><strong>Create from my PDF</strong><small>Private AI practice set</small></span><ArrowRight size={16} /></button><button onClick={() => go("hierarchy")}><FileText size={16} /><span><strong>Browse course repository</strong><small>Find papers by course</small></span><ArrowRight size={16} /></button></section>
    </main>
  );
}

function Metric({ icon, value, label, tone }: { icon: React.ReactNode; value: string; label: string; tone: string }) { return <div className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><strong>{value}</strong><small>{label}</small></div>; }
function DashboardSection({ title, action, children }: { title: string; action: string; children: React.ReactNode }) { return <section className="dashboard-section"><div className="dashboard-section-head"><h2>{title}</h2><button>{action}</button></div>{children}</section>; }
