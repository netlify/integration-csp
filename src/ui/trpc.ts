import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../server/router.js";

export const trpc = createTRPCReact<AppRouter>();
