// Mock minimal de react-native pour les tests node (lib/mascot/utils.ts utilise Platform)
const Platform = {
  OS: 'ios',
  select: (obj: Record<string, unknown>) => obj.ios ?? obj.default,
};

module.exports = { Platform };
