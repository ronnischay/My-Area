import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Container className="flex justify-center pt-4 sm:pt-10">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-panel border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-display font-bold text-fg">Forgot your password?</h1>
          <p className="text-fg-muted">Enter the email you sign in with and we&apos;ll send you a link to choose a new one.</p>
        </div>
        <ForgotPasswordForm />
      </div>
    </Container>
  );
}
