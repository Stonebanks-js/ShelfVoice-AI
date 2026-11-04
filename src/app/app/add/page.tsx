import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import Loading from "../loading";
import { AddHub } from "./add-hub";

// Add products: ready-made list, shelf photo, barcodes, bill, sheet, voice.
export default function AddPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Add />
    </Suspense>
  );
}

async function Add() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  return <AddHub />;
}
