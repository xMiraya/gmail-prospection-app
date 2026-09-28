import { createProspect } from "@/lib/actions/prospects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function NewProspectPage() {
  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Ajouter un prospect</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createProspect} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom</Label>
                <Input id="lastName" name="lastName" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="website">Site internet</Label>
                <Input id="website" name="website" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" name="city" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sector">Secteur</Label>
                <Input id="sector" name="sector" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Source</Label>
              <Input id="source" name="source" placeholder="LinkedIn, salon, recommandation..." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} />
            </div>
            <Button type="submit">Créer le prospect</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
