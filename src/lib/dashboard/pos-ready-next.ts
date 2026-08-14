/**
 * Reset POS after New Charge — clear active payment UI and keypad so the
 * cashier can enter the next amount immediately (Figma primary CTA).
 */
export type PosReadyForNextState = {
  amountClp: string;
  reference: string;
  result: null;
  paid: boolean;
  paidAt: null;
  error: null;
  showReceipt: boolean;
};

export function readyForNextPaymentState(): PosReadyForNextState {
  return {
    amountClp: "",
    reference: "",
    result: null,
    paid: false,
    paidAt: null,
    error: null,
    showReceipt: false,
  };
}
