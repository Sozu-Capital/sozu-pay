export interface RecipientRow {
  name: string;
  email: string;
  phone?: string;
  amount: string;
  verification?: string;
}

export function recipientsToCSV(recipients: RecipientRow[], defaultAmount = ""): string {
  const rows = recipients.map((r) => {
    const id = r.name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    const email = r.email.trim();
    const amount = (r.amount || defaultAmount || "0").trim();
    const verification = (r.verification ?? "").trim() || "2000-01-01";
    return `${email},${id},${amount},${verification}`;
  });
  return "email,id,amount,verification\n" + rows.join("\n");
}

export function receiversToRecipientRows(
  receivers: Array<{
    email?: string;
    phone_number?: string;
    external_id?: string;
    payment?: { amount?: string; verification_field_value?: string; verification?: string } | null;
  }>
): RecipientRow[] {
  return receivers
    .filter((r) => r.email?.trim())
    .map((r) => ({
      name: (r.external_id ?? r.email ?? "").replace(/_/g, " "),
      email: r.email!.trim(),
      phone: r.phone_number?.trim() ?? "",
      amount: r.payment?.amount?.trim() ?? "",
      verification:
        r.payment?.verification_field_value?.trim() ??
        r.payment?.verification?.trim() ??
        "",
    }));
}
