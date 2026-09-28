import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

// Volontairement simple : cet outil est prévu pour un usage interne mono-utilisateur
// ou petite équipe, pas pour une inscription publique ouverte.
export async function POST(req: NextRequest) {
  const body = schema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(body.data.password, 12);
  await prisma.user.create({
    data: {
      email: body.data.email.toLowerCase(),
      name: body.data.name,
      passwordHash,
      settings: { create: {} },
    },
  });

  return NextResponse.json({ ok: true });
}
