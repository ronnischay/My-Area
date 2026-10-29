import { BrandMark } from "@/components/layout/BrandMark";
import { Container } from "@/components/layout/Container";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

/** Login and invite: no navigation, just the brand and the theme toggle. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="pt-[env(safe-area-inset-top)]">
        <Container className="flex min-h-16 items-center justify-between">
          <BrandMark />
          <ThemeToggle />
        </Container>
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 flex-col pb-12 focus:outline-none">
        {children}
      </main>
    </>
  );
}
