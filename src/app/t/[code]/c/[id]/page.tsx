"use client";

import { useParams } from "next/navigation";
import { SheetScreen } from "@/components/SheetScreen";

export default function Page() {
  const params = useParams<{ code: string; id: string }>();
  return <SheetScreen code={String(params.code)} id={String(params.id)} />;
}
