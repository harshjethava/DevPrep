import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import {
  LayoutDashboard,
  FileText,
  Code2,
  PlayCircle,
  User,
  ChevronDown,
  Brain,
  ArrowRight,
  Clock,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Download,
  RotateCcw,
  Eye
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI, questionsAPI } from '../services/api';

/* ── constants ────────────────────────────────────────────────────────────── */

const ROLE_PRESETS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Engineer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'QA Engineer'
];

const TOPICS_BY_ROLE = {
  'Frontend Developer': ['Frontend', 'JavaScript', 'React', 'HTML/CSS', 'Networking', 'Behavioral'],
  'Backend Developer': ['Backend', 'System Design', 'Database', 'Networking', 'Operating Systems', 'Behavioral'],
  'Full Stack Developer': ['Frontend', 'Backend', 'System Design', 'Database', 'Networking', 'Behavioral'],
  'Data Engineer': ['Database', 'System Design', 'Data Structures', 'Algorithms', 'Networking', 'Behavioral'],
  'Machine Learning Engineer': ['Algorithms', 'Data Structures', 'System Design', 'Database', 'Behavioral'],
  'DevOps Engineer': ['Networking', 'Operating Systems', 'System Design', 'Backend', 'Behavioral'],
  'QA Engineer': ['Frontend', 'Backend', 'System Design', 'Behavioral']
};

const FALLBACK_TOPICS = [
  'Data Structures', 'Algorithms', 'System Design', 'Database',
  'Frontend', 'Backend', 'Networking', 'Operating Systems', 'Behavioral'
];

const DIFFICULTY_CONFIG = [
  { value: 'Easy', color: 'emerald', activeBg: 'bg-emerald-500/20 border-emerald-500', activeText: 'text-emerald-400' },
  { value: 'Medium', color: 'yellow', activeBg: 'bg-yellow-500/20 border-yellow-500', activeText: 'text-yellow-400' },
  { value: 'Hard', color: 'red', activeBg: 'bg-red-500/20 border-red-500', activeText: 'text-red-400' }
];

/* ── pdf generation ───────────────────────────────────────────────────────── */

function downloadQuestionsPdf({ role, difficulty, topics, questions }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 48;
  const lineGap = 14;

  const addLine = (text, { fontSize = 11, bold = false, gap = lineGap } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text || ''), maxWidth);
    for (const ln of lines) {
      if (y > pageHeight - 48) { doc.addPage(); y = 48; }
      doc.text(ln, marginX, y);
      y += gap;
    }
  };

  addLine('DevPrep — Saved Questions', { fontSize: 16, bold: true, gap: 20 });
  addLine(`Role: ${role || '-'}`, { bold: true });
  addLine(`Difficulty: ${difficulty || '-'}`);
  addLine(`Topic: ${(Array.isArray(topics) && topics[0]) || '-'}`);
  addLine(`Total: ${Array.isArray(questions) ? questions.length : 0}`, { gap: 20 });

  const items = Array.isArray(questions) ? questions : [];
  items.forEach((q, idx) => {
    addLine(`${idx + 1}. ${q.text || ''}`, { bold: true, gap: 16 });
    const opts = Array.isArray(q.options) ? q.options : [];
    opts.slice(0, 4).forEach((opt, i) => addLine(`${String.fromCharCode(65 + i)}. ${opt}`, { gap: 14 }));
    const correctIdx = Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
    addLine(`Correct: ${String.fromCharCode(65 + Math.max(0, Math.min(3, correctIdx)))}`, { gap: 14 });
    if (q.explanation) addLine(`Explanation: ${q.explanation}`, { gap: 16 });
    else y += 10;
    y += 8;
  });

  const safe = (s) => String(s || '').trim().replace(/[^a-z0-9-_]+/gi, '_');
  doc.save(`devprep_${safe(role)}_${safe(topics?.[0])}_${safe(difficulty)}.pdf`);
}

/* ── question normalizer ──────────────────────────────────────────────────── */

function normalizeGeneratedQuestions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((q, i) => {
      const text = q && typeof q.text === 'string' ? q.text.trim() : '';
      const options = q && Array.isArray(q.options)
        ? q.options.filter((o) => typeof o === 'string' && o.trim())
        : [];
      const correctIndex = q && Number.isInteger(q.correctIndex) ? q.correctIndex : 0;
      const topic = q && typeof q.topic === 'string' ? q.topic.trim() : '';
      const explanation = q && typeof q.explanation === 'string' ? q.explanation.trim() : '';
      const normalizedOptions = options.map((o) => o.trim()).slice(0, 4);
      if (!text || normalizedOptions.length !== 4) return null;
      return {
        id: `${Date.now()}-${i}`,
        text,
        options: normalizedOptions,
        correctIndex: correctIndex >= 0 && correctIndex <= 3 ? correctIndex : 0,
        topic,
        explanation
      };
    })
    .filter(Boolean);
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function formatTime(s) {
  if (!Number.isFinite(s)) return '--:--';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ═══════════════════════════════════════════════════════════════════════════ */

const QuestionGenerator = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  /* ── layout / chrome state ──────────────────────────────────────────────── */
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dbProfile, setDbProfile] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  /* ── form state ─────────────────────────────────────────────────────────── */
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [topics, setTopics] = useState([]);
  const [count, setCount] = useState(null);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);

  /* ── generation / quiz state ────────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizDone, setQuizDone] = useState(false);
  const [mode, setMode] = useState('settings'); // settings | quiz | submitted | review
  const [secondsLeft, setSecondsLeft] = useState(null);

  /* ── saved stats state ──────────────────────────────────────────────────── */
  const [savedStats, setSavedStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  /* ── navigation ─────────────────────────────────────────────────────────── */
  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try { await signOut({ redirectUrl: '/login' }); }
    catch (_) { toast.error('Failed to logout'); setLogoutLoading(false); }
  };

  /* ── derived values ─────────────────────────────────────────────────────── */
  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    (dbProfile && dbProfile.name) ||
    'User';

  const sidebarItems = useMemo(() => [
    { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
    { label: 'Profile', path: '/profile', Icon: User },
    { label: 'Question Generator', path: '/questions/generate', Icon: Brain },
    { label: 'Mock Interview', path: '/interview/mock', Icon: PlayCircle },
    { label: 'Resume Interview', path: '/interview/resume', Icon: FileText },
    { label: 'Coding Practice', path: '/coding/practice', Icon: Code2 }
  ], []);

  const navbarLinks = useMemo(() => [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Questions', path: '/questions/generate' },
    { label: 'Mock', path: '/interview/mock' },
    { label: 'Resume', path: '/interview/resume' },
    { label: 'Coding', path: '/coding/practice' }
  ], []);

  const availableTopics = useMemo(() => {
    const key = String(role || '').trim();
    return TOPICS_BY_ROLE[key] || FALLBACK_TOPICS;
  }, [role]);

  const toggleTopic = (t) => setTopics((prev) => (prev[0] === t ? [] : [t]));

  const canGenerate =
    Boolean(String(role || '').trim()) &&
    Boolean(String(difficulty || '').trim()) &&
    Array.isArray(topics) && topics.length === 1 &&
    [10, 15, 20].includes(Number(count));

  const totalSeconds = useMemo(() => {
    const c = Number(count);
    if (![10, 15, 20].includes(c)) return null;
    const perQ = difficulty === 'Easy' ? 30 : difficulty === 'Medium' ? 45 : difficulty === 'Hard' ? 60 : null;
    return perQ ? c * perQ : null;
  }, [count, difficulty]);

  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';

  /* ── effects ────────────────────────────────────────────────────────────── */

  // Fetch profile
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await clerkAPI.getProfile(token);
        setDbProfile(res.data?.user || null);
      } catch (_) { /* ignore */ }
    })();
  }, [ready, getToken]);

  // Fetch saved stats
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await questionsAPI.getSavedStats(token);
        setSavedStats(res.data || null);
      } catch (_) { /* ignore */ }
      setStatsLoading(false);
    })();
  }, [ready, getToken]);

  // Reset topics when role changes
  useEffect(() => {
    setTopics((prev) => prev.filter((t) => availableTopics.includes(t)));
  }, [availableTopics]);

  // Timer countdown
  useEffect(() => {
    if (mode !== 'quiz' || !Number.isFinite(secondsLeft) || secondsLeft <= 0) return;
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        const next = Number(prev) - 1;
        return next <= 0 ? 0 : next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [mode, secondsLeft]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (mode !== 'quiz') return;
    if (secondsLeft === 0 && questions.length && !quizDone) {
      setQuizDone(true);
      setMode('submitted');
      toast.info("Time's up — quiz submitted");
    }
  }, [mode, secondsLeft, questions.length, quizDone]);

  // Close role dropdown on outside click
  useEffect(() => {
    if (!roleDropdownOpen) return;
    const handler = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setRoleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [roleDropdownOpen]);

  /* ── handlers ───────────────────────────────────────────────────────────── */

  const onGenerate = async () => {
    const allowedCounts = new Set([10, 15, 20]);
    const requested = Number(count);
    const normalizedCount = allowedCounts.has(requested) ? requested : 10;
    const payload = { role: role.trim(), difficulty, topics, count: normalizedCount };

    if (!ready) { toast.info('Loading session… try again'); return; }
    const token = await getToken();
    if (!token) { toast.error('Not authenticated'); return; }

    setLoading(true);
    try {

      const res = await questionsAPI.generate(token, payload);
      const normalized = normalizeGeneratedQuestions(res.data?.questions || []);
      if (!normalized.length) throw new Error('No questions returned');

      setQuestions(normalized);
      setQuizIndex(0);
      setQuizAnswers(Array.from({ length: normalized.length }).fill(null));
      setQuizDone(false);
      setHasSaved(false); // They haven't explicitly saved/downloaded yet
      setMode('quiz');
      setSecondsLeft(totalSeconds || normalized.length * 45);
      toast.success('Questions generated');

      // Auto-save to DB in background so it appears in Recent Quizzes immediately
      try {
        await questionsAPI.save(token, {
          role: role.trim(),
          difficulty,
          topics,
          questions: normalized
        });
        const statsRes = await questionsAPI.getSavedStats(token);
        setSavedStats(statsRes.data || null);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }

    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to generate quiz';
      toast.error(status ? `${msg} (${status})` : msg);
    } finally {
      setLoading(false);
    }
  };

  const onSaveQuestions = async () => {
    if (saving || !questions.length) return;
    if (!ready) { toast.info('Loading session… try again'); return; }
    const token = await getToken();
    if (!token) { toast.error('Not authenticated'); return; }

    setSaving(true);
    try {
      const payload = {
        role: String(role || '').trim(),
        difficulty: String(difficulty || '').trim(),
        topics,
        questions
      };

      // 1) Save to database
      const res = await questionsAPI.save(token, payload);
      const savedCount = Number(res.data?.saved) || 0;
      toast.success('Quiz saved and PDF downloading...');
      setHasSaved(true);

      // 2) Refresh sidebar stats
      try {
        const statsRes = await questionsAPI.getSavedStats(token);
        setSavedStats(statsRes.data || null);
      } catch (_) { /* ignore */ }

      // 3) Download PDF
      try {
        downloadQuestionsPdf({ role: payload.role, difficulty: payload.difficulty, topics: payload.topics, questions: payload.questions });
      } catch (pdfErr) {
        console.error('PDF generation failed:', pdfErr);
        toast.error('Saved, but failed to generate PDF');
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to save questions';
      toast.error(status ? `${msg} (${status})` : msg);
    } finally {
      setSaving(false);
    }
  };

  const onExitQuiz = () => {
    setMode('settings');
    setQuizDone(false);
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuestions([]);
    setSecondsLeft(null);
    setHasSaved(false);
  };

  /* ── quiz helpers ───────────────────────────────────────────────────────── */

  const quizScore = useMemo(() => {
    if (!questions.length) return { correct: 0, answered: 0, total: 0, pct: 0 };
    const answered = quizAnswers.filter((a) => a !== null && a !== undefined).length;
    const correct = questions.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correctIndex ? 1 : 0), 0);
    const pct = Math.round((correct / questions.length) * 100);
    return { correct, answered, total: questions.length, pct };
  }, [questions, quizAnswers]);

  const scoreColor = quizScore.pct >= 70 ? '#34d399' : quizScore.pct >= 40 ? '#fbbf24' : '#f87171';

  const timerClasses = useMemo(() => {
    if (!Number.isFinite(secondsLeft)) return 'bg-black/20 border-white/10 text-slate-200';
    if (secondsLeft < 30) return 'bg-rose-600/15 border-rose-400/30 text-rose-300 animate-pulse';
    if (secondsLeft < 120) return 'bg-amber-600/15 border-amber-400/30 text-amber-300';
    return 'bg-black/20 border-white/10 text-slate-200';
  }, [secondsLeft]);

  /* ── render helpers ─────────────────────────────────────────────────────── */

  const renderQuestionDots = (isReview = false) => (
    <div className="flex flex-wrap gap-1.5 justify-center mt-4">
      {questions.map((q, i) => {
        const isCurrent = quizIndex === i;
        const isAnswered = quizAnswers[i] !== null && quizAnswers[i] !== undefined;
        let dotCls = 'w-2.5 h-2.5 rounded-full border transition-all duration-200 cursor-pointer';

        if (isReview) {
          const isCorrect = quizAnswers[i] === q.correctIndex;
          if (!isAnswered) dotCls += ' bg-slate-600/50 border-slate-500/30';
          else if (isCorrect) dotCls += ' bg-emerald-500 border-emerald-400';
          else dotCls += ' bg-rose-500 border-rose-400';
        } else {
          if (isCurrent) dotCls += ' bg-violet-500 border-violet-400 scale-125';
          else if (isAnswered) dotCls += ' bg-cyan-500 border-cyan-400';
          else dotCls += ' bg-white/10 border-white/20';
        }

        return (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuizIndex(i)}
            className={dotCls}
            title={`Question ${i + 1}`}
          />
        );
      })}
    </div>
  );

  /* ═══════════════════════════════════════════════ RENDER ═══════════════════ */

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-x-hidden relative">
      <EnhancedAnimatedBackground />

      <div className="relative z-10 min-h-screen p-4 lg:p-8">
        <div className="mx-auto w-full max-w-[1600px]">
          <div className="flex gap-5">
            <Sidebar
              openMobile={mobileSidebarOpen}
              onCloseMobile={() => setMobileSidebarOpen(false)}
              collapsed={sidebarCollapsed}
              onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
              items={sidebarItems}
              onNavigate={safeNavigate}
              profile={{ name: displayName, avatar: avatarUrl }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand=""
                    activeLabel="Questions"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={avatarUrl}
                    onLogout={() => setConfirmLogoutOpen(true)}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-6"
              >
                {/* ────────── GENERATING SHIMMER ────────── */}
                {loading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)] p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-400/20 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-violet-400 animate-pulse" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-200">Generating your quiz…</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {role} • {difficulty} • {topics[0] || 'General'} • {count || 10} questions
                        </div>
                      </div>
                    </div>

                    {/* Progress bar animation */}
                    <div className="relative w-full h-1 rounded-full bg-white/5 mb-6 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                        initial={{ width: '5%' }}
                        animate={{ width: '85%' }}
                        transition={{ duration: 15, ease: 'easeOut' }}
                      />
                    </div>

                    {/* Shimmer placeholder cards */}
                    <div className="space-y-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                          <div className="h-4 w-3/4 rounded-lg bg-white/5 animate-pulse" />
                          <div className="mt-4 space-y-2">
                            {[1, 2, 3, 4].map((j) => (
                              <div key={j} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" style={{ animationDelay: `${j * 150}ms` }} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : mode === 'settings' ? (
                  /* ────────── SETTINGS MODE ────────── */
                  <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                    {/* Form — left 7/10 */}
                    <div className="lg:col-span-7">
                      <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                          <Brain className="w-4 h-4 text-violet-400" />
                          Quiz Settings
                        </div>

                        {/* Scrollable Form Area */}
                        <div className="mt-5 max-h-[500px] overflow-y-auto pr-2">
                          {/* Role selection */}
                          <div>
                            <label className="block text-xs text-slate-400">Target Role</label>
                            <div className="mt-2 relative" ref={roleDropdownRef}>
                              <button
                                type="button"
                                onClick={() => setRoleDropdownOpen((v) => !v)}
                                className="w-full h-11 px-4 rounded-xl bg-black/20 border border-white/10 hover:border-white/20 text-slate-100 inline-flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-violet-500/35 transition-colors"
                              >
                                <span className={role ? 'text-slate-100' : 'text-slate-400'}>
                                  {role || 'Select a role'}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                              </button>
                              <AnimatePresence>
                                {roleDropdownOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#0b1220]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.55)] overflow-hidden"
                                  >
                                    <div className="max-h-64 overflow-auto py-2">
                                      {ROLE_PRESETS.map((r) => (
                                        <button
                                          key={r}
                                          type="button"
                                          onClick={() => { setRole(r); setRoleDropdownOpen(false); }}
                                          className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                            r === role ? 'bg-violet-600/20 text-slate-100' : 'text-slate-200 hover:bg-white/5'
                                          }`}
                                        >
                                          {r}
                                        </button>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          {/* Difficulty */}
                          <div className="mt-4">
                            <label className="block text-xs text-slate-400">Difficulty Level</label>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {DIFFICULTY_CONFIG.map((d) => {
                                const active = difficulty === d.value;
                                return (
                                  <button
                                    key={d.value}
                                    type="button"
                                    onClick={() => setDifficulty(d.value)}
                                    className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                                      active
                                        ? `${d.activeBg} ${d.activeText}`
                                        : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                    }`}
                                  >
                                    {d.value}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Topics */}
                          <div className="mt-4">
                            <label className="block text-xs text-slate-400">
                              Topic <span className="text-slate-500">(select one)</span>
                            </label>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {availableTopics.map((t) => {
                                const active = topics.includes(t);
                                return (
                                  <button
                                    key={t}
                                    type="button"
                                    onClick={() => toggleTopic(t)}
                                    className={`px-3 h-9 rounded-xl border text-xs transition-all duration-200 ${
                                      active
                                        ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                                        : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                    }`}
                                  >
                                    {t}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Question count */}
                          <div className="mt-4">
                            <label className="block text-xs text-slate-400">Number of Questions</label>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {[10, 15, 20].map((n) => {
                                const active = Number(count) === n;
                                return (
                                  <button
                                    key={n}
                                    type="button"
                                    onClick={() => setCount(n)}
                                    className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                                      active
                                        ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                                        : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                    }`}
                                  >
                                    {n}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Generate button */}
                          <div className="mt-6 pt-5 border-t border-white/10 flex justify-end">
                            <button
                              type="button"
                              onClick={onGenerate}
                              disabled={loading || !canGenerate}
                              className="w-full sm:w-auto h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                            >
                              <Brain className="w-5 h-5" />
                              Generate Quiz
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Recent Quizzes sidebar — right 3/10 */}
                    <div className="lg:col-span-3">
                      <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                        <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-cyan-400" />
                          Recent Quizzes
                        </div>

                        {statsLoading ? (
                          <div className="mt-4 space-y-2">
                            {[1, 2, 3].map((i) => (
                              <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
                                  <div className="h-3 w-8 bg-white/10 rounded animate-pulse" />
                                </div>
                                <div className="flex items-center gap-2 mt-2.5">
                                  <div className="h-3 w-10 bg-white/5 rounded animate-pulse" />
                                  <div className="h-3 w-14 bg-white/5 rounded animate-pulse" />
                                  <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : !savedStats || savedStats.totalSaved === 0 ? (
                          <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
                            <Brain className="w-8 h-8 text-slate-500 mx-auto" />
                            <p className="text-sm text-slate-400 mt-2">No quizzes yet</p>
                            <p className="text-xs text-slate-500 mt-1">Generate and save your first quiz!</p>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                            {Array.isArray(savedStats.recentQuizzes) && savedStats.recentQuizzes.map((quiz, i) => (
                              <div
                                key={`${quiz.role}-${quiz.difficulty}-${quiz.topic}-${i}`}
                                className="rounded-xl border border-white/10 bg-black/10 p-3 transition-colors"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-slate-200 truncate">
                                    {quiz.role || 'Role'}
                                  </span>
                                  <span className="text-xs text-slate-400 flex-shrink-0">
                                    {quiz.count} Q{quiz.count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className={`text-xs capitalize ${
                                    quiz.difficulty === 'Easy' ? 'text-emerald-400'
                                      : quiz.difficulty === 'Hard' ? 'text-rose-400'
                                      : 'text-amber-400'
                                  }`}>{quiz.difficulty}</span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-400">{quiz.topic || 'General'}</span>
                                  <span className="text-xs text-slate-500">•</span>
                                  <span className="text-xs text-slate-400">{formatDate(quiz.lastSavedAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ────────── QUIZ / SUBMITTED / REVIEW MODES ────────── */
                  <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl overflow-hidden">
                    {/* Quiz header */}
                    <div className="p-5 border-b border-white/10">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-slate-100">
                            {mode === 'review' ? 'Review Answers' : mode === 'submitted' ? 'Quiz Complete' : 'Quiz'}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {role || 'Role'} • {difficulty} • {topics[0] || 'Topic'} • {questions.length} questions
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {mode === 'quiz' && (
                            <div className={`px-3 h-10 rounded-xl border inline-flex items-center gap-2 text-sm font-medium ${timerClasses}`}>
                              <Clock className="w-4 h-4" />
                              {formatTime(secondsLeft)}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={onExitQuiz}
                            className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 text-sm transition-colors"
                          >
                            Exit
                          </button>
                        </div>
                      </div>

                      {/* Progress bar */}
                      {mode === 'quiz' && (
                        <div className="mt-3 w-full h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${((quizIndex + 1) / questions.length) * 100}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="p-5 sm:p-6">
                      {/* ── QUIZ mode ── */}
                      {mode === 'quiz' && questions.length > 0 && !quizDone && (() => {
                        const q = questions[quizIndex];
                        const selected = quizAnswers[quizIndex];
                        return (
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={quizIndex}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.25 }}
                              className="rounded-2xl border border-white/10 bg-black/10 p-5"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-xs text-slate-500">{q.topic || 'General'}</div>
                                <div className="text-xs text-slate-500">{quizIndex + 1} / {questions.length}</div>
                              </div>
                              <div className="text-base font-semibold text-slate-100 mt-3 leading-relaxed">{q.text}</div>

                              <div className="mt-5 grid grid-cols-1 gap-2">
                                {q.options.map((opt, i) => {
                                  const active = selected === i;
                                  return (
                                    <button
                                      key={`${q.id}-${i}`}
                                      type="button"
                                      onClick={() => {
                                        setQuizAnswers((prev) => {
                                          const next = [...prev];
                                          next[quizIndex] = i;
                                          return next;
                                        });
                                      }}
                                      className={`px-4 py-3 rounded-xl border text-left text-sm transition-all duration-200 ${
                                        active
                                          ? 'bg-violet-600/15 border-violet-400/30 text-slate-100 shadow-[0_0_12px_rgba(139,92,246,0.1)]'
                                          : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07] text-slate-300'
                                      }`}
                                    >
                                      <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Navigation */}
                              <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => setQuizIndex((v) => Math.max(0, v - 1))}
                                  disabled={quizIndex === 0}
                                  className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-40 transition-colors"
                                >
                                  Previous
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (quizIndex + 1 >= questions.length) {
                                      setQuizDone(true);
                                      setMode('submitted');
                                      return;
                                    }
                                    setQuizIndex((v) => Math.min(questions.length - 1, v + 1));
                                  }}
                                  disabled={selected === null || selected === undefined}
                                  className="h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                                >
                                  {quizIndex + 1 >= questions.length ? 'Submit Quiz' : 'Next'}
                                  {quizIndex + 1 < questions.length && <ArrowRight className="w-4 h-4 ml-1 inline" />}
                                </button>
                              </div>

                              {/* Question dots */}
                              {renderQuestionDots(false)}
                            </motion.div>
                          </AnimatePresence>
                        );
                      })()}

                      {/* ── SUBMITTED mode ── */}
                      {mode === 'submitted' && quizDone && (
                        <div className="space-y-6">
                          {/* Score ring */}
                          <div className="flex flex-col items-center">
                            <div className="relative w-36 h-36">
                              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                                <motion.circle
                                  cx="50" cy="50" r="42" fill="none"
                                  stroke={scoreColor}
                                  strokeWidth="8"
                                  strokeLinecap="round"
                                  initial={{ strokeDasharray: '0 264' }}
                                  animate={{ strokeDasharray: `${(quizScore.correct / quizScore.total) * 264} 264` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-bold text-slate-100">{quizScore.correct}</span>
                                <span className="text-xs text-slate-400">/ {quizScore.total}</span>
                              </div>
                            </div>
                            <div className="mt-3 text-sm text-slate-300">
                              Score: <span className="font-semibold" style={{ color: scoreColor }}>{quizScore.pct}%</span>
                              <span className="mx-2 text-slate-500">•</span>
                              Answered: {quizScore.answered} / {quizScore.total}
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setQuizIndex(0); setMode('review'); }}
                              className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center justify-center gap-2 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              Review Answers
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setQuizAnswers(Array.from({ length: questions.length }).fill(null));
                                setQuizIndex(0);
                                setQuizDone(false);
                                setMode('quiz');
                                setSecondsLeft(totalSeconds || questions.length * 45);
                              }}
                              className="h-11 px-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center justify-center gap-2 transition-colors"
                            >
                              <RotateCcw className="w-4 h-4" />
                              Retake Quiz
                            </button>
                            <button
                              type="button"
                              onClick={onSaveQuestions}
                              disabled={saving || !questions.length}
                              className={`h-11 px-5 rounded-xl border inline-flex items-center justify-center gap-2 font-semibold disabled:opacity-50 transition-all duration-200 ${
                                hasSaved
                                  ? 'bg-emerald-600/15 border-emerald-400/30 text-emerald-300'
                                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 border-white/10 hover:border-white/20 text-white shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                              }`}
                            >
                              {hasSaved ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                              {saving ? 'Saving…' : hasSaved ? 'Saved & Downloaded' : 'Save & Download PDF'}
                            </button>
                          </div>

                          {/* Question dots colored by result */}
                          {renderQuestionDots(true)}
                        </div>
                      )}

                      {/* ── REVIEW mode ── */}
                      {mode === 'review' && (() => {
                        const q = questions[quizIndex];
                        const selected = quizAnswers[quizIndex];
                        const isCorrect = selected === q.correctIndex;
                        return (
                          <div className="space-y-4">
                            {/* Score summary bar */}
                            <div className="rounded-xl bg-black/20 border border-white/10 p-3 flex items-center justify-between">
                              <div className="text-sm text-slate-300">
                                Score: <span className="font-semibold" style={{ color: scoreColor }}>{quizScore.correct}/{quizScore.total}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setQuizIndex(0); setMode('submitted'); }}
                                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
                                >
                                  Back to Results
                                </button>
                              </div>
                            </div>

                            <AnimatePresence mode="wait">
                              <motion.div
                                key={quizIndex}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.25 }}
                                className="rounded-2xl border border-white/10 bg-black/10 p-5"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500">{q.topic || 'General'}</span>
                                    {isCorrect
                                      ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Correct</span>
                                      : selected !== null && selected !== undefined
                                        ? <span className="text-xs text-rose-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Incorrect</span>
                                        : <span className="text-xs text-slate-500">Not answered</span>
                                    }
                                  </div>
                                  <div className="text-xs text-slate-500">{quizIndex + 1} / {questions.length}</div>
                                </div>

                                <div className="text-base font-semibold text-slate-100 mt-3 leading-relaxed">{q.text}</div>

                                <div className="mt-5 grid grid-cols-1 gap-2">
                                  {q.options.map((opt, i) => {
                                    const optIsCorrect = i === q.correctIndex;
                                    const optIsSelected = selected === i;
                                    const optIsWrong = optIsSelected && !optIsCorrect;
                                    const cls = optIsCorrect
                                      ? 'bg-emerald-600/15 border-emerald-400/40 text-slate-100'
                                      : optIsWrong
                                        ? 'bg-rose-600/15 border-rose-400/40 text-slate-100'
                                        : 'bg-white/5 border-white/10 text-slate-300';
                                    return (
                                      <div
                                        key={`${q.id}-review-${i}`}
                                        className={`px-4 py-3 rounded-xl border text-left text-sm flex items-center gap-2 ${cls}`}
                                      >
                                        <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                                        <span className="flex-1">{opt}</span>
                                        {optIsCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                        {optIsWrong && <XCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Explanation */}
                                {q.explanation && (
                                  <div className="mt-4 rounded-xl bg-amber-600/5 border border-amber-400/15 p-4 flex items-start gap-3">
                                    <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-sm text-slate-300 leading-relaxed">{q.explanation}</p>
                                  </div>
                                )}

                                {/* Navigation */}
                                <div className="mt-6 flex items-center justify-between gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setQuizIndex((v) => Math.max(0, v - 1))}
                                    disabled={quizIndex === 0}
                                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-40 transition-colors"
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuizIndex((v) => Math.min(questions.length - 1, v + 1))}
                                    disabled={quizIndex >= questions.length - 1}
                                    className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 disabled:opacity-40 transition-colors"
                                  >
                                    Next
                                  </button>
                                </div>
                              </motion.div>
                            </AnimatePresence>

                            {/* Color-coded review dots */}
                            {renderQuestionDots(true)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </motion.div>

              <div className="mt-8">
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout modal */}
      <Modal open={confirmLogoutOpen} onClose={() => setConfirmLogoutOpen(false)}>
        <div className="p-6">
          <div className="text-lg font-semibold text-slate-100">Confirm Logout</div>
          <p className="text-sm text-slate-300 mt-2">Are you sure you want to logout?</p>
          <div className="mt-5 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setConfirmLogoutOpen(false)}
              className="h-10 px-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={logoutLoading}
              className="h-10 px-4 rounded-xl bg-rose-600/80 border border-rose-500/30 hover:bg-rose-600 text-white font-semibold disabled:opacity-60"
            >
              {logoutLoading ? 'Logging out…' : 'Logout'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default QuestionGenerator;
