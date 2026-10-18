export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-indigo-50 via-white to-cyan-50" />
      <div className="absolute inset-0 -z-10 opacity-60 bg-[radial-gradient(at_top_left,theme(colors.indigo.200/40),transparent_60%),radial-gradient(at_bottom_right,theme(colors.cyan.200/40),transparent_60%)]" />
      <h1 className="text-center text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-cyan-700 bg-clip-text text-transparent">
        Broker CRM
      </h1>
      <div className="rounded-2xl bg-white/80 backdrop-blur-sm border border-white shadow-xl shadow-indigo-500/10 p-5 sm:p-6">
        {children}
      </div>
    </main>
  );
}