"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { Container } from "@/components/layout/Container";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-12">
      <Alert
        tone="error"
        title="Something went wrong"
        action={
          <Button variant="secondary" onClick={() => retry()}>
            Try again
          </Button>
        }
      >
        This page couldn&apos;t load. Please try again in a moment.
      </Alert>
    </Container>
  );
}
