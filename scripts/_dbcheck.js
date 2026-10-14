const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  console.log("trades  ", await p.trade.count());
  console.log("accounts", await p.account.count());
  console.log(JSON.stringify(await p.account.findMany(), null, 1));
  console.log("playbooks", await p.playbook.count(), "plans", await p.tradePlan.count());
  await p.$disconnect();
})();