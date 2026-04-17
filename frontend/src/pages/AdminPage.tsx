import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, RefreshCw, Trash2, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, Info,
  Activity, Clock, Database, Zap,
} from 'lucide-react';
import apiClient from '@/api/client';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  source: string;
}

interface ScraperStatus {
  isRunning: boolean;
  stopRequested: boolean;
  lastRunAt: string | null;
  errors: string[];
}

interface JobStatus {
  jobName: string;
  isRunning: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  lastError: string | null;
}

const LEVEL_STYLES: Record<LogEntry['level'], { color: string; icon: React.ElementType }> = {
  info:    { color: 'text-blue-400',   icon: Info          },
  warn:    { color: 'text-yellow-400', icon: AlertTriangle },
  error:   { color: 'text-red-400',    icon: XCircle       },
  success: { color: 'text-emerald-400', icon: CheckCircle2 },
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour12: false }) + ' ' +
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function LogLine({ entry }: { entry: LogEntry }) {
  const { color, icon: Icon } = LEVEL_STYLES[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false });
  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-xs group hover:bg-white/3 px-1 rounded">
      <span className="text-textSecondary/50 shrink-0 w-[52px]">{time}</span>
      <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${color}`} />
      <span className={`text-[10px] font-bold shrink-0 w-20 truncate ${color} opacity-70`}>
        [{entry.source}]
      </span>
      <span className={`${color} break-words min-w-0`}>{entry.message}</span>
    </div>
  );
}

type LevelFilter = 'all' | LogEntry['level'];

export default function AdminPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [status, setStatus]       = useState<ScraperStatus | null>(null);
  const [jobs, setJobs]           = useState<JobStatus[]>([]);
  const [levelFilter, setFilter]  = useState<LevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading]     = useState<string | null>(null);

  const logEndRef   = useRef<HTMLDivElement>(null);
  const latestTs    = useRef<string | undefined>(undefined);
  const pollRef     = useRef<ReturnType<typeof setInterval>>();

  // Scroll to bottom on new logs
  useEffect(() => {
    if (autoScroll) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/scraper/status');
      setStatus(data.scraper);
      setJobs(data.jobs ?? []);
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const params = latestTs.current ? { since: latestTs.current } : {};
      const { data } = await apiClient.get('/scraper/logs', { params });
      if (data.logs?.length) {
        setLogs((prev) => {
          const combined = [...prev, ...data.logs];
          // keep last 1000 in UI
          return combined.slice(-1000);
        });
        latestTs.current = data.logs[data.logs.length - 1].timestamp;
      }
    } catch {}
  }, []);

  // Initial load + start polling
  useEffect(() => {
    fetchStatus();
    fetchLogs();
    pollRef.current = setInterval(() => {
      fetchStatus();
      fetchLogs();
    }, 2000);
    return () => clearInterval(pollRef.current);
  }, [fetchStatus, fetchLogs]);

  const trigger = async (action: string, body?: object) => {
    setLoading(action);
    try {
      await apiClient.post(`/scraper/${action}`, body ?? {});
      await fetchStatus();
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const clearLogs = async () => {
    await apiClient.post('/scraper/logs/clear');
    setLogs([]);
    latestTs.current = undefined;
  };

  const filtered = levelFilter === 'all' ? logs : logs.filter((l) => l.level === levelFilter);
  const isRunning = status?.isRunning ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <span className="w-1 h-7 rounded-full bg-accent block shrink-0" />
        <h1 className="text-2xl font-bold text-textPrimary flex items-center gap-2">
          <Activity className="w-6 h-6 text-accent" />
          Sync Dashboard
        </h1>
        <span className={`ml-2 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
          isRunning ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-textSecondary'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-textSecondary'}`} />
          {isRunning ? 'Running' : 'Idle'}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Status',    value: isRunning ? 'Syncing' : 'Idle',        icon: Zap,      accent: isRunning },
          { label: 'Last Run',  value: fmt(status?.lastRunAt ?? null),         icon: Clock,    accent: false },
          { label: 'Errors',    value: String(status?.errors?.length ?? 0),   icon: XCircle,  accent: false },
          { label: 'Jobs',      value: String(jobs.length),                    icon: Database, accent: false },
        ].map((s) => (
          <div key={s.label} className="bg-surface border border-white/5 rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`w-5 h-5 shrink-0 ${s.accent ? 'text-emerald-400' : 'text-accent'}`} />
            <div>
              <p className="text-xs text-textSecondary">{s.label}</p>
              <p className="text-sm font-semibold text-textPrimary">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => trigger('trigger')}
          disabled={isRunning || !!loading}
          className="flex items-center gap-2 bg-accent hover:bg-accent/90 disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-glow-sm"
        >
          {loading === 'trigger' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Full Sync
        </button>

        <button
          onClick={() => trigger('check-updates')}
          disabled={isRunning || !!loading}
          className="flex items-center gap-2 bg-surface-2 hover:bg-white/10 disabled:opacity-40 text-textPrimary font-semibold px-5 py-2.5 rounded-xl border border-white/5 transition-colors"
        >
          {loading === 'check-updates' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Chapter Check
        </button>

        <AnimatePresence>
          {isRunning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={() => trigger('stop')}
              disabled={status?.stopRequested}
              className="flex items-center gap-2 bg-red-500/15 hover:bg-red-500/25 disabled:opacity-50 text-red-400 font-semibold px-5 py-2.5 rounded-xl border border-red-500/30 transition-colors"
            >
              <Square className="w-4 h-4" />
              {status?.stopRequested ? 'Stopping…' : 'Stop'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Job schedules */}
      {jobs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-textSecondary uppercase tracking-wider mb-3">Scheduled Jobs</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {jobs.map((job) => (
              <div key={job.jobName} className="bg-surface border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-textPrimary">{job.jobName}</p>
                  <span className={`w-2 h-2 rounded-full ${job.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-surface-2'}`} />
                </div>
                <p className="text-xs text-textSecondary">Next: {fmt(job.nextRunAt)}</p>
                <p className="text-xs text-textSecondary">Last: {fmt(job.lastRunAt)}</p>
                {job.lastError && <p className="text-xs text-red-400 mt-1 truncate">{job.lastError}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Log terminal */}
      <div className="bg-[#09090f] rounded-2xl border border-white/5 overflow-hidden">
        {/* Terminal header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500/70" />
              <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
            </div>
            <span className="text-xs text-textSecondary font-mono">kamoola — sync logs</span>
            <span className="text-xs text-textSecondary/50">({filtered.length} entries)</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Level filter */}
            {(['all', 'info', 'success', 'warn', 'error'] as LevelFilter[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setFilter(lvl)}
                className={`text-xs px-2 py-0.5 rounded-md transition-colors ${
                  levelFilter === lvl
                    ? 'bg-accent/20 text-accent'
                    : 'text-textSecondary hover:text-textPrimary'
                }`}
              >
                {lvl}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-1" />

            {/* Auto-scroll toggle */}
            <button
              onClick={() => setAutoScroll((p) => !p)}
              title="Auto-scroll"
              className={`p-1.5 rounded-md transition-colors ${autoScroll ? 'text-accent bg-accent/10' : 'text-textSecondary hover:text-textPrimary'}`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {/* Clear */}
            <button
              onClick={clearLogs}
              title="Clear logs"
              className="p-1.5 rounded-md text-textSecondary hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Log body */}
        <div className="h-[480px] overflow-y-auto p-3 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-textSecondary/40 text-xs font-mono">No logs yet. Start a sync to see activity.</p>
            </div>
          ) : (
            filtered.map((entry) => <LogLine key={entry.id} entry={entry} />)
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </motion.div>
  );
}
