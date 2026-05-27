-- CreateTable
CREATE TABLE "LoginIp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginIp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LoginIp_userId_createdAt_idx" ON "LoginIp"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LoginIp_ip_idx" ON "LoginIp"("ip");
