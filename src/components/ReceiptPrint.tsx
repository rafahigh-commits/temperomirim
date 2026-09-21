import { formatBRL } from "@/lib/money";

export type ReceiptItem = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  note?: string | null;
};

type ReceiptPrintProps = {
  businessName: string;
  customerName: string;
  tableNumber?: string | null;
  openedAt: string;
  closedAt?: string | null;
  items: ReceiptItem[];
  subtotalCents: number;
  serviceFeeCents: number;
  discountCents: number;
  totalCents: number;
  paymentLabel?: string | null;
};

const DIVIDER = "--------------------------------";

export function ReceiptPrint({
  businessName,
  customerName,
  tableNumber,
  openedAt,
  closedAt,
  items,
  subtotalCents,
  serviceFeeCents,
  discountCents,
  totalCents,
  paymentLabel,
}: ReceiptPrintProps) {
  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="receipt-print" aria-hidden="true">
      <div className="receipt-center">
        <p className="receipt-business">{businessName}</p>
        <p>Comprovante de fechamento</p>
      </div>
      <p>{DIVIDER}</p>
      <p>Cliente: {customerName}</p>
      {tableNumber && <p>Mesa: {tableNumber}</p>}
      <p>Abertura: {formatDateTime(openedAt)}</p>
      {closedAt && <p>Fechamento: {formatDateTime(closedAt)}</p>}
      <p>{DIVIDER}</p>
      <p>QTD ITEM                    VALOR</p>
      <p>{DIVIDER}</p>
      {items.map((item, i) => (
        <div key={i}>
          <p className="receipt-line">
            <span>
              {item.quantity}x {item.name}
            </span>
            <span>{formatBRL(item.unitPriceCents * item.quantity)}</span>
          </p>
          {item.note && <p className="receipt-note">obs: {item.note}</p>}
        </div>
      ))}
      <p>{DIVIDER}</p>
      <p className="receipt-line">
        <span>Subtotal</span>
        <span>{formatBRL(subtotalCents)}</span>
      </p>
      {serviceFeeCents > 0 && (
        <p className="receipt-line">
          <span>Taxa de servico (10%)</span>
          <span>{formatBRL(serviceFeeCents)}</span>
        </p>
      )}
      {discountCents > 0 && (
        <p className="receipt-line">
          <span>Desconto</span>
          <span>-{formatBRL(discountCents)}</span>
        </p>
      )}
      <p>{DIVIDER}</p>
      <p className="receipt-line receipt-total">
        <span>TOTAL</span>
        <span>{formatBRL(totalCents)}</span>
      </p>
      {paymentLabel && (
        <p className="receipt-line">
          <span>Pagamento</span>
          <span>{paymentLabel}</span>
        </p>
      )}
      <p>{DIVIDER}</p>
      <div className="receipt-center">
        <p>Obrigado pela preferencia!</p>
        <p>Comanda Facil</p>
      </div>
    </div>
  );
}
