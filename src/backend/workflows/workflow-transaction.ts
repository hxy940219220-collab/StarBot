import { withTransaction } from "../database/sqlite-transaction";
import type { StarBotDatabase } from "../starbot-database";

export function workflowTransaction<T>(database: StarBotDatabase, work: () => T): T {
  return withTransaction(database.connection, work);
}
