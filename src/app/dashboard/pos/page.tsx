import { redirect } from "next/navigation";

/** Legacy route — QR and NFC live on one page. */
export default function POSRedirectPage() {
  redirect("/dashboard/qr-codes");
}
