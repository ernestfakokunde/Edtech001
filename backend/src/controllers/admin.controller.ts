import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'

export async function listUsers(_request: Request, response: Response) {
  const users = await prisma.profile.findMany({
    select: { id: true, email: true, displayName: true, isAdmin: true, createdAt: true, _count: { select: { generatedSets: true } } },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ users })
}

export async function listRepositorySubmissions(_request: Request, response: Response) {
  const submissions = await prisma.paper.findMany({
    where: { status: { in: ['PENDING', 'APPROVED', 'REJECTED'] } },
    include: { owner: { select: { id: true, email: true, displayName: true } }, course: true },
    orderBy: { createdAt: 'desc' },
  })
  response.json({ submissions })
}

export async function listActivity(_request: Request, response: Response) {
  const activity = await prisma.auditEvent.findMany({
    include: { actor: { select: { id: true, email: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  response.json({ activity })
}
