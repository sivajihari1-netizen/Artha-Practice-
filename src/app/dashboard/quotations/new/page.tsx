import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import NewQuotationForm from "@/components/NewQuotationForm";

export default async function NewQuotationPage() {
  const session = getSession();
  const clients = await prisma.client.findMany({
    where: { firmId: session!.firmId, active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-extrabold mb-1">New Quotation</h1>
      <p className="text-sm text-gray-500 mb-6">
        Pick a service type to start from a ready-made proposal template — you can edit everything (text, fees, colors) afterward.
      </p>
      <NewQuotationForm clients={clients} />
    </div>
  );
}
