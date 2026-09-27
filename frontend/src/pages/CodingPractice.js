import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';
import {
  LayoutDashboard,
  FileText,
  Code2,
  PlayCircle,
  Brain,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Filter,
  ArrowUpDown,
  User,
  X
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { codingAPI, clerkAPI } from '../services/api';

const CATEGORIES = [
  'All',
  'Implementation',
  'Math',
  'Greedy',
  'Dynamic Programming',
  'Strings',
  'Graphs',
  'Data Structures',
  'Binary Search',
  'Sorting',
  'Brute Force',
  'Trees',
  'Two Pointers',
  'Constructive',
  'Bit Manipulation',
  'Divide and Conquer',
  'Game Theory'
];

const DIFFICULTIES = ['All', 'easy', 'medium', 'hard'];
const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'difficulty', label: 'Difficulty' },
  { value: 'popularity', label: 'Popularity' }
];

const difficultyColors = {
  easy: 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
  medium: 'bg-yellow-500/20 border-yellow-500 text-yellow-400',
  hard: 'bg-red-500/20 border-red-500 text-red-400'
};

const statusIcons = {
  accepted: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  attempted: <Clock className="w-4 h-4 text-amber-400" />,
  not_attempted: null
};

const CodingPractice = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ready, getToken } = useReadyAuth();
  const { user } = useUser();
  const { signOut } = useClerk();

  const [problems, setProblems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // search = raw input value (drives the input UI immediately)
  // debouncedSearch = debounced value that actually triggers the API call
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('q') || '');
  const [difficulty, setDifficulty] = useState(searchParams.get('difficulty') || 'All');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [sort, setSort] = useState(searchParams.get('sort') || 'recent');
  const [page, setPage] = useState(parseInt(searchParams.get('page'), 10) || 1);

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [dbProfile, setDbProfile] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const searchTimerRef = useRef(null);

  // Fetch db profile
  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await clerkAPI.getProfile(token);
        setDbProfile(res.data?.user || null);
      } catch (_) {}
    })();
  }, [ready, getToken]);

  // Debounce: update debouncedSearch 350ms after the user stops typing
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // reset to page 1 when search changes
    }, 350);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  const fetchProblems = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;

      const params = { page, limit: 20, sort };
      if (difficulty !== 'All') params.difficulty = difficulty;
      if (category !== 'All') params.category = category;
      if (debouncedSearch.trim()) params.q = debouncedSearch.trim();

      const res = await codingAPI.listProblems(token, params);
      setProblems(res.data.problems || []);
      setPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load problems');
      toast.error('Failed to load problems');
    } finally {
      setLoading(false);
    }
  }, [ready, getToken, page, sort, difficulty, category, debouncedSearch]);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  // Sync filters to URL
  useEffect(() => {
    const params = {};
    if (search) params.q = search;
    if (difficulty !== 'All') params.difficulty = difficulty;
    if (category !== 'All') params.category = category;
    if (sort !== 'recent') params.sort = sort;
    if (page > 1) params.page = String(page);
    setSearchParams(params, { replace: true });
  }, [search, difficulty, category, sort, page, setSearchParams]);

  const handleSearch = (value) => {
    setSearch(value);
    // debouncedSearch + page reset are handled by the useEffect above
  };

  const handleLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await signOut({ redirectUrl: '/login' });
    } catch (error) {
      toast.error('Failed to logout');
      setLogoutLoading(false);
    }
  };

  const safeNavigate = (path) => {
    if (path === '/logout') { setConfirmLogoutOpen(true); return; }
    navigate(path);
  };

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

  const displayName = user?.fullName || user?.username || (dbProfile && dbProfile.name) || 'User';

  const SkeletonCard = () => (
    <div className="w-full text-left grid grid-cols-1 sm:grid-cols-12 gap-2 px-5 py-3.5 border-b border-white/5">
      <div className="sm:col-span-1 flex items-center">
        <div className="w-4 h-4 rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="sm:col-span-5 flex items-center gap-2">
        <div className="h-4 bg-white/10 rounded animate-pulse w-48" />
      </div>
      <div className="sm:col-span-2 flex items-center">
        <div className="h-3 bg-white/10 rounded animate-pulse w-16" />
      </div>
      <div className="sm:col-span-2 flex items-center">
        <div className="h-4 bg-white/10 rounded animate-pulse w-12" />
      </div>
      <div className="sm:col-span-2 flex items-center">
        <div className="h-3 bg-white/10 rounded animate-pulse w-8" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0f172a] via-[#030712] to-[#020617] text-white overflow-clip relative">
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
              profile={{
                name: displayName,
                avatar: (dbProfile && dbProfile.avatar) || user?.imageUrl || ''
              }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand=""
                    activeLabel="Coding"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={(dbProfile && dbProfile.avatar) || user?.imageUrl || ''}
                    onLogout={() => setConfirmLogoutOpen(true)}
                  />
                </div>
              </div>



              {/* Search + Filters */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="mt-6 space-y-4"
              >
                {/* Search bar */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search problems by title, tag, or category..."
                      value={search}
                      onChange={(e) => handleSearch(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/25 transition-all"
                    />
                    {search && (
                      <button
                        onClick={() => { setSearch(''); setPage(1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition"
                      >
                        <X className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setShowFilters((v) => !v)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all ${
                      showFilters ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <Filter className="w-4 h-4" />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                  <div className="relative">
                    <select
                      value={sort}
                      onChange={(e) => { setSort(e.target.value); setPage(1); }}
                      className="appearance-none pl-8 pr-8 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50 cursor-pointer hover:border-white/20 transition-all"
                    >
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-gray-900 text-white">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Filters panel */}
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-4 space-y-4"
                  >
                    {/* Difficulty chips */}
                    <div>
                      <div className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Difficulty</div>
                      <div className="flex flex-wrap gap-2">
                        {DIFFICULTIES.map((d) => (
                          <button
                            key={d}
                            onClick={() => { setDifficulty(d); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              difficulty === d
                                ? d === 'All'
                                  ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                                  : difficultyColors[d]
                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                          >
                            {d === 'All' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category chips */}
                    <div>
                      <div className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">Category</div>
                      <div className="flex flex-wrap gap-2">
                        {CATEGORIES.map((c) => (
                          <button
                            key={c}
                            onClick={() => { setCategory(c); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              category === c
                                ? 'bg-violet-600/20 border-violet-500 text-violet-300'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>

              {/* Problem list */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="mt-6"
              >
                <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden max-h-[445px] overflow-y-auto">
                  {/* Table header */}
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-5 py-3 border-b border-white/10 text-xs text-slate-400 font-medium uppercase tracking-wider sticky top-0 bg-[#0b1220]/95 backdrop-blur-xl z-10">
                    <div className="col-span-1">Status</div>
                    <div className="col-span-5">Title</div>
                    <div className="col-span-2">Category</div>
                    <div className="col-span-2">Difficulty</div>
                    <div className="col-span-2">Acceptance</div>
                  </div>

                  {/* Loading skeletons */}
                  {loading && (
                    <div className="p-4 space-y-3">
                      {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
                    </div>
                  )}

                  {/* Error state */}
                  {!loading && error && (
                    <div className="p-8 text-center">
                      <div className="text-red-400 text-sm">{error}</div>
                      <button
                        onClick={fetchProblems}
                        className="mt-3 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 text-sm hover:bg-violet-600/30 transition"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Empty state */}
                  {!loading && !error && problems.length === 0 && (
                    <div className="p-10 text-center">
                      <Code2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <div className="text-slate-400 text-sm">No problems found</div>
                      <div className="text-slate-500 text-xs mt-1">
                        Try adjusting your filters or run the seed script to populate problems
                      </div>
                    </div>
                  )}

                  {/* Problem rows */}
                  {!loading && !error && problems.map((p, i) => (
                    <motion.button
                      key={p._id}
                      type="button"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: i * 0.02 }}
                      onClick={() => navigate(`/coding/challenge/${p._id}`)}
                      className="w-full text-left grid grid-cols-1 sm:grid-cols-12 gap-2 px-5 py-3.5 border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <div className="sm:col-span-1 flex items-center">
                        {statusIcons[p.userStatus] || <div className="w-4 h-4 rounded-full border border-white/20" />}
                      </div>
                      <div className="sm:col-span-5 flex items-center gap-2">
                        <span className="text-sm font-medium text-white group-hover:text-violet-300 transition-colors truncate">
                          {p.title}
                        </span>
                        {p.source === 'codeforces' && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600/20 text-blue-400 border border-blue-500/30">CF</span>
                        )}
                      </div>
                      <div className="sm:col-span-2 flex items-center">
                        <span className="text-xs text-slate-400 truncate">{p.category}</span>
                      </div>
                      <div className="sm:col-span-2 flex items-center">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${difficultyColors[p.difficulty] || 'bg-white/10 text-slate-300 border-white/20'}`}>
                          {p.difficulty ? p.difficulty.charAt(0).toUpperCase() + p.difficulty.slice(1) : 'Unknown'}
                        </span>
                      </div>
                      <div className="sm:col-span-2 flex items-center">
                        <span className="text-xs text-slate-400">{p.acceptanceRate || 0}%</span>
                      </div>
                    </motion.button>
                  ))}
                </div>

                {/* Pagination */}
                {!loading && pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Prev
                      </button>
                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (page <= 3) {
                            pageNum = i + 1;
                          } else if (page >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = page - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                                page === pageNum
                                  ? 'bg-violet-600/30 border border-violet-500/40 text-violet-200'
                                  : 'bg-white/5 border border-white/10 text-slate-400 hover:border-white/20'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        disabled={page >= pagination.totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>

              <Footer onNavigate={safeNavigate} />
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={confirmLogoutOpen}
        title="Confirm Logout"
        onClose={() => setConfirmLogoutOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-3">
            <button type="button" className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200" onClick={() => setConfirmLogoutOpen(false)}>Cancel</button>
            <button type="button" className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 border border-white/10 hover:border-white/20 font-semibold" onClick={handleLogout}>Logout</button>
          </div>
        }
      >
        Are you sure you want to logout?
      </Modal>
    </div>
  );
};

export default CodingPractice;
