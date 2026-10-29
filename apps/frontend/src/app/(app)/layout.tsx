import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/layout/AppHeader";
import { TabBar } from "@/components/layout/AppNav";
import { requireUser } from "@/lib/server/session";

/**
 * Shell for every signed-in page. The session is read inside Suspense boundaries (Cache Components:
 * request data can't be in the static shell), so the page frame renders immediately.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={<AppHeaderFallback />}>
        <SignedInHeader />
      </Suspense>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col pb-32 focus:outline-none md:pb-16">
        {children}
      </main>
      <Suspense fallback={null}>
        <SignedInTabBar />
      </Suspense>
    </>
  );
}

async function SignedInHeader() {
  return <AppHeader user={await requireUser()} />;
}

async function SignedInTabBar() {
  const user = await requireUser();
  return <TabBar role={user.role} hasSociety={user.society !== null} />;
}
