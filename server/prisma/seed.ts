import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database seed");

  //company

  const company = await prisma.company.upsert({
    where: {
      code: "PMS",
    },
    update: {},
    create: {
      code: "PMS",
      name: "Poultry Management System",
    },
  });
  console.log(`✅ Company: ${company.name}`);
  // Farm

  const farm = await prisma.farm.upsert({
    where: {
        companyId_code:{
            companyId: company.id,
            code:"SR-1",
        },
    },
    update:{},
    create:{
        companyId: company.id,
        code:"SR-1",
        name:"SR-1 Farm",
    },
  });


}
