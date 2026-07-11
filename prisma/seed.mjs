import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

console.log("No seed data is inserted. Register your actual note articles from the app.");

await prisma.$disconnect();
