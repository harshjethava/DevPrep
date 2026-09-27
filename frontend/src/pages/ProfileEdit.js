import { useEffect, useMemo, useRef, useState } from 'react';
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
  Image as ImageIcon,
  Save,
  X
} from 'lucide-react';
import { EnhancedAnimatedBackground } from '../components/EnhancedAnimatedBackground';
import Navbar from '../components/layout/Navbar';
import Sidebar from '../components/layout/Sidebar';
import Footer from '../components/layout/Footer';
import Modal from '../components/ui/Modal';
import { clerkAPI } from '../services/api';

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const SKILL_SUGGESTIONS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Express',
  'MongoDB',
  'SQL',
  'DSA',
  'System Design',
  'HTML',
  'CSS',
  'Tailwind',
  'Git',
  'Docker',
  'AWS'
];

function normalizeSkills(input) {
  if (!Array.isArray(input)) return [];
  const cleaned = input
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).slice(0, 20);
}

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { user } = useUser();
  const { ready, getToken } = useReadyAuth();
  const { signOut } = useClerk();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("sidebarCollapsed") === "true");
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [avatar, setAvatar] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Beginner');
  const [targetRole, setTargetRole] = useState('');
  const [skills, setSkills] = useState([]);
  const [bio, setBio] = useState('');

  const [skillInput, setSkillInput] = useState('');
  const fileInputRef = useRef(null);

  const displayNameFallback =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';

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

  useEffect(() => {
    if (!ready) return;

    (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const res = await clerkAPI.getProfile(token);
        const dbUser = res.data?.user || null;

        setAvatar(dbUser?.avatar || user?.imageUrl || '');
        setName(dbUser?.name || displayNameFallback);
        setEmail(dbUser?.email || user?.primaryEmailAddress?.emailAddress || '');
        setExperienceLevel(dbUser?.experienceLevel || 'Beginner');
        setTargetRole(dbUser?.targetRole || '');
        setSkills(normalizeSkills(dbUser?.skills || []));
        setBio(dbUser?.bio || '');
      } catch (_) {
        setAvatar(user?.imageUrl || '');
        setName(displayNameFallback);
        setEmail(user?.primaryEmailAddress?.emailAddress || '');
        setExperienceLevel('Beginner');
        setTargetRole('');
        setSkills([]);
        setBio('');
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, displayNameFallback, getToken, user]);

  const validationErrors = useMemo(() => {
    const errors = {};

    const trimmedName = String(name || '').trim();
    if (trimmedName.length < 2 || trimmedName.length > 100) {
      errors.name = 'Name must be 2-100 characters';
    }

    if (experienceLevel && !EXPERIENCE_LEVELS.includes(experienceLevel)) {
      errors.experienceLevel = 'Invalid experience level';
    }

    if (bio && String(bio).length > 1000) {
      errors.bio = 'Bio must be at most 1000 characters';
    }

    const cleanedSkills = normalizeSkills(skills);
    if (skills.length !== cleanedSkills.length) {
      errors.skills = 'Skills contain duplicates/empty values';
    }

    return errors;
  }, [bio, experienceLevel, name, skills]);

  const canSave = Object.keys(validationErrors).length === 0 && !saving && !loading;

  const filteredSuggestions = useMemo(() => {
    const q = skillInput.trim().toLowerCase();
    if (!q) return [];
    const existing = new Set(skills.map((s) => s.toLowerCase()));
    return SKILL_SUGGESTIONS.filter(
      (s) => s.toLowerCase().includes(q) && !existing.has(s.toLowerCase())
    ).slice(0, 8);
  }, [skillInput, skills]);

  const addSkill = (value) => {
    const v = String(value || '').trim();
    if (!v) return;
    const updated = normalizeSkills([...skills, v]);
    setSkills(updated);
    setSkillInput('');
  };

  const removeSkill = (value) => {
    setSkills(skills.filter((s) => s !== value));
  };

  const onPickAvatar = async (file) => {
    if (!file) return;

    const maxBytes = 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error('Please choose an image under 1MB');
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });

      const maxDim = 256;
      const scale = Math.min(maxDim / img.width, maxDim / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        toast.error('Image processing not supported');
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(objectUrl);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      setAvatar(dataUrl);
    } catch (_) {
      toast.error('Failed to process image');
    }
  };

  const onSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not authorized');

      const payload = {
        name: String(name || '').trim(),
        experienceLevel,
        targetRole: String(targetRole || '').trim(),
        skills: normalizeSkills(skills),
        bio: String(bio || ''),
        avatar: String(avatar || '')
      };

      await clerkAPI.updateProfile(token, payload);
      toast.success('Profile updated');
      safeNavigate('/profile');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to update profile';
      toast.error(msg);
    } finally {
      setSaving(false);
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
              profile={{ name: name || displayNameFallback }}
              profilePath="/profile"
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Navbar
                    brand=""
                    activeLabel="Profile"
                    links={navbarLinks}
                    onNavigate={safeNavigate}
                    onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
                    avatarUrl={avatar || user?.imageUrl || ''}
                    onLogout={() => setConfirmLogoutOpen(true)}
                  />
                </div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="mt-6 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xl font-semibold">Edit profile</div>
                    <div className="text-sm text-slate-400 mt-1">Update your information</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-200 inline-flex items-center gap-2"
                      onClick={() => safeNavigate('/profile')}
                      disabled={saving}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={`px-4 py-2 rounded-2xl border border-white/10 hover:border-white/20 font-semibold inline-flex items-center gap-2 ${
                        canSave ? 'bg-violet-600 hover:bg-violet-700 border border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]' : 'bg-white/5 border-white/10 text-slate-400'
                      }`}
                      onClick={onSave}
                      disabled={!canSave}
                    >
                      <Save className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-4">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="text-sm font-semibold text-slate-100">Profile picture</div>
                      <div className="mt-4 flex items-center gap-4">
                        {avatar ? (
                          <img
                            src={avatar}
                            alt="Avatar"
                            className="w-16 h-16 rounded-2xl border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <ImageIcon className="w-5 h-5 text-slate-400" />
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => onPickAvatar(e.target.files?.[0])}
                          />
                          <button
                            type="button"
                            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading || saving}
                          >
                            Upload
                          </button>
                          {avatar && (
                            <button
                              type="button"
                              className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-sm text-slate-200"
                              onClick={() => setAvatar('')}
                              disabled={loading || saving}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 mt-3">Max size: 1MB</div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-4">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs text-slate-400">Name</label>
                          <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-2 w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-colors text-slate-100 placeholder:text-slate-500"
                            placeholder="Your name"
                            disabled={loading || saving}
                          />
                          {validationErrors.name && (
                            <div className="text-xs text-red-300 mt-2">{validationErrors.name}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">Email</label>
                          <input
                            value={email}
                            readOnly
                            className="mt-2 w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 opacity-60 cursor-not-allowed text-slate-300"
                            placeholder="Email"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">Experience level</label>
                          <select
                            value={experienceLevel}
                            onChange={(e) => setExperienceLevel(e.target.value)}
                            className="mt-2 w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-colors text-slate-100 appearance-none cursor-pointer"
                            disabled={loading || saving}
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%2394a3b8\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em 1.2em', paddingRight: '2.5rem' }}
                          >
                            {EXPERIENCE_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl} className="bg-slate-900 text-slate-100 py-2">
                                {lvl}
                              </option>
                            ))}
                          </select>
                          {validationErrors.experienceLevel && (
                            <div className="text-xs text-red-300 mt-2">{validationErrors.experienceLevel}</div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs text-slate-400">Target role</label>
                          <input
                            value={targetRole}
                            onChange={(e) => setTargetRole(e.target.value)}
                            className="mt-2 w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-colors text-slate-100 placeholder:text-slate-500"
                            placeholder="e.g. Frontend Developer"
                            disabled={loading || saving}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="text-sm font-semibold text-slate-100">Skills</div>
                      <div className="text-xs text-slate-400 mt-1">Add skills and press Enter</div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {skills.map((s) => (
                          <button
                            key={s}
                            type="button"
                            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 hover:border-white/20"
                            onClick={() => removeSkill(s)}
                            disabled={loading || saving}
                            aria-label={`Remove ${s}`}
                          >
                            {s} ×
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 relative">
                        <input
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addSkill(skillInput);
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-colors text-slate-100 placeholder:text-slate-500"
                          placeholder="Type a skill and press Enter"
                          disabled={loading || saving}
                        />

                        {filteredSuggestions.length > 0 && (
                          <div className="absolute left-0 right-0 mt-2 rounded-2xl bg-slate-950/90 border border-white/10 overflow-hidden z-20">
                            {filteredSuggestions.map((s) => (
                              <button
                                key={s}
                                type="button"
                                className="w-full text-left px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
                                onClick={() => addSkill(s)}
                                disabled={loading || saving}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {validationErrors.skills && (
                        <div className="text-xs text-red-300 mt-2">{validationErrors.skills}</div>
                      )}
                    </div>

                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                      <div className="text-sm font-semibold text-slate-100">Bio / About</div>
                      <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={5}
                        className="mt-3 w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-colors text-slate-100 resize-none placeholder:text-slate-500"
                        placeholder="Tell us about yourself..."
                        disabled={loading || saving}
                      />
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                        <div>{validationErrors.bio || ''}</div>
                        <div>{String(bio || '').length}/1000</div>
                      </div>
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
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 border border-violet-500 text-white font-semibold disabled:opacity-50 transition-all duration-300 shadow-[0_0_15px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_rgba(139,92,246,0.35)]"
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

export default ProfileEdit;
