import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, RefreshCw, Trash2, ChevronDown,
  CheckCircle2, AlertTriangle, XCircle, Info,
  Activity, Clock, AlertCircle, Layers, Zap, Timer,
} from 'lucide-react';
import apiClient from '@/api/client';

/* ── Types ──────────────────────────────────────── */
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

/* ── Helpers ────────────────────────────────────── */
const LEVEL_CFG = {
  info:    { color: 'text-sky-400',     bg: 'bg-sky-400/8',     border: 'border-sky-400/20',     icon: Info,          dot: 'bg-sky-400'     },
  warn:    { color: 'text-amber-400',   bg: 'bg-amber-400/8',   border: 'border-amber-400/20',   icon: AlertTriangle, dot: 'bg-amber-400'   },
  error:   { color: 'text-red-400',     bg: 'bg-red-400/8',     border: 'border-red-400/20',     icon: XCircle,       dot: 'bg-red-400'     },
  success: { color: 'text-emerald-400', bg: 'bg-emerald-400/8', border: 'border-emerald-400/20', icon: CheckCircle2,  dot: 'bg-emerald-400' },
} as const;

function fmt(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour12: false }) + ' · ' +
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtJobName(name: string) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

/* ── Log line ───────────────────────────────────── */
function LogLine({ entry, index }: { entry: LogEntry; index: number }) {
  const cfg = LEVEL_CFG[entry.level];
  const time = new Date(entry.timestamp).toLocaleTimeString('en-GB', { hour12: false });
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.01, 0.15) }}
      className={`flex items-start gap-3 py-1.5 px-3 rounded-lg font-mono text-[11px] border-l-2 ${cfg.border} hover:bg-white/[0.03] transition-colors`}
    >
      <span className="text-white/25 shrink-0 w-14 pt-px">{time}</span>
      <span className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${cfg.dot}`} />
      <span className={`${cfg.color} font-bold shrink-0 w-24 truncate pt-px opacity-80`}>
        {entry.source}
      </span>
      <span className="text-white/70 break-words min-w-0 leading-relaxed">{entry.message}</span>
    </motion.div>
  );
}

/* ── Stat card ──────────────────────────────────── */
function StatCard({
  label, value, icon: Icon, running,
}: { label: string; value: string; icon: React.ElementType; running?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${
      running
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-surface border-white/5'
    }`}>
      {running && (
        <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" />
      )}
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-textSecondary mb-1.5 uppercase tracking-widest">{label}</p>
          <p className={`text-xl font-bold ${running ? 'text-emerald-400' : 'text-textPrimary'}`}>{value}</p>
        </div>
        <div className={`p-2.5 rounded-xl ${running ? 'bg-emerald-500/15' : 'bg-accent/10'}`}>
          <Icon className={`w-5 h-5 ${running ? 'text-emerald-400' : 'text-accent'}`} />
        </div>
      </div>
    </div>
  );
}

/* ── Job card ───────────────────────────────────── */
function JobCard({ job }: { job: JobStatus }) {
  const nextMs = job.nextRunAt ? new Date(job.nextRunAt).getTime() - Date.now() : null;
  const nextIn = nextMs && nextMs > 0
    ? nextMs < 3600000
      ? `${Math.round(nextMs / 60000)}m`
      : `${Math.round(nextMs / 3600000)}h`
    : null;

  return (
    <div className="relative bg-surface rounded-2xl border border-white/5 p-5 overflow-hidden">
      {job.isRunning && (
        <div className="absolute inset-0 bg-emerald-500/3 animate-pulse" />
      )}
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-textPrimary">{fmtJobName(job.jobName)}</p>
          <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
            job.isRunning
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-white/5 text-textSecondary'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${job.isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
            {job.isRunning ? 'Running' : 'Idle'}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-textSecondary">
            <Timer className="w-3.5 h-3.5 shrink-0" />
            <span>Next run {nextIn ? `in ~${nextIn}` : fmt(job.nextRunAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-textSecondary">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Last run {fmt(job.lastRunAt)}</span>
          </div>
        </div>

        {job.lastError && (
          <div className="mt-3 flex items-start gap-2 p-2 bg-red-500/8 rounded-lg border border-red-500/15">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-400 line-clamp-2">{job.lastError}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type LevelFilter = 'all' | LogEntry['level'];

/* ── Main page ──────────────────────────────────── */
export default function AdminPage() {
  const [logs, setLogs]             = useState<LogEntry[]>([]);
  const [status, setStatus]         = useState<ScraperStatus | null>(null);
  const [jobs, setJobs]             = useState<JobStatus[]>([]);
  const [levelFilter, setFilter]    = useState<LevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [loading, setLoading]       = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const latestTs  = useRef<string | undefined>(undefined);
  const pollRef   = useRef<ReturnType<typeof setInterval>>();

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
        setLogs((prev) => [...prev, ...data.logs].slice(-1000));
        latestTs.current = data.logs[data.logs.length - 1].timestamp;
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    pollRef.current = setInterval(() => { fetchStatus(); fetchLogs(); }, 2000);
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

  const filtered  = levelFilter === 'all' ? logs : logs.filter((l) => l.level === levelFilter);
  const isRunning = status?.isRunning ?? false;

  const counts = {
    info:    logs.filter((l) => l.level === 'info').length,
    success: logs.filter((l) => l.level === 'success').length,
    warn:    logs.filter((l) => l.level === 'warn').length,
    error:   logs.filter((l) => l.level === 'error').length,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16"
    >
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div className="flex items-center gap-3">
          <span className="w-1 h-8 rounded-full bg-accent block shrink-0" />
          <div>
            <h1 className="text-2xl font-bold text-textPrimary flex items-center gap-2.5">
              <Activity className="w-6 h-6 text-accent" />
              Sync Dashboard
            </h1>
            <p className="text-sm text-textSecondary mt-0.5">Monitor and control manga scraping</p>
          </div>
        </div>

        {/* Live badge */}
        <div className={`self-start sm:self-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
          isRunning
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-white/4 border-white/8 text-textSecondary'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-white/25'}`} />
          {isRunning ? 'Sync in progress…' : 'All systems idle'}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Status"    value={isRunning ? 'Syncing' : 'Idle'}          icon={Zap}      running={isRunning} />
        <StatCard label="Last Run"  value={fmt(status?.lastRunAt ?? null)}           icon={Clock}    />
        <StatCard label="Errors"    value={String(status?.errors?.length ?? 0)}     icon={XCircle}  />
        <StatCard label="Jobs"      value={String(jobs.length)}                      icon={Layers}   />
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-10">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => trigger('trigger')}
          disabled={isRunning || !!loading}
          className="flex items-center gap-2.5 bg-accent hover:bg-accent/90 disabled:opacity-35 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-glow text-sm"
        >
          {loading === 'trigger'
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Play className="w-4 h-4 fill-white" />}
          Full Sync
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => trigger('check-updates')}
          disabled={isRunning || !!loading}
          className="flex items-center gap-2.5 glass hover:bg-white/10 disabled:opacity-35 text-textPrimary font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          {loading === 'check-updates'
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <RefreshCw className="w-4 h-4" />}
          Chapter Check
        </motion.button>

        <AnimatePresence>
          {isRunning && (
            <motion.button
              initial={{ opacity: 0, scale: 0.85, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => trigger('stop')}
              disabled={status?.stopRequested}
              className="flex items-center gap-2.5 bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 text-red-400 font-semibold px-6 py-3 rounded-xl border border-red-500/25 transition-colors text-sm"
            >
              <Square className="w-4 h-4 fill-red-400" />
              {status?.stopRequested ? 'Stopping…' : 'Stop Sync'}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scheduled jobs ── */}
      {jobs.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-accent" />
            <h2 className="text-sm font-semibold text-textPrimary">Scheduled Jobs</h2>
            <span className="text-xs text-textSecondary/50">· auto-runs in background</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {jobs.map((job) => <JobCard key={job.jobName} job={job} />)}
          </div>
        </div>
      )}

      {/* ── Log terminal ── */}
      <div className="rounded-2xl overflow-hidden border border-white/6 shadow-card">
        {/* Terminal bar */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-surface border-b border-white/5">
          <div className="flex items-center gap-4">
            {/* Traffic lights */}
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500" />
              <span className="w-3 h-3 rounded-full bg-yellow-500" />
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
            <span className="text-xs text-textSecondary/60 font-mono">kamoola · sync logs</span>

            {/* Live indicator */}
            {isRunning && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Level pill filters */}
            {([
              { key: 'all',     label: 'All',     count: logs.length },
              { key: 'info',    label: 'Info',    count: counts.info,    cfg: LEVEL_CFG.info    },
              { key: 'success', label: 'OK',       count: counts.success, cfg: LEVEL_CFG.success },
              { key: 'warn',    label: 'Warn',    count: counts.warn,    cfg: LEVEL_CFG.warn    },
              { key: 'error',   label: 'Error',   count: counts.error,   cfg: LEVEL_CFG.error   },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as LevelFilter)}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                  levelFilter === f.key
                    ? 'bg-accent/20 text-accent'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'
                }`}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${
                    levelFilter === f.key ? 'bg-accent/20 text-accent' : 'bg-white/5'
                  }`}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-1" />

            <button
              onClick={() => setAutoScroll((p) => !p)}
              title={autoScroll ? 'Disable auto-scroll' : 'Enable auto-scroll'}
              className={`p-1.5 rounded-lg transition-colors ${autoScroll ? 'text-accent bg-accent/10' : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'}`}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={clearLogs}
              title="Clear logs"
              className="p-1.5 rounded-lg text-textSecondary hover:text-red-400 hover:bg-red-400/8 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Log body */}
        <div
          className="h-[520px] overflow-y-auto p-4 space-y-1 bg-[#06060e]"
          style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-10 h-10 rounded-full bg-white/3 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white/20" />
              </div>
              <p className="text-textSecondary/30 text-xs">
                No logs yet — click <span className="text-accent">Full Sync</span> to start
              </p>
            </div>
          ) : (
            filtered.map((entry, i) => (
              <LogLine key={entry.id} entry={entry} index={i} />
            ))
          )}
          <div ref={logEndRef} />
        </div>

        {/* Terminal footer */}
        <div className="px-5 py-2.5 bg-surface border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-textSecondary/40 font-mono">
            {filtered.length} / {logs.length} entries · polls every 2s
          </span>
          {status?.lastRunAt && (
            <span className="text-[10px] text-textSecondary/40 font-mono">
              last run {fmt(status.lastRunAt)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
