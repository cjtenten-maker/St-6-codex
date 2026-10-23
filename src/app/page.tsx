"use client";

import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";

export default function Page() {
  return (
    <Suspense fallback={<main className="min-h-dvh" />}>
      <HomeScreen />
    </Suspense>
  );
}
