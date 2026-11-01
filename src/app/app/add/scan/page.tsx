import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import Loading from "../../loading";
import { BarcodeScan } from "./barcode-scan";

// V-01 add or restock products by barcode.
export default function ScanPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Scan />
    </Suspense>
  );
}

async function Scan() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  return <BarcodeScan />;
}
