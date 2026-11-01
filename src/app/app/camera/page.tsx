import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ownerState } from "@/server/session";

import Loading from "../loading";
import { CameraScreen } from "./camera-screen";

// O-10 Camera (doc 06): a photo of a supplier's bill, read into proposed
// deliveries, or of a shelf (?mode=shelf, V-01), read into new products;
// both come back through Check and confirm.
export default function CameraPage({ searchParams }: PageProps<"/app/camera">) {
  return (
    <Suspense fallback={<Loading />}>
      <Camera searchParams={searchParams} />
    </Suspense>
  );
}

async function Camera({ searchParams }: Pick<PageProps<"/app/camera">, "searchParams">) {
  const { mode } = await searchParams;
  const state = await ownerState();
  if (!state) redirect("/");
  if (!state.shop) redirect("/app/welcome");
  return <CameraScreen mode={mode === "shelf" ? "shelf" : "bill"} />;
}
