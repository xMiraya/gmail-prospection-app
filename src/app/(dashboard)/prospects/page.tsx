import { prisma } from "@/lib/db/prisma";
import { requireUserId } from "@/lib/auth/session";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { ProspectStatusBadge, STATUS_LABELS } from "@/components/status-badge";
import { Upload, UserPlus, Users, Search } from "lucide-react";

function initials(firstName: string, lastName?: string | null) {
  return `${firstName[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const userId = await requireUserId();

  const totalCount = await prisma.prospect.count({ where: { userId } });

  const where: Prisma.ProspectWhereInput = {
    userId,
    ...(searchParams.status ? { status: searchParams.status as never } : {}),
    ...(searchParams.q
      ? {
          OR: [
            { firstName: { contains: searchParams.q, mode: "insensitive" } },
            { lastName: { contains: searchParams.q, mode: "insensitive" } },
            { email: { contains: searchParams.q, mode: "insensitive" } },
            { city: { contains: searchParams.q, mode: "insensitive" } },
            { sector: { contains: searchParams.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const prospects = await prisma.prospect.findMany({
    where,
    include: { company: true, campaignProspects: { include: { campaign: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  if (totalCount === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Aucun prospect pour le moment"
        description="Importez votre première liste de prospects pour commencer votre prospection, ou ajoutez-en un manuellement."
        actions={
          <>
            <Button asChild>
              <Link href="/prospects/import"><Upload className="mr-1.5" /> Importer CSV</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/prospects/new"><UserPlus className="mr-1.5" /> Ajouter manuellement</Link>
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
          <p className="text-muted-foreground text-sm mt-1">{prospects.length} sur {totalCount} prospects affichés</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/prospects/import"><Upload className="mr-1.5" /> Importer CSV</Link>
          </Button>
          <Button asChild>
            <Link href="/prospects/new"><UserPlus className="mr-1.5" /> Ajouter un prospect</Link>
          </Button>
        </div>
      </div>

      <form className="flex gap-2" action="/prospects">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input name="q" defaultValue={searchParams.q} placeholder="Rechercher (nom, email, ville, secteur...)" className="pl-8" />
        </div>
        <Select name="status" defaultValue={searchParams.status ?? "all"}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" variant="outline">Filtrer</Button>
      </form>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>Ville</TableHead>
              <TableHead>Campagne</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Dernier contact</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prospects.map((p) => (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/prospects/${p.id}`} className="flex items-center gap-2 hover:underline">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-brand/10 text-brand text-[10px]">{initials(p.firstName, p.lastName)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{p.firstName} {p.lastName}</span>
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.company?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell className="text-muted-foreground">{p.sector ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.city ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.campaignProspects[0]?.campaign.name ?? "—"}</TableCell>
                <TableCell><ProspectStatusBadge status={p.status} /></TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {p.lastContactAt ? p.lastContactAt.toLocaleDateString("fr-FR") : "Jamais"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
