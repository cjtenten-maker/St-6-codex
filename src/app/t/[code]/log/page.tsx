"use client";

import { useParams } from "next/navigation";
import { LogScreen } from "@/components/LogScreen";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <LogScreen code={String(params.code)} />;
}
