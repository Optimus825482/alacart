import { evaluateScheduledItemsAction } from "../src/actions/pos";
import { prisma } from "../src/lib/prisma";

const token = process.env.SCHEDULER_SECRET;
if (!token || token.length < 32) {
  throw new Error("SCHEDULER_SECRET tanımlı ve en az 32 karakter olmalıdır.");
}

const pollIntervalMs = Math.max(1000, Number(process.env.SCHEDULER_POLL_MS) || 2000);
let stopping = false;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });

async function main() {
  console.info("ALACARTE zamanlı gönderim işçisi başlatıldı.");
  while (!stopping) {
    try {
      const result = await evaluateScheduledItemsAction({ internalSchedulerToken: token });
      if (result.status !== "IDLE") {
        console.info(`Zamanlı işler işlendi: durum=${result.status}, etkilenen=${result.affectedItems}`);
      }
    } catch (error) {
      console.error("Zamanlı iş döngüsü başarısız oldu; sonraki turda yeniden denenecek.", error);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("Zamanlı işçi başlatılamadı.", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
