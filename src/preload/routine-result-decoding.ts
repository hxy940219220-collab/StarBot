import {
  isNullableRoutineResultDestination,
  isRoutineResultConnectionOptions,
  isRoutineResultDeliveries,
} from "@starbot/contracts/ipc";
import { guardedDecoder } from "@starbot/contracts/ipc-decoding";

export const decodeRoutineResultOptions = guardedDecoder(
  isRoutineResultConnectionOptions,
  "routine result options response",
);
export const decodeRoutineResultDestination = guardedDecoder(
  isNullableRoutineResultDestination,
  "routine result destination response",
);
export const decodeRoutineResultDeliveries = guardedDecoder(
  isRoutineResultDeliveries,
  "routine result deliveries response",
);
