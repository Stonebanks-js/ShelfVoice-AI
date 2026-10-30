import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import Loading from "../loading";
import { CameraScreen } from "./camera-screen";

// O-10 Camera (doc 06): a photo of a supplier's bill, read into proposed
// deliveries that come back through Check and confirm.
export default function CameraPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Camera />
    </Suspense>
  );
}

async function Camera() {
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  return <CameraScreen />;
}
