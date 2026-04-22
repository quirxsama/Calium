import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const arg = process.argv[2]?.trim();

  if (arg === "--help" || arg === "-h") {
    console.log("Kullanım: npm run grant-admin -- <email>");
    return;
  }

  const email = arg?.toLowerCase();

  if (!email) {
    console.error("Kullanım: node scripts/grant-admin.mjs <email>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  });

  if (!user) {
    console.error(`Kullanıcı bulunamadı: ${email}`);
    process.exitCode = 1;
    return;
  }

  if (user.role === "admin") {
    console.log(`Kullanıcı zaten admin: ${user.email} (@${user.username})`);
    return;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin" },
    select: {
      email: true,
      username: true,
      role: true,
    },
  });

  console.log(`Admin rolü verildi: ${updated.email} (@${updated.username}) -> ${updated.role}`);
}

main()
  .catch((error) => {
    console.error("Admin rolü verilirken hata oluştu:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
