import "dotenv/config";
import { getDb } from "./server/db";
import { users, valueStreams, userValueStreams } from "./drizzle/schema";
import { sql } from "drizzle-orm";

async function seed() {
    console.log("🌱 Seeding Dev Data...");
    const db = await getDb();
    if (!db) {
        console.error("❌ Database connection failed");
        process.exit(1);
    }

    try {
        // ── 1. Dev User ──────────────────────────────────────────────
        await db.insert(users).values({
            id: 1,
            openId: "dev-user-123",
            name: "Dev User",
            email: "dev@example.com",
            loginMethod: "dev",
            role: "admin",
            isActive: 1,
            lastSignedIn: new Date(),
        }).onDuplicateKeyUpdate({
            set: {
                id: 1,
                name: "Dev User",
            }
        });
        console.log("  ✅ Dev User (ID: 1, admin)");

        // ── 2. Value Streams ─────────────────────────────────────────
        const streams = [
            { id: "global",      name: "Global",        description: "Cross-domain access to all operations",            icon: "global" },
            { id: "pharmacy",    name: "Pharmacy",      description: "Prescription fulfillment, drug inventory, compliance", icon: "pharma" },
            { id: "fresh-foods", name: "Fresh Foods",   description: "Meat, deli, bakery, produce — shrink & cold-chain", icon: "fresh" },
            { id: "optical",     name: "Optical",       description: "Eyewear inventory, appointments, insurance claims", icon: "optical" },
            { id: "ecommerce",   name: "E-Commerce",    description: "Online orders, fulfillment, last-mile delivery",    icon: "ecom" },
            { id: "warehouse",   name: "Warehouse Ops", description: "Receiving, stocking, labor scheduling",             icon: "wh" },
        ];

        for (const vs of streams) {
            await db.insert(valueStreams).values({
                id: vs.id,
                name: vs.name,
                description: vs.description,
                icon: vs.icon,
                isActive: 1,
            }).onDuplicateKeyUpdate({
                set: { name: vs.name, description: vs.description, icon: vs.icon },
            });
        }
        console.log(`  ✅ ${streams.length} Value Streams seeded`);

        // ── 3. Sample scoped users (for demo) ───────────────────────
        const scopedUsers = [
            { id: 2, openId: "pharmacy-user",  name: "Dr. Sarah Kim",    email: "sarah.kim@hki.com",    role: "operator" as const, streams: ["pharmacy"] },
            { id: 3, openId: "fresh-user",     name: "Mike Torres",      email: "mike.torres@hki.com",  role: "operator" as const, streams: ["fresh-foods"] },
            { id: 4, openId: "multi-user",     name: "Lisa Chen",        email: "lisa.chen@hki.com",    role: "manager" as const,  streams: ["pharmacy", "optical"] },
            { id: 5, openId: "warehouse-user",  name: "James Rodriguez", email: "james.r@hki.com",      role: "operator" as const, streams: ["warehouse", "ecommerce"] },
        ];

        for (const u of scopedUsers) {
            await db.insert(users).values({
                id: u.id,
                openId: u.openId,
                name: u.name,
                email: u.email,
                loginMethod: "dev",
                role: u.role,
                valueStreams: u.streams.join(","),
                isActive: 1,
                lastSignedIn: new Date(),
            }).onDuplicateKeyUpdate({
                set: { name: u.name, role: u.role, valueStreams: u.streams.join(",") },
            });

            // Also populate the join table
            for (const streamId of u.streams) {
                await db.insert(userValueStreams).values({
                    userId: u.id,
                    valueStreamId: streamId,
                }).onDuplicateKeyUpdate({
                    set: { valueStreamId: streamId },
                });
            }
        }
        console.log(`  ✅ ${scopedUsers.length} scoped users seeded`);

        console.log("\n🎉 Dev seed complete");
        process.exit(0);
    } catch (error) {
        console.error("❌ Seeding failed:", error);
        process.exit(1);
    }
}

seed();
