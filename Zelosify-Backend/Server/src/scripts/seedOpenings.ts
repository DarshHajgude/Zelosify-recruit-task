import prisma from "../config/prisma/prisma.js";

const TENANT_NAME = "Bruce Wayne Corp";

const OPENINGS = [
  {
    title: "Senior Backend Engineer",
    description:
      "Design and build scalable microservices for enterprise clients. Must have experience with distributed systems and event-driven architecture.",
    location: "Remote",
    contractType: "Full-Time Contract",
    experienceMin: 5,
    experienceMax: 10,
    status: "OPEN" as const,
  },
  {
    title: "Frontend React Developer",
    description:
      "Build responsive and accessible UIs using React and TypeScript. Experience with state management (Redux/Zustand) required.",
    location: "Gotham City",
    contractType: "Part-Time Contract",
    experienceMin: 3,
    experienceMax: 6,
    status: "OPEN" as const,
  },
  {
    title: "DevOps / Cloud Engineer",
    description:
      "Manage CI/CD pipelines, Kubernetes clusters, and cloud infrastructure on AWS. Terraform experience is a plus.",
    location: "Remote",
    contractType: "Full-Time Contract",
    experienceMin: 4,
    experienceMax: 8,
    status: "OPEN" as const,
  },
  {
    title: "Data Scientist",
    description:
      "Develop predictive models and ML pipelines for business intelligence. Python, scikit-learn, and SQL proficiency required.",
    location: "Metropolis",
    contractType: "Fixed-Term Contract",
    experienceMin: 2,
    experienceMax: 5,
    status: "OPEN" as const,
  },
  {
    title: "QA Automation Engineer",
    description:
      "Design and maintain automated test suites using Playwright and Cypress. CI/CD integration experience expected.",
    location: "Remote",
    contractType: "Part-Time Contract",
    experienceMin: 2,
    experienceMax: 4,
    status: "ON_HOLD" as const,
  },
  {
    title: "Product Manager – Fintech",
    description:
      "Drive product roadmap for fintech platform. Work cross-functionally with engineering, design, and compliance teams.",
    location: "Gotham City",
    contractType: "Full-Time Contract",
    experienceMin: 6,
    experienceMax: 12,
    status: "OPEN" as const,
  },
  {
    title: "Cybersecurity Analyst",
    description:
      "Monitor, detect, and respond to security incidents. Conduct vulnerability assessments and pen testing across infrastructure.",
    location: "Gotham City",
    contractType: "Fixed-Term Contract",
    experienceMin: 3,
    experienceMax: 7,
    status: "OPEN" as const,
  },
  {
    title: "Mobile Developer (React Native)",
    description:
      "Develop cross-platform mobile applications for iOS and Android. Experience with Expo and native module integration required.",
    location: "Remote",
    contractType: "Full-Time Contract",
    experienceMin: 2,
    experienceMax: 5,
    status: "OPEN" as const,
  },
  {
    title: "Solutions Architect",
    description:
      "Lead technical architecture discussions and provide enterprise-grade design proposals for clients. AWS certification preferred.",
    location: "Metropolis",
    contractType: "Consulting Contract",
    experienceMin: 8,
    experienceMax: undefined,
    status: "OPEN" as const,
  },
  {
    title: "UI/UX Designer",
    description:
      "Create user-centered design prototypes and interaction flows in Figma. Conduct usability research and iterate based on feedback.",
    location: "Remote",
    contractType: "Part-Time Contract",
    experienceMin: 1,
    experienceMax: 4,
    status: "CLOSED" as const,
  },
  {
    title: "Machine Learning Engineer",
    description:
      "Build and deploy ML models to production using MLflow and FastAPI. Deep learning experience with PyTorch or TensorFlow is a must.",
    location: "Gotham City",
    contractType: "Full-Time Contract",
    experienceMin: 4,
    experienceMax: 9,
    status: "OPEN" as const,
  },
  {
    title: "Technical Project Manager",
    description:
      "Manage end-to-end delivery of software projects using Agile/Scrum. Strong communication and stakeholder management skills required.",
    location: "Remote",
    contractType: "Fixed-Term Contract",
    experienceMin: 5,
    experienceMax: 10,
    status: "OPEN" as const,
  },
];

async function seedOpenings() {
  try {
    console.log("🌱 Seeding openings data...");

    // Upsert tenant
    const tenant = await prisma.tenants.upsert({
      where: { tenantId: "bruce-wayne-corp-tenant-id-001" },
      update: {},
      create: {
        tenantId: "bruce-wayne-corp-tenant-id-001",
        companyName: TENANT_NAME,
      },
    });
    console.log(`✅ Tenant ready: ${tenant.companyName} (${tenant.tenantId})`);

    // Upsert two hiring manager users
    const hm1 = await prisma.user.upsert({
      where: { externalId: "hm-bruce-wayne-001" },
      update: {},
      create: {
        externalId: "hm-bruce-wayne-001",
        email: "bruce.wayne@brucewaynecorp.com",
        firstName: "Bruce",
        lastName: "Wayne",
        role: "HIRING_MANAGER",
        tenantId: tenant.tenantId,
        provider: "KEYCLOAK",
      },
    });

    const hm2 = await prisma.user.upsert({
      where: { externalId: "hm-lucius-fox-002" },
      update: {},
      create: {
        externalId: "hm-lucius-fox-002",
        email: "lucius.fox@brucewaynecorp.com",
        firstName: "Lucius",
        lastName: "Fox",
        role: "HIRING_MANAGER",
        tenantId: tenant.tenantId,
        provider: "KEYCLOAK",
      },
    });
    console.log(`✅ Hiring Managers seeded: ${hm1.firstName} ${hm1.lastName}, ${hm2.firstName} ${hm2.lastName}`);

    // Seed openings (alternating between two hiring managers)
    const now = new Date();
    let created = 0;
    let skipped = 0;

    for (let i = 0; i < OPENINGS.length; i++) {
      const opening = OPENINGS[i];
      const hiringManagerId = i % 2 === 0 ? hm1.id : hm2.id;

      const expectedCompletion = new Date(now);
      expectedCompletion.setMonth(now.getMonth() + 3 + i);

      // Skip if an opening with this title already exists for this tenant
      const existing = await prisma.opening.findFirst({
        where: { tenantId: tenant.tenantId, title: opening.title },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.opening.create({
        data: {
          tenantId: tenant.tenantId,
          title: opening.title,
          description: opening.description,
          location: opening.location,
          contractType: opening.contractType,
          hiringManagerId,
          experienceMin: opening.experienceMin,
          experienceMax: opening.experienceMax ?? null,
          expectedCompletionDate: expectedCompletion,
          status: opening.status,
        },
      });
      created++;
    }

    console.log(`✅ Openings seeded: ${created} created, ${skipped} already existed`);
    console.log("🎉 Seed complete!");
  } catch (error) {
    console.error("❌ Error seeding openings:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedOpenings();
