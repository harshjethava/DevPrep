import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  RadialBarChart,
  RadialBar,
  Cell,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie
} from 'recharts';
import { Flame, Zap, CheckCircle2, TrendingUp } from 'lucide-react';
import { analyticsAPI } from '../services/api';

/* ─── Helpers ─── */

/**
 * Build an ISO-date-keyed map from activity array
 * and fill in every day of the current year with a count (0 if missing).
 */
function buildHeatmapData(activity = []) {
  const map = {};
  activity.forEach(({ date, count }) => {
    map[date] = count;
  });

  const result = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  today.setHours(0, 0, 0, 0);

  // Start from January 1st of current year
  const yearStart = new Date(currentYear, 0, 1);
  const daysInYear = Math.floor((today - yearStart) / (1000 * 60 * 60 * 24)) + 1;

  for (let i = daysInYear - 1; i >= 0; i--) {
    const d = new Date(yearStart);
    d.setDate(yearStart.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateNum = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${dateNum}`;
    result.push({ date: key, count: map[key] || 0 });
  }
  return result;
}

/** Returns a Tailwind-compatible background color class for heatmap cells */
function heatColor(count) {
  if (count === 0) return '#1e293b';       // slate-800
  if (count <= 2)  return '#0e7490';       // cyan-700
  if (count <= 5)  return '#0891b2';       // cyan-600
  if (count <= 10) return '#06b6d4';       // cyan-500
  return '#22d3ee';                         // cyan-400
}

/* ─── Sub-components ─── */

/** Donut chart showing easy / medium / hard solved vs total */
function DifficultyRings({ easy, medium, hard, totalEasy, totalMedium, totalHard }) {
  const total = easy + medium + hard;

  const rings = [
    { name: 'Easy',   solved: easy,   total: totalEasy,   color: '#22c55e' },
    { name: 'Medium', solved: medium, total: totalMedium, color: '#f59e0b' },
    { name: 'Hard',   solved: hard,   total: totalHard,   color: '#ef4444' }
  ];

  const pieData = [
    { name: 'Easy',   value: easy,   fill: '#22c55e' },
    { name: 'Medium', value: medium, fill: '#f59e0b' },
    { name: 'Hard',   value: hard,   fill: '#ef4444' },
    { name: 'Unsolved', value: Math.max(0, (totalEasy + totalMedium + totalHard) - total), fill: '#1e293b' }
  ];

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut chart */}
      <div className="relative w-36 h-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={44}
              outerRadius={60}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {pieData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div className="text-2xl font-bold text-white">{total}</div>
          <div className="text-xs text-slate-400">solved</div>
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="flex-1 w-full space-y-3">
        {rings.map(({ name, solved, total: tot, color }) => (
          <div key={name} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span style={{ color }}>{name}</span>
              <span className="text-slate-400">
                {solved} / {tot}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: tot > 0 ? `${Math.round((solved / tot) * 100)}%` : '0%',
                  backgroundColor: color
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** GitHub-style activity heatmap (last 365 days) */
function ActivityHeatmap({ activity }) {
  const cells = buildHeatmapData(activity);
  
  // Group by month
  const months = [];
  const today = new Date();
  const currentYear = today.getFullYear();
  
  // Create month groups
  for (let month = 0; month < 12; month++) {
    const monthStart = new Date(currentYear, month, 1);
    const monthEnd = new Date(currentYear, month + 1, 0);
    const monthCells = cells.filter(cell => {
      const cellDate = new Date(cell.date);
      return cellDate >= monthStart && cellDate < monthEnd;
    });
    
    // Get the first day of the month to determine week alignment
    let firstDay = monthStart.getDay() - 1;
    if (firstDay === -1) firstDay = 6; // Monday = 0, Sunday = 6
    
    // Create calendar grid for this month
    const calendarDays = [];
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();
    
    // Add empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${currentYear}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const cellData = monthCells.find(c => c.date === dateStr);
      calendarDays.push(cellData || { date: dateStr, count: 0 });
    }
    
    // Chunk into weeks
    const monthWeeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      monthWeeks.push(calendarDays.slice(i, i + 7));
    }
    
    months.push({
      name: monthStart.toLocaleDateString('en-US', { month: 'short' }),
      weeks: monthWeeks,
      hasData: monthCells.some(cell => cell.count > 0)
    });
  }

  return (
    <div className="w-full overflow-x-auto pb-4 custom-scrollbar">
      {/* Year header */}
      <div className="text-sm font-semibold text-slate-200 mb-4">
        {currentYear} - Submission Activity
      </div>
      
      {/* Month sections */}
      <div className="flex flex-nowrap min-w-full justify-between gap-3 pb-2">
        {months.map((month, monthIndex) => (
          <div key={monthIndex} className="flex flex-col">
            
            {/* Month heatmap */}
            <div className="flex gap-[3px]">
              {month.weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  {week.map((day, dayIndex) => (
                    <div
                      key={day?.date || `empty-${monthIndex}-${weekIndex}-${dayIndex}`}
                      title={day ? `${day.date}: ${day.count} submission${day.count !== 1 ? 's' : ''}` : ''}
                      className={`w-[11px] h-[11px] rounded-[2px] ${
                        day ? 'cursor-pointer transition-transform hover:scale-125' : ''
                      }`}
                      style={{ 
                        backgroundColor: day ? (month.hasData ? heatColor(day.count) : '#1e293b') : 'transparent'
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Month name */}
            <div className="text-xs font-medium text-slate-400 mt-2 text-center w-full">
              {month.name}
            </div>
          </div>
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-1.5 mt-6 text-xs text-slate-500">
        <span>Less</span>
        {['#1e293b', '#0e7490', '#0891b2', '#06b6d4', '#22d3ee'].map((c) => (
          <div key={c} className="w-[11px] h-[11px] rounded-[2px]" style={{ backgroundColor: c }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

/**
 * ProfileAnalytics – LeetCode-style analytics panel.
 * Accepts a Clerk token (`clerkToken`) via prop so the parent
 * can pass the authenticated token from `useAuth().getToken()`.
 */
const ProfileAnalytics = ({ clerkToken }) => {
  const [codingStats, setCodingStats] = useState(null);
  const [activity, setActivity]       = useState([]);
  const [streak, setStreak]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (!clerkToken) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [statsRes, activityRes, streakRes] = await Promise.all([
          analyticsAPI.getCodingStats(clerkToken),
          analyticsAPI.getSubmissionActivity(clerkToken),
          analyticsAPI.getStreak(clerkToken)
        ]);

        if (cancelled) return;

        setCodingStats(statsRes.data?.codingStats || null);
        setActivity(activityRes.data?.activity || []);
        setStreak(streakRes.data?.streak || null);
      } catch (err) {
        if (!cancelled) setError('Failed to load analytics.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [clerkToken]);

  if (!clerkToken) return null;

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="h-36 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 text-sm text-slate-400">
        {error}
      </div>
    );
  }

  const cs = codingStats || {};
  const st = streak       || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-5"
    >
      {/* ── Top stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total solved */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Solved
          </div>
          <div className="text-2xl font-bold text-white">{cs.totalSolved ?? 0}</div>
          <div className="text-xs text-slate-500">of {cs.totalProblems ?? 0}</div>
        </div>

        {/* Acceptance rate */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            Acceptance
          </div>
          <div className="text-2xl font-bold text-white">{cs.acceptanceRate ?? 0}%</div>
          <div className="text-xs text-slate-500">{cs.acceptedSubmissions ?? 0} / {cs.totalSubmissions ?? 0} sub.</div>
        </div>

        {/* Current streak */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            Streak
          </div>
          <div className="text-2xl font-bold text-white">{st.currentStreak ?? 0}</div>
          <div className="text-xs text-slate-500">days current</div>
        </div>

        {/* Longest streak */}
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Zap className="w-3.5 h-3.5 text-violet-400" />
            Best streak
          </div>
          <div className="text-2xl font-bold text-white">{st.longestStreak ?? 0}</div>
          <div className="text-xs text-slate-500">days all-time</div>
        </div>
      </div>

      {/* ── Difficulty breakdown ── */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-200 mb-4">Difficulty Breakdown</div>
        <DifficultyRings
          easy={cs.easySolved ?? 0}
          medium={cs.mediumSolved ?? 0}
          hard={cs.hardSolved ?? 0}
          totalEasy={cs.totalEasy ?? 0}
          totalMedium={cs.totalMedium ?? 0}
          totalHard={cs.totalHard ?? 0}
        />
      </div>

      {/* ── Activity heatmap ── */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-semibold text-slate-200">Submission Activity</div>
          <div className="text-xs text-slate-500">Last 365 days</div>
        </div>
        <ActivityHeatmap activity={activity} />
      </div>
    </motion.div>
  );
};

export default ProfileAnalytics;
