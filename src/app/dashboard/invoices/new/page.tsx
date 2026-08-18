import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewInvoiceForm from "@/components/NewInvoiceForm";

export default async function NewInvoicePage() {
  const session = getSession();
  const [clients, firm] = await Promise.all([
    prisma.client.findMany({ where: { firmId: session!.firmId, active: true }, select: { id: true, name: true, gstin: true }, orderBy: { name: "asc" } }),
    prisma.firm.findUnique({ where: { id: session!.firmId }, select: { gstin: true } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">New Invoice</h1>
      <p className="text-sm text-gray-500 mb-6">Raise a professional-fee invoice against one of your clients.</p>
      <NewInvoiceForm clients={clients} firmGstin={firm?.gstin ?? null} />
    </div>
  );
}
