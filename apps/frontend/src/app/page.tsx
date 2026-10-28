import { Container } from "@/components/layout/Container";
import { ButtonLink } from "@/components/ui/Button";

const steps = [
  {
    title: "Snap a photo",
    description: "Take a picture of the problem — a pothole, broken light, overflowing bin or anything else.",
  },
  {
    title: "Tell us where",
    description: "Add a short description and a street, landmark or nearest address. No map needed.",
  },
  {
    title: "Track progress",
    description: "The issue-management team reviews every report and updates its status as work happens.",
  },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-border bg-surface">
        <Container className="flex flex-col gap-6 py-12 sm:py-16 lg:py-20">
          <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-fg sm:text-4xl">
            Spot a problem in your neighborhood? Report it in a minute.
          </h1>
          <p className="max-w-[60ch] text-lg text-fg-muted">
            MyArea sends your report straight to the team that fixes it, and lets everyone see what&apos;s being
            done.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/reports/new" size="lg" className="w-full sm:w-auto">
              Report an issue
            </ButtonLink>
            <ButtonLink href="/reports" size="lg" variant="secondary" className="w-full sm:w-auto">
              Browse reports
            </ButtonLink>
          </div>
        </Container>
      </section>

      <section aria-labelledby="how-it-works">
        <Container className="py-12 sm:py-16">
          <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight text-fg">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4 rounded-lg border border-border bg-surface p-5 shadow-sm">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary"
                >
                  {index + 1}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-fg">{step.title}</h3>
                  <p className="text-fg-muted">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>
    </>
  );
}
