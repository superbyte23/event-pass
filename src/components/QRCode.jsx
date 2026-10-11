import { createQRMatrix } from "@/lib/qr-encode";
import { cn } from "@/lib/utils";

// Ticket QR rendered fully offline as crisp SVG (no image service, no network).
// Scales perfectly at any size, which also makes it easier to scan.
export default function QRCode({ value, size = 220, className }) {
  if (!value) return null;
  let qr;
  try {
    qr = createQRMatrix(value);
  } catch {
    return null;
  }
  const quiet = 4;
  const dim = qr.size + quiet * 2;
  let d = "";
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.at(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={`0 0 ${dim} ${dim}`}
      role="img"
      aria-label="Ticket QR code"
      className={cn("block bg-white", className)}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      <path d={d} fill="#000000" />
    </svg>
  );
}