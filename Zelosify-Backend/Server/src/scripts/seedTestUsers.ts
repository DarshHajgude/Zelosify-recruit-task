import prisma from "../config/prisma/prisma.js";
import { AuthProvider, Role } from "@prisma/client";

const TENANT_ID = "bruce-wayne-corp-tenant-id-001";

const TEST_USERS = [
  {
    username: "vendor_test",
    email: "vendor_test@zelosify.com",
    firstName: "Vendor",
    lastName: "Test",
    phoneNumber: "0000000000",
    department: "Engineering",
    role: "IT_VENDOR" as Role,
    externalId: "06724946-84db-4c4b-9aea-f2eb9b188b6f", // Keycloak UUID
    provider: "KEYCLOAK" as AuthProvider,
    tenantId: TENANT_ID,
    creator: "seed",
    totpSecret: "JBSWY3DPEHPK3PXP", // dummy — bypassed for user0
  },
  {
    username: "hm_test",
    email: "hm_test@zelosify.com",
    firstName: "Manager",
    lastName: "Test",
    phoneNumber: "1111111111",
    department: "Talent Acquisition",
    role: "HIRING_MANAGER" as Role,
    externalId: "6a91175d-64ab-4a44-8d45-b06c58220a71", // Keycloak UUID
    provider: "KEYCLOAK" as AuthProvider,
    tenantId: TENANT_ID,
    creator: "seed",
    totpSecret: "JBSWY3DPEHPK3PXP", // dummy — bypassed for user1
  },
];

async function seedTestUsers() {
  console.log("🌱 Seeding test users...");

  for (const userData of TEST_USERS) {
    const existing = await prisma.user.findFirst({
      where: { email: userData.email },
    });

    if (existing) {
      console.log(`⏭️  User ${userData.email} already exists, skipping`);
      continue;
    }

    await prisma.user.create({ data: userData });
    console.log(`✅ Created ${userData.role}: ${userData.email} (username: ${userData.username})`);
  }

  console.log("🎉 Test users seeded!");
}

seedTestUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
