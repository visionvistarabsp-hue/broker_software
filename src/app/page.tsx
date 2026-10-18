import Link from "next/link";
import { ArrowRight, Sparkles, Users, Target, BarChart3, CheckCircle2, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      <header className="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold bg-gradient-to-r from-indigo-700 to-cyan-700 bg-clip-text text-transparent">
            Broker CRM
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-white/70 transition-colors">
            Log in
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 text-white shadow-md hover:shadow-lg hover:scale-[1.02] transition-all"
          >
            Sign up
          </Link>
        </div>
      </header>

      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-12 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-indigo-100 shadow-sm mb-6">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-700">Built for Real Estate Brokers</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            Manage Referrals, Track Leads &amp; Close Deals Faster
          </h1>
          <p className="text-lg sm:text-xl text-gray-600 mb-8 leading-relaxed">
            A clean, colorful CRM to organize your broker network, follow up on referrals, and never miss an opportunity.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 text-white font-medium shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
            >
              Sign up free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/80 border border-gray-200 text-gray-900 font-medium shadow-sm hover:shadow-md hover:bg-white transition-all"
            >
              Log in to Dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}