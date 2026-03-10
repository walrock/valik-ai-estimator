import path from "node:path";
import { constants as fsConstants, promises as fs } from "node:fs";
import dotenv from "dotenv";

function nowFileStamp() {
  const date = new Date();
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`;
}

async function ensureReadable(filePath) {
  try {
    await fs.access(filePath, fsConstants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

dotenv.config();

const sourceDb = path.resolve(
  process.cwd(),
  process.env.DATABASE_PATH ?? path.join("data", "app.sqlite"),
);
const backupDir = path.resolve(
  process.cwd(),
  process.env.BACKUP_DIR ?? path.join("data", "backups"),
);
const backupPath = path.join(backupDir, `app-${nowFileStamp()}.sqlite`);

if (!(await ensureReadable(sourceDb))) {
  process.stderr.write(`Source database does not exist or is not readable: ${sourceDb}\n`);
  process.exitCode = 1;
} else {
  await fs.mkdir(backupDir, { recursive: true });
  await fs.copyFile(sourceDb, backupPath);
  process.stdout.write(`Database backup created: ${backupPath}\n`);
}
