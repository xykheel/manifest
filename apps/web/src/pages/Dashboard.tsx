import { DEPARTMENT_LABELS, UserRole } from "@manifest/shared";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

type DashboardApi = {
  programmesAvailable: number;
  programmesCompleted: number;
  averageQuizScorePercent: number | null;
  completionsTimeline: { month: string; label: string; count: number }[];
  quizScoreBands: { key: string; label: string; count: number; fill: string }[];
  quizAttemptsCounted: number;
};

type TimelineRow = { label: string; count: number };

function CompletionsAreaChart({ data }: { data: TimelineRow[] }) {
  const [hover, setHover] = useState<{ label: string; count: number } | null>(null);
  const w = 640;
  const h = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const maxY = Math.max(1, ...data.map((d) => d.count));
  const n = data.length;
  const stepX = n <= 1 ? 0 : innerW / (n - 1);

  const points = data.map((d, i) => {
    const x = padL + (n <= 1 ? innerW / 2 : i * stepX);
    const y = padT + innerH - (d.count / maxY) * innerH;
    return { x, y, ...d };
  });

  const lineD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD =
    points.length > 0
      ? `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${(padT + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padT + innerH).toFixed(1)} Z`
      : "";

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((t) => padT + innerH * (1 - t));

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-[280px] w-full text-slate-500 dark:text-slate-400"
        role="img"
        aria-label="Programme completions by month"
      >
        <defs>
          <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00A3AD" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#00A3AD" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {gridYs.map((gy) => (
          <line
            key={gy}
            x1={padL}
            y1={gy}
            x2={w - padR}
            y2={gy}
            className="stroke-slate-200 dark:stroke-slate-700"
            strokeDasharray="4 6"
            strokeWidth={1}
          />
        ))}
        {areaD && <path d={areaD} fill="url(#dashAreaFill)" />}
        {lineD && (
          <path
            d={lineD}
            fill="none"
            stroke="#00A3AD"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {points.map((p) => (
          <circle
            key={p.label}
            cx={p.x}
            cy={p.y}
            r={6}
            fill="#00A3AD"
            className="cursor-pointer"
            onMouseEnter={() => setHover({ label: p.label, count: p.count })}
            onMouseLeave={() => setHover(null)}
          />
        ))}
        {points.map((p) => (
          <text
            key={`t-${p.label}`}
            x={p.x}
            y={h - 8}
            textAnchor="middle"
            className="fill-current text-[10px]"
          >
            {p.label}
          </text>
        ))}
        {[0, Math.ceil(maxY / 2), maxY].map((tick) => {
          const gy = padT + innerH - (tick / maxY) * innerH;
          return (
            <text key={tick} x={4} y={gy + 4} className="fill-current text-[10px]">
              {tick}
            </text>
          );
        })}
      </svg>
      {hover && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-md dark:border-slate-600 dark:bg-slate-800">
          <div className="font-medium text-slate-800 dark:text-slate-100">{hover.label}</div>
          <div className="text-slate-600 dark:text-slate-300">{hover.count} completion(s)</div>
        </div>
      )}
    </div>
  );
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)] as const;
}

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  a0: number,
  a1: number,
): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, a0);
  const [x2, y2] = polar(cx, cy, rOuter, a1);
  const [x3, y3] = polar(cx, cy, rInner, a1);
  const [x4, y4] = polar(cx, cy, rInner, a0);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    "Z",
  ].join(" ");
}

function QuizDonutChart({
  slices,
}: {
  slices: { key: string; label: string; count: number; fill: string }[];
}) {
  const total = slices.reduce((s, x) => s + x.count, 0);
  const cx = 110;
  const cy = 110;
  const rO = 88;
  const rI = 54;
  let start = -Math.PI / 2;
  const paths: { key: string; d: string; fill: string }[] = [];
  if (total > 0) {
    for (const s of slices) {
      if (s.count <= 0) continue;
      const sweep = (s.count / total) * 2 * Math.PI;
      const a0 = start;
      const a1 = start + sweep;
      start = a1;
      paths.push({ key: s.key, d: donutSlicePath(cx, cy, rO, rI, a0, a1), fill: s.fill });
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center">
      <svg
        width={220}
        height={220}
        viewBox="0 0 220 220"
        className="shrink-0"
        role="img"
        aria-label="Distribution of quiz score bands"
      >
        {paths.map((p) => (
          <path key={p.key} d={p.d} fill={p.fill} stroke="none" />
        ))}
      </svg>
      <ul className="min-w-0 flex-1 space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.fill }} />
            <span className="flex-1">{s.label}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HeroMetricCard({
  value,
  label,
  gradientClass,
  icon,
}: {
  value: string;
  label: string;
  gradientClass: string;
  icon: ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8 ${gradientClass}`}
    >
      <div className="pointer-events-none absolute -right-4 -top-4 opacity-[0.12] [&>svg]:h-36 [&>svg]:w-36 sm:[&>svg]:h-44 sm:[&>svg]:w-44">
        {icon}
      </div>
      <p className="relative text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">{value}</p>
      <p className="relative mt-2 text-sm font-medium text-white/90 sm:text-base">{label}</p>
    </div>
  );
}

function IconStack() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 14a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm8 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function IconCheckBadge() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
    </svg>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardApi | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await api.get<DashboardApi>("/api/onboarding/dashboard");
        setStats(data);
      } catch {
        setLoadError("Could not load dashboard statistics.");
      }
    })();
  }, []);

  const isAdmin = user?.role === UserRole.ADMIN;

  const pieSlices = useMemo(() => {
    if (!stats) return [];
    return stats.quizScoreBands.filter((b) => b.count > 0);
  }, [stats]);

  const areaData = useMemo((): TimelineRow[] => {
    if (!stats?.completionsTimeline.length) {
      return [{ label: "—", count: 0 }];
    }
    return stats.completionsTimeline.map((r) => ({ label: r.label, count: r.count }));
  }, [stats]);

  if (!user) return null;

  return (
    <div className="min-h-0 flex-1 bg-slate-100/90 dark:bg-slate-950">
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 md:space-y-10 md:py-10">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-md-headline font-semibold tracking-tight text-slate-900 dark:text-slate-50">
              Dashboard
            </h1>
            {stats && (
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {stats.programmesAvailable} programme{stats.programmesAvailable === 1 ? "" : "s"}{" "}
                  available
                </span>
                {" · "}
                <span>
                  {stats.programmesCompleted} completed
                  {stats.averageQuizScorePercent != null &&
                    ` · ${stats.averageQuizScorePercent}% avg. quiz score (across completed quizzes)`}
                </span>
              </p>
            )}
            {loadError && (
              <p className="mt-2 text-base text-amber-800 dark:text-amber-200/90" role="alert">
                {loadError}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-1 rounded-2xl border border-slate-200/90 bg-white/90 px-4 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:items-end">
            <span className="font-medium text-slate-800 dark:text-slate-100">Signed in</span>
            <span className="max-w-[16rem] truncate text-slate-600 dark:text-slate-400">{user.email}</span>
            <Link to="/onboarding" className="link-brand mt-1 text-sm">
              Go to onboarding →
            </Link>
          </div>
        </header>

        {!stats && !loadError && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/90 px-6 py-12 dark:border-slate-700 dark:bg-slate-900">
            <div
              className="h-10 w-10 animate-spin rounded-full border-2 border-brand border-t-transparent"
              aria-hidden
            />
            <span className="text-slate-600 dark:text-slate-400">Loading your stats…</span>
          </div>
        )}

        {stats && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              <HeroMetricCard
                value={String(stats.programmesAvailable)}
                label="Programmes available"
                gradientClass="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700"
                icon={<IconStack />}
              />
              <HeroMetricCard
                value={String(stats.programmesCompleted)}
                label="Programmes completed"
                gradientClass="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600"
                icon={<IconCheckBadge />}
              />
              <HeroMetricCard
                value={
                  stats.averageQuizScorePercent != null ? `${stats.averageQuizScorePercent}%` : "—"
                }
                label="Average quiz score"
                gradientClass="bg-gradient-to-br from-teal-400 via-brand to-cyan-700 sm:col-span-2 lg:col-span-1"
                icon={<IconStar />}
              />
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="card-surface p-5 shadow-md sm:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Programme completions
                  </h2>
                  <span className="w-fit rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    By month
                  </span>
                </div>
                <CompletionsAreaChart data={areaData} />
                {stats.completionsTimeline.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Finish a programme to see completions over time.
                  </p>
                )}
              </div>

              <div className="card-surface p-5 shadow-md sm:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    Quiz results mix
                  </h2>
                  <span className="w-fit rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Completed quizzes
                  </span>
                </div>
                {pieSlices.length === 0 ? (
                  <div className="flex h-[280px] flex-col items-center justify-center text-center text-sm text-slate-500 dark:text-slate-400">
                    <p>No scored quiz steps in your completed programmes yet.</p>
                    <p className="mt-2">
                      Complete a programme that includes quizzes to see how you score.
                    </p>
                  </div>
                ) : (
                  <div className="min-h-[260px] py-2">
                    <QuizDonutChart slices={pieSlices} />
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <section className="card-surface p-6 sm:p-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Account
          </h2>
          <dl className="mt-4 space-y-3 text-base">
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Email</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.email}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.role}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Auth</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">{user.authProvider}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-28 shrink-0 text-slate-500 dark:text-slate-400">Departments</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-100">
                {user.departments.length === 0 ? (
                  <span className="font-normal text-slate-500 dark:text-slate-400">None assigned</span>
                ) : (
                  user.departments.map((d) => DEPARTMENT_LABELS[d]).join(", ")
                )}
              </dd>
            </div>
          </dl>
        </section>

        {isAdmin && (
          <section className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand-light/80 to-brand-soft/40 p-6 sm:p-8 dark:border-brand/40 dark:bg-slate-900 dark:[background-image:none]">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Admin</h2>
            <p className="mt-2 text-lg leading-relaxed text-slate-600 dark:text-slate-300">
              Build onboarding paths, lessons, and quizzes for your users.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/admin/users"
                className="btn-primary flex w-full items-center justify-center sm:inline-flex sm:w-auto"
              >
                Manage users
              </Link>
              <Link
                to="/admin/onboarding"
                className="btn-secondary flex w-full items-center justify-center py-3 sm:inline-flex sm:w-auto sm:py-2"
              >
                Onboarding builder
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
