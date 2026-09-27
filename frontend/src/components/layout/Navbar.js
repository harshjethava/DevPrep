import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Menu, X, Search } from 'lucide-react';
import { useUser, useClerk } from '@clerk/clerk-react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, NavLink } from 'react-router-dom';
import { userAPI } from '../../services/api';

/**
 * App-wide Navbar component.
 *
 * Props:
 *  brand           – Branding text (default 'DevPrep')
 *  activeLabel     – Page subtitle shown below the brand
 *  links           – Array of { label, path } for the nav links
 *  onOpenMobileSidebar – Called when the hamburger button is clicked
 *  avatarUrl       – Override for the user avatar image
 *  onLogout        – Called when user clicks Logout (parent should show confirmation modal)
 */
const Navbar = ({ brand = 'DevPrep', activeLabel = 'Dashboard', onOpenMobileSidebar, links = [], avatarUrl, onLogout }) => {
  const { user } = useUser();
  const { signOut } = useClerk();
  const navigate  = useNavigate();
  const location  = useLocation();

  // User dropdown state
  const [userMenuOpen, setUserMenuOpen]   = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const userMenuRef    = useRef(null);
  const userButtonRef  = useRef(null);
  const portalMenuRef  = useRef(null);
  const [userMenuPos, setUserMenuPos] = useState({ top: 0, left: 0 });

  // Search state
  const [searchOpen, setSearchOpen]       = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const searchInputRef   = useRef(null);
  const searchContainerRef = useRef(null);
  const debounceRef      = useRef(null);

  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'User';

  const effectiveAvatar = avatarUrl || user?.imageUrl || '';

  /* ── Close user menu on outside click ── */
  useEffect(() => {
    const onDocClick = (e) => {
      if (portalMenuRef.current && portalMenuRef.current.contains(e.target)) return;
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  /* ── Close search on outside click ── */
  useEffect(() => {
    const onDocClick = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setSearchOpen(false);
        setSearchQuery('');
        setSearchResults([]);
        setSearchNotFound(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  /* ── User menu portal position ── */
  useLayoutEffect(() => {
    if (!userMenuOpen) return;
    const updatePos = () => {
      const el = userButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const menuWidth = 208;
      const gutter = 8;
      const rawLeft = rect.right - menuWidth;
      const clampedLeft = Math.max(gutter, Math.min(rawLeft, window.innerWidth - menuWidth - gutter));
      setUserMenuPos({ top: rect.bottom + 10, left: clampedLeft });
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [userMenuOpen]);

  /* ── Debounced search ── */
  const handleSearchChange = useCallback((e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchNotFound(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (val.trim().length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await userAPI.search(val.trim());
        const users = res.data?.users || [];
        setSearchResults(users);
        setSearchNotFound(users.length === 0);
      } catch {
        setSearchResults([]);
        setSearchNotFound(true);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, []);

  const handleSearchSelect = (username) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    navigate(`/profile/${username || 'unknown'}`);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  /* ── Nav links ── */
  const renderLinks = (className) => (
    <div className={className}>
      {links.map((l) => (
        <NavLink
          key={l.path}
          to={l.path}
          className={({ isActive }) =>
            `px-3 py-2 rounded-xl text-sm border transition-colors ${
              isActive
                ? 'text-violet-200 bg-violet-600/15 border-violet-500/30'
                : 'text-slate-300 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10'
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative z-50 backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl px-4 py-3 lg:px-6 lg:py-4 shadow-[0_8px_32px_rgba(0,0,0,0.4)] min-h-[58px] lg:min-h-[72px] flex flex-col justify-center"
    >
      <div className="flex items-center justify-between gap-3">
        {/* ── Brand ── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            className="md:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
            onClick={onOpenMobileSidebar}
            aria-label="Open sidebar"
          >
            <Menu className="w-5 h-5 text-slate-300" />
          </button>
          <div className="min-w-0">
            {brand ? (
              <>
                <div className="text-lg lg:text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent truncate">
                  {brand}
                </div>
                <div className="text-xs lg:text-sm text-slate-400 truncate">{activeLabel}</div>
              </>
            ) : (
              <div className="text-lg lg:text-xl font-bold text-slate-100 truncate">
                {activeLabel}
              </div>
            )}
          </div>
        </div>

        {/* ── Desktop nav links ── */}
        {renderLinks('hidden lg:flex items-center gap-1')}

        {/* ── Right controls (search + user) ── */}
        <div className="flex items-center gap-2">
          {/* Mobile nav toggle */}
          <button
            type="button"
            className="lg:hidden w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-slate-300" /> : <Menu className="w-5 h-5 text-slate-300" />}
          </button>

          {/* ── User Search ── */}
          <div ref={searchContainerRef} className="relative">
            {!searchOpen ? (
              <button
                type="button"
                onClick={openSearch}
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center transition-colors"
                aria-label="Search users"
              >
                <Search className="w-4 h-4 text-slate-300" />
              </button>
            ) : (
              <motion.div
                initial={{ width: 40, opacity: 0.5 }}
                animate={{ width: 220, opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  placeholder="Search users..."
                  className="w-full h-10 pl-9 pr-3 rounded-xl bg-white/8 border border-white/15 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500/50 focus:bg-white/10"
                />
              </motion.div>
            )}

            {/* Search dropdown */}
            <AnimatePresence>
              {searchOpen && (searchResults.length > 0 || searchNotFound || searching) && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-12 w-64 rounded-2xl backdrop-blur-xl bg-slate-950/90 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.55)] z-[9998] overflow-hidden"
                >
                  {searching && (
                    <div className="px-4 py-3 text-sm text-slate-400 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
                      Searching…
                    </div>
                  )}
                  {!searching && searchNotFound && (
                    <div className="px-4 py-3 text-sm text-slate-500">User not found</div>
                  )}
                  {!searching && searchResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleSearchSelect(u.username || u.name)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/8 transition-colors"
                    >
                      {u.avatar ? (
                        <img
                          src={u.avatar}
                          alt={u.name}
                          className="w-8 h-8 rounded-lg object-cover border border-white/10"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-violet-600/30 to-cyan-600/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-white">
                          {(u.name?.[0] || '?').toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-100 truncate">{u.name}</div>
                        {u.username && (
                          <div className="text-xs text-slate-500 truncate">@{u.username}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── User menu ── */}
          <div className="relative" ref={userMenuRef}>
            <button
              ref={userButtonRef}
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="h-10 px-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              {effectiveAvatar ? (
                <img src={effectiveAvatar} alt="Avatar" className="w-7 h-7 rounded-lg border border-white/10 object-cover" />
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-r from-violet-600/35 to-indigo-600/20 border border-white/10 flex items-center justify-center">
                  <span className="text-xs font-semibold text-white">
                    {(user?.firstName?.[0] || user?.username?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="hidden sm:block text-left">
                <div className="text-sm text-slate-200 leading-4">{displayName}</div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {typeof document !== 'undefined' &&
              createPortal(
                <AnimatePresence>
                  {userMenuOpen && (
                    <motion.div
                      ref={portalMenuRef}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="fixed w-52 rounded-2xl backdrop-blur-xl bg-slate-950/80 border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.55)] z-[9999] flex flex-col overflow-hidden"
                      style={{ top: userMenuPos.top, left: userMenuPos.left }}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-white/10"
                        onClick={() => { setUserMenuOpen(false); navigate('/profile'); }}
                        aria-label="Open profile"
                      >
                        <div className="text-sm font-semibold text-slate-100 leading-5 truncate">{displayName}</div>
                        <div className="text-xs text-slate-500 mt-0.5">View profile</div>
                      </button>
                      <div className="border-t border-white/10" />
                      <button
                        type="button"
                        className="w-full text-left px-4 py-3 text-sm text-red-200 hover:text-red-100 hover:bg-white/10"
                        onClick={() => {
                          setUserMenuOpen(false);
                          if (onLogout) {
                            onLogout();
                          } else {
                            signOut({ redirectUrl: '/login' });
                          }
                        }}
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>,
                document.body
              )}
          </div>
        </div>
      </div>

      {/* ── Mobile nav links dropdown ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden mt-3 pt-3 border-t border-white/10"
          >
            {renderLinks('flex flex-col gap-2')}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Navbar;
