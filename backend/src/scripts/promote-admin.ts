import { prisma } from '../lib/prisma.js'

const email = process.argv[2]?.trim().toLowerCase()

if (!email) {
  console.error('Usage: npm run admin:promote -- user@example.com')
  process.exitCode = 1
} else {
  try {
    const profile = await prisma.profile.update({
      where: { email },
      data: { isAdmin: true },
      select: { email: true, displayName: true, username: true, isAdmin: true },
    })
    console.log(`Admin access granted to ${profile.displayName ?? profile.email}.`)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Record to update not found')) {
      console.error(`No profile exists for ${email}. Create the account first, then run this command again.`)
    } else {
      console.error('Could not grant admin access.')
    }
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}