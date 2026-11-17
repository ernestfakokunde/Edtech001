import type { MissionActionType } from '@prisma/client'
import { prisma } from '../lib/prisma.js'

/** Record a server-confirmed action against every active mission for it. */
export async function recordMissionAction(profileId: string, actionType: MissionActionType) {
  await prisma.$transaction(async (tx) => {
    const missions = await tx.mission.findMany({
      where: { actionType, isActive: true },
      select: { id: true },
    })
    for (const mission of missions) {
      await tx.userMissionProgress.upsert({
        where: { profileId_missionId: { profileId, missionId: mission.id } },
        create: { profileId, missionId: mission.id, count: 1 },
        update: { count: { increment: 1 } },
      })
    }
  })
}
