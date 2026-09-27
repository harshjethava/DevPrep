import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Code2,
  PlayCircle,
  Brain,
  User,
  Calendar,
  CheckCircle2,
  ArrowLeft
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import PublicProfileAnalytics from '../components/PublicProfileAnalytics';
import { userAPI } from '../services/api';

const PublicProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [profile, setProfile]   = useState(null);
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const res = await userAPI.getPublicProfile(username);
        if (cancelled) return;
        setProfile(res.data.user);
        setStats(res.data.stats);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [username]);

  const sidebarItems = useMemo(() => [
    { label: 'Dashboard',         path: '/dashboard',          Icon: LayoutDashboard },
    { label: 'Profile',           path: '/profile',            Icon: User            },
    { label: 'Question Generator',path: '/questions/generate', Icon: Brain           },
    { label: 'Mock Interview',    path: '/interview/mock',     Icon: PlayCircle      },
    { label: 'Resume Interview',  path: '/interview/resume',   Icon: FileText        },
    { label: 'Coding Practice',   path: '/coding/practice',    Icon: Code2           }
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
              profile={{ name: 'DevPrep', avatar: '' }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <Navbar
                brand=""
                activeLabel={profile ? `@${profile.username}` : 'User Profile'}
                links={navbarLinks}
                onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
              />

              <div className="mt-6">
                {/* Loading skeleton */}
                {loading && (
                  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-8 animate-pulse space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/10" />
                      <div className="space-y-2">
                        <div className="h-5 w-32 bg-white/10 rounded" />
                        <div className="h-4 w-20 bg-white/5 rounded" />
                      </div>
                    </div>
                    <div className="h-24 bg-white/5 rounded-xl" />
                  </div>
                )}

                {/* Not found */}
                {!loading && notFound && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-10 text-center"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4">
                      <User className="w-8 h-8 text-slate-400" />
                    </div>
                    <div className="text-xl font-semibold mb-2">User not found</div>
                    <p className="text-slate-400 text-sm mb-6">
                      No user with the username <span className="text-slate-200 font-medium">@{username}</span> exists.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 text-sm"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Go back
                    </button>
                  </motion.div>
                )}

                {/* Profile card */}
                {!loading && profile && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="space-y-6"
                  >
                    {/* Header */}
                    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
                      <div className="absolute inset-0">
                        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-600/20 blur-3xl" />
                        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-cyan-600/15 blur-3xl" />
                      </div>
                      <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
                        {/* Avatar */}
                        {profile.avatar ? (
                          <img
                            src={profile.avatar}
                            alt={profile.name}
                            className="w-16 h-16 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 border border-white/10 flex items-center justify-center">
                            <span className="text-xl font-semibold text-white">
                              {(profile.name?.[0] || '?').toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-2xl font-semibold truncate">{profile.name}</div>
                          {profile.username && (
                            <div className="text-sm text-slate-400 mt-0.5">@{profile.username}</div>
                          )}
                          {profile.targetRole && (
                            <div className="text-xs text-slate-500 mt-1">{profile.targetRole}</div>
                          )}
                        </div>
                        <div className="sm:ml-auto">
                          <span className="px-3 py-1.5 rounded-xl bg-violet-600/20 border border-violet-500/30 text-xs text-violet-200">
                            {profile.experienceLevel}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left: About + Skills */}
                      <div className="lg:col-span-2 space-y-5">
                        <div className="backdrop-blur-xl bg-[#1e1e2d]/60 border border-white/10 rounded-2xl p-5">
                          <div className="text-sm font-semibold text-slate-200 mb-2">About</div>
                          <p className={`text-sm whitespace-pre-wrap ${profile.bio ? 'text-slate-400' : 'text-slate-500 italic'}`}>
                            {profile.bio || 'No bio provided.'}
                          </p>
                        </div>

                        <div className="backdrop-blur-xl bg-[#1e1e2d]/60 border border-white/10 rounded-2xl p-5">
                          <div className="text-sm font-semibold text-slate-200 mb-3">Skills</div>
                          {profile.skills?.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {profile.skills.map((s) => (
                                <span
                                  key={s}
                                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">No skills added yet.</p>
                          )}
                        </div>

                      </div>

                      {/* Right: Stats */}
                      <div className="space-y-5">
                        <div className="backdrop-blur-xl bg-[#1e1e2d]/60 border border-white/10 rounded-2xl p-5">
                          <div className="text-sm font-semibold text-slate-200 mb-4">Statistics</div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                Problems solved
                              </div>
                              <div className="text-lg font-bold text-white">
                                {stats?.problemsSolved ?? 0}
                              </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <PlayCircle className="w-4 h-4 text-violet-400" />
                                Interviews done
                              </div>
                              <div className="text-lg font-bold text-white">
                                {stats?.interviewsCompleted ?? 0}
                              </div>
                            </div>
                            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3">
                              <div className="flex items-center gap-2 text-sm text-slate-400">
                                <Calendar className="w-4 h-4 text-cyan-400" />
                                Member since
                              </div>
                              <div className="text-sm font-medium text-slate-200">
                                {profile.memberSince
                                  ? new Date(profile.memberSince).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
                                  : '–'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="text-lg font-semibold">Coding Analytics</div>
                        <div className="text-xs text-slate-500">LeetCode-style</div>
                      </div>
                      <PublicProfileAnalytics username={profile.username || username} />
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="mt-8">
                <Footer />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
