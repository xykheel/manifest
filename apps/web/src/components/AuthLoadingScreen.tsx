/**
 * Full-viewport loading state for auth flows (SSO callback, session hydration, MSAL in progress).
 */
export function AuthLoadingScreen({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center gap-6 px-6 py-12"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-12 w-12 shrink-0 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand dark:border-slate-600 dark:border-t-brand"
        aria-hidden
      />
      <div className="max-w-md space-y-2 text-center">
        <h1 className="text-lg font-medium text-slate-800 dark:text-slate-100">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
    </div>
  );
}
