import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { analyticsAPI } from '../services/api';

function normalizeLabel(v) {
  const s = String(v || '').trim();
  if (!s) return 'Unknown';
  if (s.toLowerCase() === 'hr') return 'HR';
  return s
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

const CustomLegend = ({ data, colors }) => (
  <div className="mt-4 max-h-24 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
    {data.map((entry, index) => (
      <div key={index} className="flex items-center gap-2 text-xs text-slate-300 hover:bg-white/5 p-1 rounded transition-colors">
        <div 
          className="w-2.5 h-2.5 rounded-sm shrink-0" 
          style={{ backgroundColor: colors[index % colors.length] }} 
        />
        <div className="flex-1 truncate">{entry.name}</div>
        <div className="font-medium text-slate-100">{entry.value}</div>
      </div>
    ))}
  </div>
);

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/90 backdrop-blur px-3 py-2 text-xs text-slate-200 shadow-lg">
      <div className="font-semibold text-slate-100">{label || p.name}</div>
      <div className="text-slate-300">{p.value}</div>
    </div>
  );
}

const PIE_COLORS = ['#22d3ee', '#a78bfa', '#fb7185', '#34d399', '#fbbf24', '#60a5fa', '#f97316', '#2dd4bf'];

const ProfileInsightsPanel = ({ clerkToken }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!clerkToken) return;

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await analyticsAPI.getProfileInsights(clerkToken);
        if (cancelled) return;

        setInsights(res.data?.insights || null);
      } catch (e) {
        if (!cancelled) {
          setError('Failed to load profile insights.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clerkToken]);

  const languageData = useMemo(() => {
    const items = insights?.languageUsage || [];
    const map = {};
    items.forEach(x => {
      const name = normalizeLabel(x.language);
      map[name] = (map[name] || 0) + (Number(x.count) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).slice(0, 8);
  }, [insights]);

  const categoryData = useMemo(() => {
    const items = insights?.solvedCategories || [];
    const map = {};
    items.forEach(x => {
      const name = normalizeLabel(x.category);
      map[name] = (map[name] || 0) + (Number(x.count) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0).slice(0, 8);
  }, [insights]);

  const mockTypeData = useMemo(() => {
    const items = insights?.mock?.byType || [];
    const map = {};
    items.forEach(x => {
      const name = normalizeLabel(x.type);
      map[name] = (map[name] || 0) + (Number(x.count) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0);
  }, [insights]);

  const savedDifficultyData = useMemo(() => {
    const items = insights?.savedQuestions?.byDifficulty || [];
    const map = {};
    items.forEach(x => {
      const name = normalizeLabel(x.difficulty);
      map[name] = (map[name] || 0) + (Number(x.count) || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).filter(x => x.value > 0);
  }, [insights]);

  
  if (!clerkToken) return null;

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 animate-pulse">
        <div className="h-5 w-44 bg-white/10 rounded mb-4" />
        <div className="h-40 bg-white/5 rounded-xl" />
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

  const avgMockScore = insights?.mock?.averageScore;
  const resumeCount = Number(insights?.resume?.uploadedCount) || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-5"
    >
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
        <div className="text-sm font-semibold text-slate-200">Languages</div>
        <div className="text-xs text-slate-500 mt-1">Submissions by language</div>
        {languageData.length ? (
          <>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={languageData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} stroke="none">
                    {languageData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <CustomLegend data={languageData} colors={PIE_COLORS} />
          </>
        ) : (
          <div className="mt-4 h-48 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
            No submission data yet
          </div>
        )}
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
        <div className="text-sm font-semibold text-slate-200">Solved Categories</div>
        <div className="text-xs text-slate-500 mt-1">Accepted problems by category</div>
        {categoryData.length ? (
          <>
            <div className="mt-4 h-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} stroke="none">
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <CustomLegend data={categoryData} colors={PIE_COLORS} />
          </>
        ) : (
          <div className="mt-4 h-48 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
            No solved problems yet
          </div>
        )}
      </div>

      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col">
        <div className="text-sm font-semibold text-slate-200">Mock Interviews</div>
          <div className="text-xs text-slate-500 mt-1">Sessions by type</div>
          {mockTypeData.length ? (
            <>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mockTypeData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <XAxis dataKey="name" tick={false} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {mockTypeData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <CustomLegend data={mockTypeData} colors={PIE_COLORS} />
            </>
          ) : (
            <div className="mt-4 h-48 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No mock sessions yet
            </div>
          )}
      </div>


      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 lg:col-span-2 xl:col-span-3">
        <div className="text-sm font-semibold text-slate-200">Solved / Attempted Questions</div>
        <div className="text-xs text-slate-500 mt-1">By difficulty</div>
        <div className="mt-4 h-40">
          {savedDifficultyData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savedDifficultyData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#a78bfa" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm text-slate-500">
              No solved/attempted questions yet
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileInsightsPanel;
