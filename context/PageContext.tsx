import { createContext, useContext, useState, ReactNode } from 'react';

export type ActivePage = {
  id: string;
  name: string;
};

type PageContextValue = {
  activePage: ActivePage | null;
  setActivePage: (page: ActivePage | null) => void;
};

const PageContext = createContext<PageContextValue>({
  activePage: null,
  setActivePage: () => {},
});

export function PageProvider({ children }: { children: ReactNode }) {
  const [activePage, setActivePage] = useState<ActivePage | null>(null);

  return (
    <PageContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </PageContext.Provider>
  );
}

export function useActivePage() {
  return useContext(PageContext);
}
