import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
  Shield,
  BarChart3,
  PencilLine,
  ChevronRight
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import ProfileAnalytics from '../components/ProfileAnalytics';
import ProfileInsightsPanel from '../components/ProfileInsightsPanel';
import { clerkAPI, questionsAPI, analyticsAPI } from '../services/api';

const Profile = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [dbProfile, setDbProfile]   = useState(null);
  const [savedStats, setSavedStats] = useState(null);
  const [interviewStats, setInterviewStats] = useState(null);
  const [profileInsights, setProfileInsights] = useState(null);
  const [clerkToken, setClerkToken] = useState(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading]         = useState(false);
  const [dataLoading, setDataLoading]             = useState(true);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';

  const email = user?.primaryEmailAddress?.emailAddress || '';

  /* ── Fetch profile + stats on mount ── */
  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Store token for <ProfileAnalytics />
        setClerkToken(token);

        // Run all fetches in parallel
        const [profileRes, savedRes, overviewRes, insightsRes] = await Promise.allSettled([
          clerkAPI.getProfile(token),
          questionsAPI.getSavedStats(token),
          analyticsAPI.getOverview(token),
          analyticsAPI.getProfileInsights(token)
        ]);

        if (profileRes.status === 'fulfilled') {
          setDbProfile(profileRes.value.data?.user || null);
        }
        if (savedRes.status === 'fulfilled') {
          setSavedStats(savedRes.value.data || null);
        }
        if (overviewRes.status === 'fulfilled') {
          setInterviewStats(overviewRes.value.data?.overview || null);
        }
        if (insightsRes.status === 'fulfilled') {
          setProfileInsights(insightsRes.value.data?.insights || null);
        }
      } catch (_) {
        // Non-fatal – display shows zeros / fallbacks
      } finally {
        setDataLoading(false);
      }
    })();
  }, [ready, getToken]);

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

  const profileData = useMemo(() => {
    const md = user?.publicMetadata || {};
    const experienceLevel =
      (dbProfile && dbProfile.experienceLevel) ||
      (typeof md.experienceLevel === 'string' ? md.experienceLevel : 'Beginner');
    const targetRole =
      (dbProfile && dbProfile.targetRole) ||
      (typeof md.targetRole === 'string' ? md.targetRole : 'Frontend Developer');
    const skills =
      (dbProfile && Array.isArray(dbProfile.skills) ? dbProfile.skills : null) ||
      (Array.isArray(md.skills) ? md.skills.filter((s) => typeof s === 'string') : ['React', 'JavaScript', 'DSA']);
    const bio    = (dbProfile && typeof dbProfile.bio    === 'string' ? dbProfile.bio    : '') || '';
    const avatar = (dbProfile && typeof dbProfile.avatar === 'string' ? dbProfile.avatar : '') || '';

    return { experienceLevel, targetRole, skills: skills.slice(0, 12), bio, avatar };
  }, [dbProfile, user]);

  const sidebarItems = useMemo(() => [
    { label: 'Dashboard',          path: '/dashboard',          Icon: LayoutDashboard },
    { label: 'Profile',            path: '/profile',            Icon: User            },
    { label: 'Question Generator', path: '/questions/generate', Icon: Brain           },
    { label: 'Mock Interview',     path: '/interview/mock',     Icon: PlayCircle      },
    { label: 'Resume Interview',   path: '/interview/resume',   Icon: FileText        },
    { label: 'Coding Practice',    path: '/coding/practice',    Icon: Code2           }
  ], []);

  const navbarLinks = useMemo(() => [
    { label: 'Dashboard', path: '/dashboard'          },
    { label: 'Questions',  path: '/questions/generate' },
    { label: 'Mock',       path: '/interview/mock'     },
    { label: 'Resume',     path: '/interview/resume'   },
    { label: 'Coding',     path: '/coding/practice'    }
  ], []);

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
              onNavigate={(path) => {
                if (path === '/logout') { setConfirmLogoutOpen(true); return; }
                navigate(path);
              }}
              profile={{ name: displayName, avatar: profileData.avatar || user?.imageUrl || '' }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand=""
                activeLabel="Profile"
                links={navbarLinks}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                avatarUrl={profileData.avatar || user?.imageUrl || ''}
                onLogout={() => setConfirmLogoutOpen(true)}
              />

              {/* ── Profile header card ── */}
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
                  <div className="flex items-center gap-4 min-w-0">
                    {dataLoading ? (
                      <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse border border-white/10" />
                    ) : profileData.avatar ? (
                      <img
                        src={profileData.avatar}
                        alt="Avatar"
                        className="w-14 h-14 rounded-2xl border border-white/10 object-cover"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 border border-white/10 flex items-center justify-center">
                        <span className="text-lg font-semibold text-white">
                          {(displayName?.[0] || 'U').toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      {dataLoading ? (
                        <>
                          <div className="h-8 w-48 bg-white/10 rounded-lg animate-pulse" />
                          <div className="h-4 w-32 bg-white/10 rounded animate-pulse mt-2" />
                        </>
                      ) : (
                        <>
                          <div className="text-xl sm:text-2xl font-semibold truncate">{displayName}</div>
                          <div className="text-sm text-slate-400 truncate">{email}</div>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="sm:ml-auto flex items-center gap-3">
                    <motion.button
                      type="button"
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold inline-flex items-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"
                      onClick={() => navigate('/profile/edit')}
                    >
                      <PencilLine className="w-4 h-4" />
                      Edit profile
                    </motion.button>
                  </div>
                </div>
              </motion.div>

              {/* ── Main grid ── */}
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-10 gap-6">
                {/* Left column: personal info + account settings */}
                <div className="lg:col-span-7 space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.05 }}
                    className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5"
                  >
                    <div className="text-lg font-semibold">Personal information</div>
                    <div className="text-sm text-slate-400 mt-1">Your core profile details</div>

                    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Name</div>
                        {dataLoading ? <div className="h-4 w-32 bg-white/10 rounded animate-pulse mt-1.5" /> : <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{displayName}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Email</div>
                        {dataLoading ? <div className="h-4 w-40 bg-white/10 rounded animate-pulse mt-1.5" /> : <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{email || '-'}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Experience level</div>
                        {dataLoading ? <div className="h-4 w-24 bg-white/10 rounded animate-pulse mt-1.5" /> : <div className="text-sm font-semibold text-slate-100 mt-1">{profileData.experienceLevel}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Target role</div>
                        {dataLoading ? <div className="h-4 w-32 bg-white/10 rounded animate-pulse mt-1.5" /> : <div className="text-sm font-semibold text-slate-100 mt-1 truncate">{profileData.targetRole}</div>}
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="text-xs text-slate-500">Skills</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {dataLoading ? (
                          [1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-7 w-20 bg-white/10 rounded-xl animate-pulse" />
                          ))
                        ) : profileData.skills.map((s) => (
                          <div key={s} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200">
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>

                    {(dataLoading || profileData.bio) && (
                      <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">About</div>
                        {dataLoading ? (
                          <div className="mt-2 space-y-2">
                            <div className="h-3 w-full bg-white/10 rounded animate-pulse" />
                            <div className="h-3 w-4/5 bg-white/10 rounded animate-pulse" />
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-slate-200 whitespace-pre-wrap">{profileData.bio}</div>
                        )}
                      </div>
                    )}
                  </motion.div>

                                  </div>
                  
                {/* Right column: stat counters + go-to-dashboard shortcut */}
                <div className="lg:col-span-3 space-y-6">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.06 }}
                    className="rounded-2xl border border-white/10 bg-[#1e1e2d]/60 backdrop-blur-xl p-5"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold">Statistics</div>
                        <div className="text-sm text-slate-400 mt-1">Your recent activity</div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-slate-300" />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Questions saved</div>
                        {dataLoading ? <div className="h-6 w-12 bg-white/10 rounded animate-pulse mt-1" /> : <div className="text-xl font-semibold text-slate-100 mt-1">{Number(savedStats?.totalSaved) || 0}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Mock sessions</div>
                        {dataLoading ? <div className="h-6 w-12 bg-white/10 rounded animate-pulse mt-1" /> : <div className="text-xl font-semibold text-slate-100 mt-1">{Number(profileInsights?.mock?.totalSessions) || 0}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Resume interviews</div>
                        {dataLoading ? <div className="h-6 w-12 bg-white/10 rounded animate-pulse mt-1" /> : <div className="text-xl font-semibold text-slate-100 mt-1">{Number(profileInsights?.mock?.resumeInterviews) || 0}</div>}
                      </div>
                      <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                        <div className="text-xs text-slate-500">Coding solved</div>
                        {dataLoading ? <div className="h-6 w-12 bg-white/10 rounded animate-pulse mt-1" /> : <div className="text-xl font-semibold text-slate-100 mt-1">{Number(profileInsights?.coding?.totalSolved) || 0}</div>}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="mt-4 w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                      onClick={() => navigate('/dashboard')}
                    >
                      <span>Go to dashboard</span>
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    </button>
                  </motion.div>
                </div>
              </div>

              {/* ── Analytics section (LeetCode-style) ── */}
              {clerkToken && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-lg font-semibold">Coding Analytics</div>
                    <div className="text-xs text-slate-500">LeetCode-style</div>
                  </div>
                  <ProfileAnalytics clerkToken={clerkToken} />
                </div>
              )}

              {/* ── Profile insights (graphs) ── */}
              {clerkToken && (
                <div className="mt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-lg font-semibold">Profile Insights</div>
                    <div className="text-xs text-slate-500">Your progress breakdown</div>
                  </div>
                  <ProfileInsightsPanel clerkToken={clerkToken} />
                </div>
              )}

              <div className="mt-8">
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Logout confirmation modal ── */}
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
              disabled={logoutLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"
              onClick={handleLogout}
              disabled={logoutLoading}
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

export default Profile;
