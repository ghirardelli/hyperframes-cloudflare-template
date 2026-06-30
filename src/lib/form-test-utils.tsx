import type { ReactElement, ReactNode } from "react";

import {
  TestQueryProvider,
  createTestQueryClient,
} from "./query-client";

export function renderWithAppFormProviders(children: ReactNode): ReactElement {
  return <TestQueryProvider client={createTestQueryClient()}>{children}</TestQueryProvider>;
}
