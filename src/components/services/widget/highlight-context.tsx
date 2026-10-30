import { createContext } from "react";

import type { HighlightConfig } from "@/utils/highlights";

export const BlockHighlightContext = createContext<HighlightConfig | null>(null);
