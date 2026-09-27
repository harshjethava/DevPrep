import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  FileText,
  Code2,
  PlayCircle,
  Brain,
  User,
  ChevronDown,
  ArrowRight,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  GraduationCap,
  Wrench,
  FolderKanban,
  Trophy,
  Award,
  Terminal
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI, resumeAPI, mockInterviewAPI } from '../services/api';

/* ── constants ──────────────────────────────────────────────────────────── */

const ROLE_PRESETS = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'DevOps Engineer', 'Data Engineer', 'Data Scientist',
  'Machine Learning Engineer', 'Mobile Developer',
  'Cloud Engineer', 'Software Engineer'
];

/* ── component ──────────────────────────────────────────────────────────── */

const ResumeInterview = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  /* ── layout state ─────────────────────────────────────────────────── */
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);

  /* ── resume state ─────────────────────────────────────────────────── */
  const [resume, setResume] = useState(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  /* ── interview setup state ────────────────────────────────────────── */
  const [role, setRole] = useState('');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(30);
  const [starting, setStarting] = useState(false);

  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await signOut({ redirectUrl: '/login' });
    } catch (_) {
      toast.error('Failed to logout');
      setLogoutLoading(false);
    }
  };


  const displayName = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || (dbProfile && dbProfile.name) || 'User';

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

  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';

  /* ── effects ──────────────────────────────────────────────────────── */

  // Single effect: one getToken() call, profile + resume fetched in parallel.
  // Eliminates the null-token race that caused "Authorization: Bearer null" → 401.
  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const [profileRes, resumeRes] = await Promise.allSettled([
          clerkAPI.getProfile(token),
          resumeAPI.getResume(token),
        ]);

        if (profileRes.status === 'fulfilled') {
          setDbProfile(profileRes.value.data?.user || null);
        }

        if (resumeRes.status === 'fulfilled') {
          setResume(resumeRes.value.data?.resume || null);
        } else {
          const status = resumeRes.reason?.response?.status;
          if (status !== 404 && status !== 401) {
            console.error('Failed to fetch resume:', resumeRes.reason);
          }
          setResume(null);
        }
      } catch (_) {
        setResume(null);
      } finally {
        setResumeLoading(false);
      }
    })();
  }, [ready, getToken]);

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

  /* ── handlers ─────────────────────────────────────────────────────── */

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }

    if (!ready) { toast.info('Loading session… try again'); return; }
    const token = await getToken();
    if (!token) { toast.error('Not authenticated'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await resumeAPI.upload(token, formData);
      const uploaded = res.data?.resume;
      if (!uploaded) return;

      // Upload response always returns extractionStatus='pending' because
      // AI extraction runs asynchronously after the response is sent.
      // Poll GET /api/resume until status resolves (up to 30s, every 2s).
      setResume(uploaded);

      if (uploaded.extractionStatus === 'pending') {
        toast.info('Resume uploaded. Analyzing with AI…');
        let attempts = 0;
        const maxAttempts = 15; // 15 × 2s = 30s max

        const pollToken = await getToken();
        const poll = setInterval(async () => {
          attempts++;
          try {
            const pollRes = await resumeAPI.getResume(pollToken);
            const fresh = pollRes.data?.resume;
            if (fresh && fresh.extractionStatus !== 'pending') {
              clearInterval(poll);
              setResume(fresh);
              if (fresh.extractionStatus === 'success') {
                toast.success('Resume analyzed successfully! Ready to start interview.');
              } else {
                toast.warning('Resume uploaded but AI extraction failed. You can still start an interview.');
              }
            } else if (attempts >= maxAttempts) {
              clearInterval(poll);
              // Timed out — show latest state
              if (fresh) setResume(fresh);
              toast.warning('Resume uploaded. AI analysis is taking longer than expected.');
            }
          } catch (_) {
            // Ignore poll errors — keep trying until maxAttempts
            if (attempts >= maxAttempts) clearInterval(poll);
          }
        }, 2000);
      } else if (uploaded.extractionStatus === 'success') {
        toast.success('Resume uploaded and analyzed successfully');
      } else {
        toast.warning('Resume uploaded but extraction failed. You can still try starting an interview.');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to upload resume';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    handleFileUpload(file);
  };

  const handleDeleteResume = async () => {
    if (!resume) return;
    const resumeId = resume.id || resume._id;
    if (!resumeId) return;

    if (!ready) return;
    const token = await getToken();
    if (!token) return;

    try {
      await resumeAPI.deleteResume(token, resumeId);
      setResume(null);
      toast.success('Resume deleted');
    } catch (err) {
      toast.error('Failed to delete resume');
    }
  };

  const handleStartInterview = async () => {
    if (starting || !resume) return;
    const resumeId = resume.id || resume._id;

    if (!ready) { toast.info('Loading session… try again'); return; }
    const token = await getToken();
    if (!token) { toast.error('Not authenticated'); return; }

    setStarting(true);
    try {
      const payload = {
        interviewType: 'resume-based',
        role: role.trim() || 'Software Developer',
        difficulty,
        duration,
        selectedTopics: extractedSkillTopics,
        resumeId
      };
      const res = await mockInterviewAPI.start(token, payload);
      const session = res.data?.session;
      if (session && session._id) {
        navigate(`/interview/mock/${session._id}`);
      } else {
        throw new Error('No session returned');
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to start interview';
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  /* ── derived data ─────────────────────────────────────────────────── */

  const ed = resume?.extractedData || {};
  const skills = ed.skills || [];
  const projects = ed.projects || [];
  const experience = ed.experience || [];
  const education = ed.education || [];
  const awards = ed.awards || [];
  const certifications = ed.certifications || [];
  const competitiveProgramming = ed.competitiveProgramming || [];
  const hasData = skills.length > 0 || projects.length > 0 || experience.length > 0 || education.length > 0 || awards.length > 0 || certifications.length > 0 || competitiveProgramming.length > 0;
  const extractedSkillTopics = skills.slice(0, 5);
  const canStart = Boolean(resume) && (resume.extractionStatus === 'success');

  // Auto-set role from experience if available
  useEffect(() => {
    if (experience.length > 0 && !role) {
      const firstTitle = experience[0]?.title || '';
      if (firstTitle) {
        // Try to auto-detect role from first experience entry
        const match = ROLE_PRESETS.find((r) => firstTitle.toLowerCase().includes(r.toLowerCase().split(' ')[0].toLowerCase()));
        if (match) setRole(match);
      }
    }
  }, [experience, role]);

  /* ── render ──────────────────────────────────────────────────────── */
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
                    activeLabel="Resume"
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
                <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
                  {/* Left column — Upload + Setup */}
                  <div className="lg:col-span-7">
                    <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                      <div className="text-sm font-semibold text-slate-200 flex items-center gap-2 mb-5">
                        <FileText className="w-4 h-4 text-cyan-400" />
                        Resume Interview
                      </div>

                      <div className="max-h-[500px] overflow-y-auto pr-2">
                        {/* Upload zone (if no resume) */}
                        {!resume ? (
                          <div
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={handleDrop}
                            className={`relative rounded-2xl border-2 border-dashed transition-all duration-300 p-12 text-center cursor-pointer ${
                              dragActive
                                ? 'border-cyan-400/50 bg-cyan-600/10'
                                : 'border-white/15 bg-black/10 hover:border-white/25 hover:bg-white/5'
                            }`}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf"
                              className="hidden"
                              onChange={(e) => handleFileUpload(e.target.files?.[0])}
                            />

                            {uploading ? (
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-400/20 flex items-center justify-center">
                                  <Upload className="w-6 h-6 text-cyan-400 animate-bounce" />
                                </div>
                                <div className="text-sm text-slate-300">Uploading resume…</div>
                                <div className="text-xs text-slate-500">Please wait</div>
                              </div>
                            ) : resumeLoading ? (
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white/5 animate-pulse" />
                                <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-3">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-white/10 flex items-center justify-center">
                                  <Upload className="w-7 h-7 text-slate-300" />
                                </div>
                                <div className="text-sm font-medium text-slate-200">Drop your resume PDF here</div>
                                <div className="text-xs text-slate-400">or click to browse • PDF only, max 5MB</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            {/* Resume file info card — 4 distinct states */}
                            {(() => {
                              const isPending = resume.extractionStatus === 'pending';
                              const isSuccess = resume.extractionStatus === 'success';
                              const isFailed  = resume.extractionStatus === 'failed';

                              const cardClass = isPending
                                ? 'from-amber-600/10 to-yellow-600/5 border-amber-400/20'
                                : isSuccess
                                  ? 'from-emerald-600/10 to-cyan-600/10 border-emerald-400/20'
                                  : 'from-rose-600/10 to-red-600/5 border-rose-400/20';

                              const iconWrapClass = isPending
                                ? 'bg-amber-600/20 border-amber-400/20'
                                : isSuccess
                                  ? 'bg-emerald-600/20 border-emerald-400/20'
                                  : 'bg-rose-600/20 border-rose-400/20';

                              const subtitle = isPending
                                ? 'Analyzing resume with AI…'
                                : isSuccess
                                  ? `${skills.length} skills • ${experience.length} experiences • ${projects.length} projects`
                                  : 'Extraction failed — try uploading again';

                              const subtitleClass = isPending
                                ? 'text-amber-400/80'
                                : isSuccess
                                  ? 'text-slate-400'
                                  : 'text-rose-400/80';

                              return (
                                <div className={`flex items-center justify-between rounded-xl bg-gradient-to-r ${cardClass} border p-4 mb-5`}>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${iconWrapClass} border flex items-center justify-center flex-shrink-0`}>
                                      {isPending ? (
                                        /* Spinner for analyzing state */
                                        <svg className="w-5 h-5 text-amber-400 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                      ) : isSuccess ? (
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                      ) : (
                                        <AlertCircle className="w-5 h-5 text-rose-400" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-slate-200">{resume.fileName}</div>
                                      <div className={`text-xs mt-0.5 ${subtitleClass}`}>{subtitle}</div>
                                    </div>
                                  </div>
                                  {!isPending && (
                                    <button
                                      type="button"
                                      onClick={handleDeleteResume}
                                      className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:border-rose-400/30 hover:bg-rose-600/10 flex items-center justify-center transition-all"
                                    >
                                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-400" />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Interview setup form */}
                            {canStart && (
                              <div className="space-y-4">
                                {/* Target role */}
                                <div>
                                  <label className="block text-xs text-slate-400">Target Role</label>
                                  <div className="relative mt-2" ref={roleDropdownRef}>
                                    <button
                                      type="button"
                                      onClick={() => setRoleDropdownOpen((v) => !v)}
                                      className="w-full h-12 px-4 rounded-xl border border-white/10 bg-white/5 hover:border-white/20 text-left text-sm flex items-center justify-between transition-colors"
                                    >
                                      <span className={role ? 'text-slate-100' : 'text-slate-500'}>{role || 'Select a role'}</span>
                                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
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
                                <div>
                                  <label className="block text-xs text-slate-400">Difficulty Level</label>
                                  <div className="mt-2 grid grid-cols-3 gap-2">
                                    {[
                                      { value: 'easy', activeBg: 'bg-emerald-500/20 border-emerald-500 text-emerald-400' },
                                      { value: 'medium', activeBg: 'bg-yellow-500/20 border-yellow-500 text-yellow-400' },
                                      { value: 'hard', activeBg: 'bg-red-500/20 border-red-500 text-red-400' }
                                    ].map((d) => {
                                      const active = difficulty === d.value;
                                      return (
                                        <button
                                          key={d.value}
                                          type="button"
                                          onClick={() => setDifficulty(d.value)}
                                          className={`h-11 rounded-xl border text-sm font-semibold capitalize transition-all duration-200 ${
                                            active ? d.activeBg : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                          }`}
                                        >
                                          {d.value}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Duration */}
                                <div>
                                  <label className="block text-xs text-slate-400">Duration</label>
                                  <div className="mt-2 grid grid-cols-4 gap-2">
                                    {[15, 30, 45, 60].map((d) => {
                                      const active = duration === d;
                                      return (
                                        <button
                                          key={d}
                                          type="button"
                                          onClick={() => setDuration(d)}
                                          className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                                            active
                                              ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                                              : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                          }`}
                                        >
                                          {d} min
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Start button */}
                                <div className="pt-5 border-t border-white/10 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={handleStartInterview}
                                    disabled={starting || !canStart}
                                    className="w-full sm:w-auto h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                                  >
                                    <PlayCircle className={`w-5 h-5 ${starting ? 'animate-spin' : ''}`} />
                                    {starting ? 'Starting Interview…' : 'Start Resume Interview'}
                                    {!starting && <ArrowRight className="w-4 h-4" />}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Extraction failed — show retry / re-upload option */}
                            {resume.extractionStatus === 'failed' && (
                              <div className="mt-4 rounded-xl bg-amber-600/10 border border-amber-400/20 p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                  <div className="text-sm text-amber-200 font-medium">Extraction failed</div>
                                  <div className="text-xs text-amber-300/80 mt-1">
                                    We couldn't extract data from your resume. Try deleting and uploading again with a properly formatted PDF.
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right column — Extracted resume preview */}
                  <div className="lg:col-span-3">
                    <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                      <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-cyan-400" />
                        Resume Analysis
                      </div>

                      {resumeLoading ? (
                        <div className="mt-4 space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                          ))}
                        </div>
                      ) : !resume || !hasData ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
                          <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                          <p className="text-sm text-slate-400 mt-2">No resume data</p>
                          <p className="text-xs text-slate-500 mt-1">Upload a PDF to see extracted skills, experience, and projects</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4 max-h-[500px] overflow-y-auto pr-1">
                          {/* Skills */}
                          {skills.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Wrench className="w-3 h-3" /> Skills ({skills.length})
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {skills.map((s, i) => (
                                  <span key={i} className="px-2.5 py-1 rounded-lg bg-cyan-600/10 border border-cyan-400/20 text-xs text-cyan-300">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Experience */}
                          {experience.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Briefcase className="w-3 h-3" /> Experience ({experience.length})
                              </div>
                              <div className="space-y-2">
                                {experience.map((e, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{e.title}</div>
                                    {e.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{e.description}</div>}
                                    {(e.startDate || e.endDate) && (
                                      <div className="text-xs text-slate-500 mt-1">{e.startDate}{e.endDate ? ` — ${e.endDate}` : ''}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Projects */}
                          {projects.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <FolderKanban className="w-3 h-3" /> Projects ({projects.length})
                              </div>
                              <div className="space-y-2">
                                {projects.map((p, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{p.title}</div>
                                    {p.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{p.description}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Education */}
                          {education.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <GraduationCap className="w-3 h-3" /> Education ({education.length})
                              </div>
                              <div className="space-y-2">
                                {education.map((e, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{e.title}</div>
                                    {e.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{e.description}</div>}
                                    {(e.startDate || e.endDate) && (
                                      <div className="text-xs text-slate-500 mt-1">{e.startDate}{e.endDate ? ` — ${e.endDate}` : ''}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Awards */}
                          {awards.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Trophy className="w-3 h-3 text-yellow-500" /> Awards & Achievements ({awards.length})
                              </div>
                              <div className="space-y-2">
                                {awards.map((a, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{a.title}</div>
                                    {a.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{a.description}</div>}
                                    {(a.startDate || a.endDate) && (
                                      <div className="text-xs text-slate-500 mt-1">{a.startDate}{a.endDate ? ` — ${a.endDate}` : ''}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Certifications */}
                          {certifications.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Award className="w-3 h-3 text-emerald-400" /> Certifications ({certifications.length})
                              </div>
                              <div className="space-y-2">
                                {certifications.map((c, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{c.title}</div>
                                    {c.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{c.description}</div>}
                                    {(c.startDate || c.endDate) && (
                                      <div className="text-xs text-slate-500 mt-1">{c.startDate}{c.endDate ? ` — ${c.endDate}` : ''}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Competitive Programming */}
                          {competitiveProgramming.length > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                                <Terminal className="w-3 h-3 text-rose-400" /> Competitive Programming ({competitiveProgramming.length})
                              </div>
                              <div className="space-y-2">
                                {competitiveProgramming.map((cp, i) => (
                                  <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                                    <div className="text-xs font-medium text-slate-200">{cp.title}</div>
                                    {cp.description && <div className="text-xs text-slate-400 mt-1 line-clamp-2">{cp.description}</div>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="mt-8">
                <Footer onNavigate={safeNavigate} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout modal */}
      <Modal
        open={confirmLogoutOpen}
        title="Confirm Logout"
        onClose={() => setConfirmLogoutOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
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
        }
      >
        Are you sure you want to logout? You will need to sign in again to access your dashboard.
      </Modal>
    </div>
  );
};

export default ResumeInterview;
