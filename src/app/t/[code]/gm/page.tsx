"use client";

import { useParams } from "next/navigation";
import { GmScreen } from "@/components/GmScreen";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <GmScreen code={String(params.code)} />;
}
