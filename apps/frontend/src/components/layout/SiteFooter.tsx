import { Container } from "./Container";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <Container className="flex flex-col gap-1 py-6 text-sm text-fg-muted sm:flex-row sm:justify-between">
        <p>MyArea — report and track neighborhood issues.</p>
        <p>Reports are reviewed by the issue-management team.</p>
      </Container>
    </footer>
  );
}
