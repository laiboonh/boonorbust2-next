import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
  }

  const firstName = session.user.name?.split(" ")[0] ?? "User";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-emerald-600 text-white px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
            <span className="text-emerald-600 text-sm font-bold">B</span>
          </div>
          <div>
            <span className="font-semibold text-sm">Hi, {firstName}</span>
            <span className="text-emerald-200 text-xs ml-2">v0.1.0</span>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-emerald-100 hover:text-white text-sm underline"
          >
            Logout
          </button>
        </form>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 z-10">
        <NavItem href="/dashboard" label="Dashboard" icon="📊" />
        <NavItem href="/assets" label="Assets" icon="💼" />
        <NavItem href="/transactions" label="Trades" icon="📋" />
        <NavItem href="/positions" label="Positions" icon="📈" />
        <NavItem href="/portfolios" label="Portfolios" icon="🗂️" />
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 px-3 py-1 text-gray-500 hover:text-emerald-600 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
