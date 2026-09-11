import type { Request, Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

export async function updateProfile(request: Request, response: Response) {
  const profile = (request as AuthenticatedRequest).profile
  const { displayName, username } = request.body as Partial<{ displayName: string; username: string }>
  const cleanDisplayName = displayName?.trim()
  const cleanUsername = username?.trim().toLowerCase()

  if (!cleanDisplayName || !cleanUsername || !/^[a-z0-9_]{3,24}$/.test(cleanUsername)) {
    response.status(400).json({ message: 'Display name and a username using 3-24 letters, numbers, or underscores are required.' })
    return
  }

  try {
    const updatedProfile = await prisma.profile.update({
      where: { id: profile.id },
      data: { displayName: cleanDisplayName, username: cleanUsername },
      select: { id: true, email: true, displayName: true, username: true, isAdmin: true },
    })
    response.json({ profile: updatedProfile })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      response.status(409).json({ message: 'That username is already taken.' })
      return
    }
    response.status(500).json({ message: 'Could not update your profile.' })
  }
}