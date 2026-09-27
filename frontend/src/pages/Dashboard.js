import { useEffect, useMemo, useRef, useState } from 'react';

import { motion } from 'framer-motion';

import { useNavigate } from 'react-router-dom';

import { toast } from 'sonner';

import { useClerk, useUser } from '@clerk/clerk-react';
import { useReadyAuth } from '../hooks/useReadyAuth';

import {

  LayoutDashboard,

  FileText,

  Code2,

  PlayCircle,

  BookOpen,

  Brain,

  ChevronRight,

  User

} from 'lucide-react';

import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';

import Navbar from '../components/layout/Navbar';

import Sidebar from '../components/layout/Sidebar';

import Footer from '../components/layout/Footer';

import Modal from '../components/ui/Modal';

import { clerkAPI, questionsAPI, analyticsAPI } from '../services/api';



const Dashboard = () => {

  const navigate = useNavigate();

  const { ready, getToken } = useReadyAuth();
  const { user } = useUser();

  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");

  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const [logoutLoading, setLogoutLoading] = useState(false);

  const [dbProfile, setDbProfile] = useState(null);

  const [savedStats, setSavedStats] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  const [interviewOverview, setInterviewOverview] = useState(null);

  const didSyncRef = useRef(false);



  const [recentActivity, setRecentActivity] = useState([]);

  // Single effect: one getToken() call, all data fetched in parallel.
  // Replaces the previous 4 separate useEffects that each called getToken()
  // independently, causing 4 sequential token refreshes on every mount.
  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Fire sync (once-per-mount guard) + all data fetches in parallel
        const [, savedRes, profileRes, overviewRes, recentRes] = await Promise.allSettled([
          // syncMe: only runs once per mount via didSyncRef
          didSyncRef.current ? Promise.resolve() : clerkAPI.syncMe(token).finally(() => { didSyncRef.current = true; }),
          questionsAPI.getSavedStats(token),
          clerkAPI.getProfile(token),
          analyticsAPI.getOverview(token),
          analyticsAPI.getRecentActivity(token)
        ]);

        if (savedRes.status === 'fulfilled') {
          setSavedStats(savedRes.value.data || null);
        }
        if (profileRes.status === 'fulfilled') {
          setDbProfile(profileRes.value.data?.user || null);
        }
        if (overviewRes.status === 'fulfilled') {
          setInterviewOverview(overviewRes.value.data?.overview || null);
        }
        if (recentRes.status === 'fulfilled') {
          setRecentActivity(recentRes.value.data?.activity || []);
        }
      } catch (_) { } finally { setDataLoading(false); }
    })();
  }, [ready]);



  const displayName =

    user?.fullName ||

    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||

    user?.username ||

    (dbProfile && dbProfile.name) ||

    'User';







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



  // All routes are real — use navigate() directly

  const safeNavigate = (path) => {

    if (path === '/logout') {

      setConfirmLogoutOpen(true);

      return;

    }

    navigate(path);

  };



  const modules = [

    {

      title: 'Question Generator',

      desc: 'Create practice sets by topic',

      Icon: Brain,

      gradient: 'from-cyan-600/25 to-violet-600/10',

      path: '/questions/generate'

    },

    {

      title: 'Mock Interview',

      desc: 'Start a new interview session',

      Icon: PlayCircle,

      gradient: 'from-violet-600/25 to-indigo-600/10',

      path: '/interview/mock'

    },

    {

      title: 'Resume Interview',

      desc: 'Interview based on your resume',

      Icon: FileText,

      gradient: 'from-cyan-600/25 to-indigo-600/10',

      path: '/interview/resume'

    },

    {

      title: 'Coding Practice',

      desc: 'DSA, patterns, and solutions',

      Icon: Code2,

      gradient: 'from-violet-600/25 to-cyan-600/10',

      path: '/coding/practice'

    }

  ];



  const actions = [

    {

      title: 'Generate Questions',

      desc: 'AI-curated practice set',

      Icon: Brain,

      gradient: 'from-cyan-600/25 to-violet-600/10',

      path: '/questions/generate'

    },

    {

      title: 'Start Mock Interview',

      desc: 'Timed + feedback loop',

      Icon: PlayCircle,

      gradient: 'from-violet-600/25 to-indigo-600/10',

      path: '/interview/mock'

    },

    {

      title: 'Resume Interview',

      desc: 'Interview from your resume',

      Icon: FileText,

      gradient: 'from-cyan-600/25 to-indigo-600/10',

      path: '/interview/resume'

    },

    {

      title: 'Coding Practice',

      desc: 'DSA + patterns',

      Icon: Code2,

      gradient: 'from-violet-600/25 to-cyan-600/10',

      path: '/coding/practice'

    }

  ];







  



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

                    activeLabel="Dashboard"

                    links={navbarLinks}

                    onNavigate={safeNavigate}

                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}

                    avatarUrl={(dbProfile && dbProfile.avatar) || user?.imageUrl || ''}

                    onLogout={() => setConfirmLogoutOpen(true)}

                  />

                </div>

              </div>



              <motion.div

                initial={{ opacity: 0, y: 8 }}

                animate={{ opacity: 1, y: 0 }}

                transition={{ duration: 0.6 }}

                className="mt-6 relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]"

              >

                <div className="absolute inset-0">

                  <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />

                  <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/15 blur-3xl" />

                </div>



                <div className="relative p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center gap-5">

                  <div className="min-w-0">

                    <div className="text-sm text-slate-300">Welcome back</div>
                    {dataLoading ? (
                      <div className="mt-2 h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
                    ) : (
                      <div className="text-2xl sm:text-3xl font-semibold mt-1 truncate">
                        {displayName}
                      </div>
                    )}
                    <div className="text-sm text-slate-400 mt-2">

                      Pick up where you left off — or start a new session.

                    </div>

                    {dataLoading ? (
                      <div className="mt-3 flex items-center gap-2">
                        <div className="h-4 w-32 bg-white/10 rounded animate-pulse" />
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 mt-3">
                        Saved questions: <span className="font-semibold text-slate-200">{Number(savedStats?.totalSaved) || 0}</span>
                      </div>
                    )}

                  </div>



                  <div className="sm:ml-auto flex items-center gap-3">

                    <motion.button

                      type="button"

                      whileHover={{ y: -1 }}

                      whileTap={{ scale: 0.98 }}

                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"

                      onClick={() => safeNavigate('/questions/generate')}

                    >

                      Generate questions

                    </motion.button>

                    <motion.button

                      type="button"

                      whileHover={{ y: -1 }}

                      whileTap={{ scale: 0.98 }}

                      className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"

                      onClick={() => safeNavigate('/interview/mock')}

                    >

                      Start mock

                    </motion.button>

                  </div>

                </div>

              </motion.div>



              <motion.div

                initial={{ opacity: 0, y: 10 }}

                animate={{ opacity: 1, y: 0 }}

                transition={{ duration: 0.6, delay: 0.05 }}

                className="mt-6 grid grid-cols-1 lg:grid-cols-10 gap-6"

              >

                <div className="lg:col-span-7 space-y-6">

                  <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5">

                    <div className="flex items-center justify-between">

                      <div>

                        <div className="text-lg font-semibold">Modules</div>

                        <div className="text-sm text-slate-400 mt-1">Access key parts of the app from one place</div>

                      </div>

                    </div>



                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {modules.map(({ title, desc, Icon, gradient, path }, i) => (

                        <motion.button

                          key={title}

                          type="button"

                          initial={{ opacity: 0, y: 10 }}

                          animate={{ opacity: 1, y: 0 }}

                          transition={{ duration: 0.5, delay: 0.08 + i * 0.05 }}

                          whileHover={{ scale: 1.01, y: -2 }}

                          whileTap={{ scale: 0.99 }}

                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"

                          onClick={() => {

                            safeNavigate(path);

                          }}

                        >

                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

                          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white/5" />

                          <div className="relative flex items-start gap-3">

                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">

                              <Icon className="w-5 h-5 text-white" />

                            </div>

                            <div className="min-w-0">

                              <div className="font-semibold">{title}</div>

                              <div className="text-sm text-slate-400 mt-1">{desc}</div>

                              <div className="text-xs text-slate-500 mt-2">{path}</div>

                            </div>

                            <div className="ml-auto pt-1 text-slate-300">

                              <ChevronRight className="w-4 h-4" />

                            </div>

                          </div>

                        </motion.button>

                      ))}

                    </div>

                  </div>



                  <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5">

                    <div className="flex items-center justify-between">

                      <div>

                        <div className="text-lg font-semibold">Quick Actions</div>

                        <div className="text-sm text-slate-400 mt-1">Jump back in with your next best step</div>

                      </div>

                      <button type="button" className="text-sm text-cyan-300 hover:text-cyan-200 flex items-center gap-1">

                        View all

                        <ChevronRight className="w-4 h-4" />

                      </button>

                    </div>



                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">

                      {actions.map(({ title, desc, Icon, gradient, path }, i) => (

                        <motion.button

                          key={title}

                          type="button"

                          initial={{ opacity: 0, y: 10 }}

                          animate={{ opacity: 1, y: 0 }}

                          transition={{ duration: 0.5, delay: 0.18 + i * 0.06 }}

                          whileHover={{ scale: 1.01, y: -2 }}

                          whileTap={{ scale: 0.99 }}

                          className="text-left relative overflow-hidden rounded-2xl p-4 bg-white/5 border border-white/10 hover:border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"

                          onClick={() => {

                            safeNavigate(path);

                          }}

                        >

                          <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />

                          <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white/5" />

                          <div className="relative flex items-start gap-3">

                            <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">

                              <Icon className="w-5 h-5 text-white" />

                            </div>

                            <div className="min-w-0">

                              <div className="font-semibold">{title}</div>

                              <div className="text-sm text-slate-400 mt-1">{desc}</div>

                            </div>

                          </div>

                        </motion.button>

                      ))}

                    </div>

                  </div>

                </div>



                <div className="lg:col-span-3 relative h-[500px] lg:h-auto">
                  <div className="lg:absolute inset-0 h-full">
                    <div className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5 h-full flex flex-col">
                      <div className="flex items-center justify-between flex-shrink-0">
                        <div>
                          <div className="text-lg font-semibold">Recent Activity</div>
                          <div className="text-sm text-slate-400 mt-1">Last saved items</div>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3 flex-1 overflow-y-auto pr-1">
                      {dataLoading ? (
                        [1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
                            <div className="h-4 w-3/4 bg-white/10 rounded animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                            <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse mt-2" style={{ animationDelay: `${i * 100}ms` }} />
                          </div>
                        ))
                      ) : recentActivity.length ? (
                        recentActivity.map((item, i) => {
                          let Icon = Brain;
                          let iconClass = 'text-emerald-200';
                          let bgClass = 'from-emerald-600/25 to-teal-600/10';
                          if (item.type === 'mock') {
                            Icon = PlayCircle; iconClass = 'text-violet-200'; bgClass = 'from-violet-600/25 to-indigo-600/10';
                          } else if (item.type === 'resume') {
                            Icon = FileText; iconClass = 'text-cyan-200'; bgClass = 'from-cyan-600/25 to-blue-600/10';
                          } else if (item.type === 'coding') {
                            Icon = Code2; iconClass = 'text-amber-200'; bgClass = 'from-amber-600/25 to-orange-600/10';
                          }
                          return (
                            <motion.div
                              key={item.title + i}
                              initial={{ opacity: 0, x: 6 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ duration: 0.35, delay: i * 0.05 }}
                              whileHover={{ x: 2 }}
                              className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 px-3 py-2 shrink-0"
                            >
                              <div className={`w-9 h-9 rounded-lg bg-gradient-to-r ${bgClass} border border-white/10 flex items-center justify-center shrink-0`}>
                                <Icon className={`w-4 h-4 ${iconClass}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-200 truncate">{item.title}</div>
                                <div className="text-xs text-slate-400 mt-0.5 truncate">{item.meta}</div>
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-4 text-sm text-slate-400 shrink-0">
                          No recent activity yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </div>

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

            <button

              type="button"

              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200"

              onClick={() => setConfirmLogoutOpen(false)}

            >

              Cancel

            </button>

            <button

              type="button"

              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"

              onClick={handleLogout}

            >

              Logout

            </button>

          </div>

        }

      >

        Are you sure you want to logout? You will need to sign in again to access your dashboard.

      </Modal>

    </div>

  );

};



export default Dashboard;

