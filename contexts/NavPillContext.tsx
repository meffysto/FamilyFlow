import { createContext, useContext } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

interface NavPillContextValue {
  navScrollY: SharedValue<number>;
}

const NavPillContext = createContext<NavPillContextValue | null>(null);

export function NavPillProvider({ children }: { children: React.ReactNode }) {
  const navScrollY = useSharedValue(0);
  return <NavPillContext.Provider value={{ navScrollY }}>{children}</NavPillContext.Provider>;
}

export function useNavPill() {
  return useContext(NavPillContext)!;
}
