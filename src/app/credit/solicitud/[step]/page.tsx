import { SolicitudWizard } from "../SolicitudWizard";
import { isValidStep } from "@/lib/credit/solicitud-form";
import { notFound } from "next/navigation";

export default async function SolicitudStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  if (!isValidStep(step)) {
    notFound();
  }
  return <SolicitudWizard step={step} />;
}
