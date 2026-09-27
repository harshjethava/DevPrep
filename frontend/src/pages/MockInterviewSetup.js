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
  Clock,
  Trophy,
  MessageSquare,
  ArrowRight,
  Briefcase
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI, mockInterviewAPI } from '../services/api';

const ROLE_PRESETS = [
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Data Engineer',
  'Machine Learning Engineer',
  'DevOps Engineer',
  'QA Engineer',
  'Product Manager',
  'Data Analyst',
  'Cloud Architect'
];

const TOPICS_MAP = {
  technical: [
    'Data Structures', 'Algorithms', 'System Design', 'Database',
    'API Design', 'Networking', 'Operating Systems', 'Security',
    'Cloud Computing', 'Microservices'
  ],
  hr: [
    'Leadership', 'Teamwork', 'Conflict Resolution', 'Communication',
    'Time Management', 'Career Goals', 'Culture Fit', 'Problem Solving',
    'Work Ethics', 'Adaptability'
  ],
  mixed: [
    'Data Structures', 'System Design', 'Leadership', 'Teamwork',
    'API Design', 'Communication', 'Problem Solving', 'Database',
    'Career Goals', 'Cloud Computing'
  ]
};

const MockInterviewSetup = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dbProfile, setDbProfile] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // Form state
  const [interviewType, setInterviewType] = useState('');
  const [role, setRole] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [duration, setDuration] = useState(null);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [starting, setStarting] = useState(false);

  // Role dropdown
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const roleDropdownRef = useRef(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const safeNavigate = (path) => {
    if (path === '/logout') {
      setConfirmLogoutOpen(true);
      return;
    }
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

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    (dbProfile && dbProfile.name) ||
    'User';

  const sidebarItems = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard', Icon: LayoutDashboard },
      { label: 'Profile', path: '/profile', Icon: User },
      { label: 'Question Generator', path: '/questions/generate', Icon: Brain },
      { label: 'Mock Interview', path: '/interview/mock', Icon: PlayCircle },
      { label: 'Resume Interview', path: '/interview/resume', Icon: FileText },
      { label: 'Coding Practice', path: '/coding/practice', Icon: Code2 }
    ],
    []
  );

  const navbarLinks = useMemo(
    () => [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Questions', path: '/questions/generate' },
      { label: 'Mock', path: '/interview/mock' },
      { label: 'Resume', path: '/interview/resume' },
      { label: 'Coding', path: '/coding/practice' }
    ],
    []
  );

  const availableTopics = useMemo(() => {
    return TOPICS_MAP[interviewType] || TOPICS_MAP.technical;
  }, [interviewType]);

  const toggleTopic = (t) => {
    setSelectedTopics((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    );
  };

  // Reset topics when interview type changes
  useEffect(() => {
    setSelectedTopics([]);
  }, [interviewType]);

  const canStart =
    Boolean(interviewType) &&
    Boolean(role.trim()) &&
    Boolean(difficulty) &&
    Boolean(duration);

  // Single effect: one getToken() call, profile + history fetched in parallel
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const [profileRes, historyRes] = await Promise.allSettled([
          clerkAPI.getProfile(token),
          mockInterviewAPI.getHistory(token),
        ]);

        if (profileRes.status === 'fulfilled') {
          setDbProfile(profileRes.value.data?.user || null);
        }
        if (historyRes.status === 'fulfilled') {
          setHistory(historyRes.value.data?.sessions || []);
        }
      } catch (_) { /* ignore */ } finally {
        setHistoryLoading(false);
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

  const handleStartInterview = async () => {
    if (starting || !canStart) return;
    setStarting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }
      const res = await mockInterviewAPI.start(token, {
        interviewType,
        role: role.trim(),
        difficulty,
        duration,
        selectedTopics
      });
      const sessionId = res.data?.session?._id;
      if (!sessionId) throw new Error('Failed to create session');
      toast.success('Interview started!');
      navigate(`/interview/mock/${sessionId}`);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to start interview';
      toast.error(msg);
    } finally {
      setStarting(false);
    }
  };

  const avatarUrl = (dbProfile && dbProfile.avatar) || user?.imageUrl || '';

  const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-400';
      case 'active': return 'text-amber-400';
      case 'abandoned': return 'text-rose-400';
      default: return 'text-slate-400';
    }
  };

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
                    activeLabel="Mock Interview"
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
                  {/* Setup form */}
                  <div className="lg:col-span-7">
                    <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                      <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-violet-400" />
                        Interview Setup
                      </div>

                      {/* Scrollable Form Area */}
                      <div className="mt-5 max-h-[500px] overflow-y-auto pr-2">
                        {/* Interview Type */}
                        <div>
                          <label className="block text-xs text-slate-400">Interview Type</label>
                          <div className="mt-2 grid grid-cols-3 gap-2">
                            {[
                              { value: 'technical', label: 'Technical' },
                              { value: 'hr', label: 'HR' },
                              { value: 'mixed', label: 'Mixed' }
                            ].map((t) => {
                              const active = interviewType === t.value;
                              return (
                                <button
                                  key={t.value}
                                  type="button"
                                  onClick={() => setInterviewType(t.value)}
                                  className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                                    active
                                      ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                                      : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                  }`}
                                >
                                  {t.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Role */}
                        <div className="mt-4">
                          <label className="block text-xs text-slate-400">Target Role</label>
                          <div className="mt-2 relative" ref={roleDropdownRef}>
                            <button
                              type="button"
                              onClick={() => setRoleDropdownOpen((v) => !v)}
                              className="w-full h-11 px-4 rounded-xl bg-black/20 border border-white/10 hover:border-white/20 text-slate-100 inline-flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-violet-500/35"
                            >
                              <span className={role ? 'text-slate-100' : 'text-slate-400'}>
                                {role || 'Select a role'}
                              </span>
                              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
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
                            {[
                              { value: 'easy', label: 'Easy' },
                              { value: 'medium', label: 'Medium' },
                              { value: 'hard', label: 'Hard' }
                            ].map((d) => {
                              const active = difficulty === d.value;
                              const activeColors = {
                                easy: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                                medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
                                hard: 'bg-red-500/20 border-red-500 text-red-400'
                              };
                              return (
                                <button
                                  key={d.value}
                                  type="button"
                                  onClick={() => setDifficulty(d.value)}
                                  className={`h-11 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                                    active
                                      ? activeColors[d.value]
                                      : 'bg-white/5 border-white/10 hover:border-white/20 text-slate-300'
                                  }`}
                                >
                                  {d.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="mt-4">
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

                        {/* Topics */}
                        <div className="mt-4">
                          <label className="block text-xs text-slate-400">
                            Topic Preferences <span className="text-slate-500">(optional — select any)</span>
                          </label>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableTopics.map((t) => {
                              const active = selectedTopics.includes(t);
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

                        {/* Start button */}
                        <div className="mt-6 pt-5 border-t border-white/10 flex justify-end">
                          <button
                            type="button"
                            onClick={handleStartInterview}
                            disabled={starting || !canStart}
                            className="w-full sm:w-auto h-11 px-8 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_20px_rgba(139,92,246,0.2)] hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
                          >
                            <PlayCircle className={`w-5 h-5 ${starting ? 'animate-spin' : ''}`} />
                            {starting ? 'Starting Interview…' : 'Start Interview'}
                            {!starting && <ArrowRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* History sidebar */}
                  <div className="lg:col-span-3">
                    <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-6">
                      <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-cyan-400" />
                        Past Interviews
                      </div>

                      {historyLoading ? (
                        <div className="mt-4 space-y-3">
                          {[1, 2, 3].map((i) => (
                            <div key={i} className="rounded-xl border border-white/10 bg-black/10 p-3">
                              <div className="flex items-center justify-between gap-2">
                                <div className="h-4 w-28 bg-white/10 rounded animate-pulse" />
                                <div className="h-3 w-12 bg-white/10 rounded animate-pulse" />
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="h-3 w-10 bg-white/5 rounded animate-pulse" />
                                <div className="h-3 w-12 bg-white/5 rounded animate-pulse" />
                              </div>
                              <div className="h-3 w-20 bg-white/5 rounded animate-pulse mt-2.5" />
                            </div>
                          ))}
                        </div>
                      ) : history.length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-center">
                          <MessageSquare className="w-8 h-8 text-slate-500 mx-auto" />
                          <p className="text-sm text-slate-400 mt-2">No interviews yet</p>
                          <p className="text-xs text-slate-500 mt-1">Start your first mock interview!</p>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto pr-1">
                          {history.map((s) => (
                            <button
                              key={s._id}
                              type="button"
                              onClick={() => safeNavigate(`/interview/mock/${s._id}`)}
                              className="w-full text-left rounded-xl border border-white/10 bg-black/10 hover:bg-white/5 hover:border-white/20 p-3 transition-all duration-200 group"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-200 capitalize truncate">
                                  {s.interviewType} • {s.role}
                                </span>
                                <span className={`text-xs capitalize ${getStatusColor(s.status)}`}>
                                  {s.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-400 capitalize">{s.difficulty}</span>
                                <span className="text-xs text-slate-500">•</span>
                                <span className="text-xs text-slate-400">{s.duration} min</span>
                                {s.evaluation?.overallScore != null && (
                                  <>
                                    <span className="text-xs text-slate-500">•</span>
                                    <span className="text-xs text-cyan-400 flex items-center gap-1">
                                      <Trophy className="w-3 h-3" />
                                      {s.evaluation.overallScore}%
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">{formatDate(s.createdAt)}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="mt-8">
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout confirmation modal */}
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

export default MockInterviewSetup;
