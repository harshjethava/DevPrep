import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Code2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const Sidebar = ({
  openMobile,
  onCloseMobile,
  collapsed,
  onToggleCollapsed,
  items = [],
  onNavigate,
  profile = { name: 'User', subtitle: 'DevPrep' },
  profilePath
}) => {
  const handleToggle = () => {
    localStorage.setItem('sidebarCollapsed', !collapsed);
    if (onToggleCollapsed) onToggleCollapsed();
  };

  const content = (
    <motion.aside
      className={`h-full flex flex-col backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden ${collapsed ? 'w-[86px]' : 'w-[280px]'}`}
      layout
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
    >
      <div className={`h-[72px] border-b border-white/10 flex items-center ${collapsed ? 'justify-center' : 'px-4 justify-between gap-3'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 flex items-center justify-center shrink-0 shadow-lg">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-violet-400 to-pink-400 bg-clip-text text-transparent truncate">
              DevPrep
            </div>
          )}
        </div>

        <button
          type="button"
          className="md:hidden w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 flex items-center justify-center"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
        >
          <ChevronLeft className="w-4 h-4 text-slate-300" />
        </button>
      </div>

      <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden">
        <nav className="space-y-1">
          {items.map(({ label, path, Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(path);
                }
                if (onCloseMobile) onCloseMobile();
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  isActive ? 'bg-violet-600/15 border-violet-500/30 text-violet-200' : 'bg-white/0 border-transparent text-slate-300 hover:bg-white/5 hover:border-white/10'
                }`
              }
              title={collapsed ? label : undefined}
            >
              <div className="w-9 h-9 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon className="w-4 h-4" />
              </div>
              {!collapsed && <div className="text-sm font-medium truncate">{label}</div>}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-white/10">
        <button
          type="button"
          className={`flex items-center min-w-0 w-full ${collapsed ? 'justify-center' : 'gap-3 text-left'}`}
          onClick={() => {
            if (profilePath && onNavigate) onNavigate(profilePath);
          }}
          aria-label="Open profile"
          title={collapsed ? profile.name : undefined}
        >
          {profile.avatar ? (
            <img
              src={profile.avatar}
              alt="Avatar"
              className="w-10 h-10 shrink-0 rounded-xl border border-white/10 object-cover"
            />
          ) : (
            <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-r from-cyan-400/20 via-violet-400/20 to-pink-400/20 border border-white/10" />
          )}
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate">{profile.name}</div>
              {profile.subtitle && <div className="text-xs text-slate-500 truncate">{profile.subtitle}</div>}
            </div>
          )}
        </button>
      </div>
    </motion.aside>
  );

  return (
    <>
      <motion.div
        className="hidden md:block relative z-40 shrink-0"
        animate={{ width: collapsed ? 86 : 280 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      >
        <div className="fixed top-4 lg:top-8 h-[calc(100vh-32px)] lg:h-[calc(100vh-64px)] z-40">
          {content}
          <button
            type="button"
            className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-slate-900 border border-white/10 rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg z-50 cursor-pointer"
            onClick={handleToggle}
            aria-label="Toggle sidebar"
          >
            {collapsed ? <ChevronRight className="w-3 h-3 text-slate-300" /> : <ChevronLeft className="w-3 h-3 text-slate-300" />}
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {openMobile && (
          <motion.div
            className="md:hidden fixed inset-0 z-40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-black/60"
              onClick={onCloseMobile}
              aria-label="Close sidebar overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="relative h-[calc(100vh-32px)] lg:h-[calc(100vh-64px)]"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            >
              {content}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Sidebar;
