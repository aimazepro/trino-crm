import { EvolutionDriver } from "./evolution";
import type { WhatsAppConnection, WhatsAppDriver } from "./types";

export * from "./types";
export { WEBHOOK_SECRET_HEADER } from "./evolution";

/**
 * Picks the driver for a connection. Adding uazapi means adding a case here and
 * a new file — nothing above this layer changes.
 */
export function getDriver(
  connection: Pick<WhatsAppConnection, "provider" | "instanceName" | "instanceToken" | "groupsEnabled">,
): WhatsAppDriver {
  switch (connection.provider) {
    case "evolution":
      return new EvolutionDriver(connection);
    default:
      throw new Error(`unknown WhatsApp provider "${connection.provider}"`);
  }
}
