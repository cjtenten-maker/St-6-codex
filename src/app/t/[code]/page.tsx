"use client";

import { useParams } from "next/navigation";
import { TableScreen } from "@/components/TableScreen";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <TableScreen code={String(params.code)} />;
}
